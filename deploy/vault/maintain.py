#!/usr/bin/env python3
"""Backup-server operator only. Client timestamps never determine retention age."""
import datetime as dt,fcntl,hashlib,importlib.util,json,os,pathlib,re,sqlite3,subprocess,sys,tempfile,time
ROOT=pathlib.Path('/var/lib/cubit-vault');CONFIG=pathlib.Path('/etc/cubit-vault/operator.json')
def now():return dt.datetime.now(dt.timezone.utc)
def iso(d):return d.isoformat(timespec='seconds').replace('+00:00','Z')
def run(args,env=None):return subprocess.check_output(args,env=env,stderr=subprocess.PIPE,timeout=3600)
def restic(*args):return run(['restic','-r',str(ROOT/'repository/crm'),'--password-file','/etc/cubit-vault/repository.password',*args])
def status(value):
    target=ROOT/'status/backup.json';tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(value));tmp.chmod(0o644);tmp.replace(target)
def cycle(restore=False,inventory=False):
    config=json.loads(CONFIG.read_text());days=config.get('retentionDays',30)
    if type(days)is not int or days<30 or days>3650:raise ValueError('Retention must be at least 30 days')
    (ROOT/'operator').mkdir(mode=0o700,exist_ok=True)
    statefile=ROOT/'operator/receipts.json';state=json.loads(statefile.read_text()) if statefile.exists() else {'firstSeen':{},'lastRestore':None}
    # Stop every remote reader/writer before direct repository maintenance.
    if not inventory:run(['systemctl','stop','cubit-vault-repository.service'])
    result={'ready':False,'checkedAt':iso(now()),'retentionDays':days,'lastRestore':state.get('lastRestore'),'snapshots':[],**state.get('health',{})}
    try:
        rows=json.loads(restic('snapshots','--json')) or []
        for row in rows:
            identifier=row['id']
            if not re.fullmatch('[a-f0-9]{64}',identifier):raise ValueError('Invalid snapshot')
            state['firstSeen'].setdefault(identifier,iso(now()))
        # Persist receiver-owned timestamps before considering any removal.
        tmp=statefile.with_suffix('.tmp');tmp.write_text(json.dumps(state));tmp.chmod(0o600);tmp.replace(statefile)
        if restore and rows:
            spec=importlib.util.spec_from_file_location('worker',pathlib.Path(__file__).with_name('backup-worker.py'));w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
            w.REPO=str(ROOT/'repository/crm');w.KEY='/etc/cubit-vault/repository.password';w.STATE=ROOT/'operator';w.cfg=config
            selected=max(rows,key=lambda r:(state['firstSeen'][r['id']],r.get('time','')))['id']
            verified=w.verify({**w.DEFAULTS,'offsiteEnabled':False},selected)
            state['lastRestore']={'ok':True,'checkedAt':iso(now()),'snapshot':selected,'message':verified['message'],'counts':verified['counts']}
            state['verifiedSnapshot']=selected
        elif restore:raise ValueError('No snapshots to restore')
        # A verified recovery point is retained until another passes. No count-based
        # rule can let a burst of forged snapshots evict the protected time window.
        protected=state.get('verifiedSnapshot')
        cutoff=now()-dt.timedelta(days=days)
        expired=[r['id'] for r in rows if r['id']!=protected and dt.datetime.fromisoformat(state['firstSeen'][r['id']].replace('Z','+00:00'))<cutoff]
        # Never age out the last recovery history if no newer backup was verified.
        if not inventory and protected and expired:
            # The CRM gateway owns its temporary locks, so the receiver cannot
            # see an in-flight copy lock. Drain longer than the CRM's 1800-second
            # command timeout before collecting unreferenced packs. Otherwise a
            # paused copy could resume with references to packs just pruned.
            result['maintenanceUntil']=iso(now()+dt.timedelta(seconds=1850));status(result)
            time.sleep(1850)
            restic('check');restic('forget',*expired);restic('prune');restic('check')
            result.pop('maintenanceUntil',None)
            rows=[r for r in rows if r['id']not in expired]
        result.update(ready=True,lastRestore=state.get('lastRestore'),snapshots=[{'id':r['id'],'receivedAt':state['firstSeen'][r['id']],'protectedUntil':iso(dt.datetime.fromisoformat(state['firstSeen'][r['id']].replace('Z','+00:00'))+dt.timedelta(days=days))} for r in rows])
        result['snapshots'].sort(key=lambda r:r['receivedAt'],reverse=True)
        # Keep a root-owned, consistent copy of the audit store for recovery.
        audit=ROOT/'audit/audit.sqlite3'
        if not inventory and audit.exists():
            with sqlite3.connect('file:'+str(audit)+'?mode=ro',uri=True) as source,sqlite3.connect(ROOT/'operator/audit-recovery.sqlite3') as target:
                source.backup(target)
                previous='0'*64
                for encoded,received,prior,digest,chain in target.execute('SELECT payload,received_at,previous_hash,digest,chain_hash FROM records ORDER BY sequence'):
                    if prior!=previous or hashlib.sha256(encoded.encode()).hexdigest()!=digest or hashlib.sha256((previous+'\n'+encoded+'\n'+received).encode()).hexdigest()!=chain:raise ValueError('Audit chain verification failed')
                    previous=chain
                result['auditChainVerifiedAt']=iso(now());result['auditChainHead']=previous
        if not inventory:result.pop('error',None)
    except Exception as error:
        result.update(error='Backup-server maintenance or recovery failed; operator inspection required.',lastRestore=state.get('lastRestore'))
        if restore:
            state['lastRestore']={'ok':False,'checkedAt':iso(now()),'message':result['error']}
            result['lastRestore']=state['lastRestore']
        print(type(error).__name__+': '+str(error),file=sys.stderr)
        status(result);raise
    finally:
        state['health']={k:result[k] for k in ('error','auditChainVerifiedAt','auditChainHead') if k in result}
        tmp=statefile.with_suffix('.tmp');tmp.write_text(json.dumps(state));tmp.chmod(0o600);tmp.replace(statefile)
        status(result)
        if not inventory:run(['systemctl','start','cubit-vault-repository.service'])
if __name__=='__main__':
    if os.geteuid()!=0:raise SystemExit('Backup-server operator only')
    os.umask(0o077)
    with open('/run/cubit-vault-maintenance.lock','w') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise SystemExit(0)
        cycle('--restore' in sys.argv,'--inventory' in sys.argv)
