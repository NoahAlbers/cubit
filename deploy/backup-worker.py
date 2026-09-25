#!/usr/bin/env python3
"""Root-only worker. The web app queues bounded actions; it never runs commands.

Only /etc/cubit-backup/config.json may choose storage, schemas, or image paths.
All subprocesses use argument arrays, never shell=True. Recovery imports are
confined to a networkless temporary MySQL container, with no host bind mounts.
"""
import base64, calendar, datetime as dt, gzip, hashlib, json, os, pathlib
import re, secrets, shutil, sqlite3, subprocess, sys, tarfile, tempfile, time, uuid
import threading
import urllib.request
import importlib.util
from contextlib import closing
from zoneinfo import ZoneInfo
from urllib.parse import urlparse

UTC=dt.timezone.utc
STATE=pathlib.Path('/var/lib/cubit-backup')
REPO='/var/backups/cubit/repository'
KEY='/etc/cubit-backup/repository.password'
CONFIG='/etc/cubit-backup/config.json'
TAG='cubit-managed-v1'
DOCUSEAL_DATA=pathlib.Path('/var/lib/docuseal/docuseal')
DEFAULTS=dict(frequency='daily',time='02:15',timezone='America/New_York',weekday=0,monthday=1,localKeep=7,remoteKeep=30,offsiteEnabled=False,verifyDays=30)

def validate(s):
    if set(s)!=set(DEFAULTS) or s['frequency'] not in ('manual','daily','weekly','monthly'): raise ValueError('Invalid schedule')
    if not isinstance(s['time'],str) or not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d',s['time']): raise ValueError('Invalid time')
    if not isinstance(s['timezone'],str) or len(s['timezone'])>60: raise ValueError('Invalid timezone')
    ZoneInfo(s['timezone'])
    for k,lo,hi in [('weekday',0,6),('monthday',1,31),('localKeep',3,365),('remoteKeep',3,365),('verifyDays',0,90)]:
        if type(s[k]) is not int or not lo<=s[k]<=hi: raise ValueError('Invalid retention/schedule')
    if type(s['offsiteEnabled']) is not bool: raise ValueError('Invalid storage selection')
    return s

def slots(s,now):
    """Most recent due slot and next slot; fold=0 avoids duplicate DST runs.
    Nonexistent spring-forward times normalize to the first real later time.
    A missed schedule runs once on return, without replaying every missed day.
    """
    validate(s)
    if s['frequency']=='manual': return None,None
    zone=ZoneInfo(s['timezone']);local=now.astimezone(zone);hour,minute=map(int,s['time'].split(':'));candidates=[]
    for offset in range(-62,63):
        day=local.date()+dt.timedelta(days=offset)
        if s['frequency']=='weekly' and day.weekday()!=s['weekday']: continue
        if s['frequency']=='monthly' and day.day!=min(s['monthday'],calendar.monthrange(day.year,day.month)[1]): continue
        value=dt.datetime.combine(day,dt.time(hour,minute),zone).astimezone(UTC)
        candidates.append((day.isoformat(),value))
    return max((x for x in candidates if x[1]<=now),key=lambda x:x[1]),min((x for x in candidates if x[1]>now),key=lambda x:x[1])

def run(args,*,env=None,input=None,timeout=1800,cwd=None):
    p=subprocess.run(args,input=input,stdout=subprocess.PIPE,stderr=subprocess.PIPE,env=env,timeout=timeout,cwd=cwd)
    if p.returncode: raise RuntimeError('Command failed: '+pathlib.Path(args[0]).name)
    return p.stdout

def literal(value): return "CONVERT(0x"+str(value).encode().hex()+" USING utf8mb4)" if str(value) else "''"
def sql(query): return run(['mysql','--batch','--skip-column-names','--raw',cfg['database'],'-e',query],timeout=30).decode().strip()
def nowstr(): return dt.datetime.now(UTC).isoformat()
def digest_file(path,algorithm='sha256'):
    with pathlib.Path(path).open('rb') as source: return hashlib.file_digest(source,algorithm).digest()
def event(kind,author,detail):
    payload=json.dumps(dict(version=1,actorType='system',entityId=detail.get('job'),before=None,after=detail,reason=''))
    sql('INSERT INTO operations_audit (id,kind,author,detail) VALUES ('+','.join(map(literal,[str(uuid.uuid4()),kind,author,payload]))+')')
def private_config():
    p=pathlib.Path(CONFIG)
    if p.stat().st_uid!=0 or p.stat().st_mode&0o077: raise ValueError('Configuration must be root-only')
    c=json.loads(p.read_text())
    for schema in c['schemas']+[c['database']]:
        if not re.fullmatch('[a-z][a-z0-9_]{1,50}',schema): raise ValueError('Invalid schema')
    if not re.fullmatch(r'mysql@sha256:[a-f0-9]{64}',c['restoreImage']): raise ValueError('Pin the official MySQL recovery image')
    u=urlparse(c['publicUrl'])
    if u.scheme!='https' or not u.hostname or u.username or u.password or u.query or u.fragment or u.path not in ('','/'): raise ValueError('Invalid HTTPS URL')
    if c.get('remote'):
        r=c['remote'];is_rest=r.get('type')=='rest';prefix='rest:' if is_rest else 's3:';u=urlparse(r['repository'][len(prefix):])
        if not r['repository'].startswith(prefix+'https://') or not u.hostname or u.username or u.password or u.query or u.fragment or u.path in ('','/'): raise ValueError('Use a private HTTPS repository')
        if is_rest:
            if not r.get('username') or not r.get('password'):raise ValueError('Missing REST credentials')
        elif not r.get('accessKey') or not r.get('secretKey'): raise ValueError('Missing storage credentials')
        if r.get('retentionProtected') is not True: raise ValueError('Confirm independent immutable/versioned retention before connecting off-server storage')
    return c

def restic(args,remote=False,cwd=None):
    env={**os.environ,'RESTIC_PASSWORD_FILE':KEY,'RESTIC_CACHE_DIR':str(STATE/'cache')}
    repo=REPO
    if remote:
        if not args or args[0] not in ('copy','snapshots','restore','check','init'):
            raise ValueError('Remote deletion and maintenance are forbidden on this VPS')
        r=cfg.get('remote')
        if not r: raise RuntimeError('Off-server storage is not configured')
        repo=r['repository']
        if r.get('type')=='rest':
            if args[0]=='init':raise ValueError('Only the backup-server operator initializes repositories')
            env.update(RESTIC_REST_USERNAME=r['username'],RESTIC_REST_PASSWORD=r['password'])
        else:env.update(AWS_ACCESS_KEY_ID=r['accessKey'],AWS_SECRET_ACCESS_KEY=r['secretKey'],AWS_DEFAULT_REGION=r.get('region','us-east-1'))
    if remote and cfg['remote'].get('type')=='rest':
        # Restic copy still needs temporary locks. Keep them in an authenticated
        # loopback gateway; no lock or deletion request reaches the backup server.
        spec=importlib.util.spec_from_file_location('vault_client',pathlib.Path(__file__).with_name('vault-client.py'))
        client=importlib.util.module_from_spec(spec);spec.loader.exec_module(client)
        with client.gateway(cfg['remote']) as (loopback,password):
            env.update(RESTIC_REST_USERNAME='crm',RESTIC_REST_PASSWORD=password)
            return run(['restic','--repo',loopback,*args],env=env,cwd=cwd)
    return run(['restic','--repo',repo,*args],env=env,cwd=cwd)

def snapshots(remote=False): return json.loads(restic(['snapshots','--json','--tag',TAG],remote)) or []
def local_inventory():
    rows=[]
    for item in snapshots():
        if not re.fullmatch('[a-f0-9]{64}',item.get('id','')): raise ValueError('Invalid backup identifier')
        rows.append({'id':item['id'],'createdAt':item['time'],'bytes':item.get('summary',{}).get('total_bytes_processed')})
    return sorted(rows,key=lambda row:row['createdAt'],reverse=True)

def prune_local(settings):
    validate(settings)
    if settings['offsiteEnabled']: sync_remote()
    before=local_inventory()
    if len(before)<=settings['localKeep']: return {'message':'All local backups are within the retention limit.','removed':0}
    restic(['check'])
    restic(['forget','--tag',TAG,'--group-by','host,tags','--keep-last',str(settings['localKeep']),'--prune'])
    return {'message':'Local retention applied. Off-server copies were not changed.','removed':len(before)-len(local_inventory())}
def initialize():
    STATE.mkdir(mode=0o700,parents=True,exist_ok=True)
    key=pathlib.Path(KEY)
    if not key.exists():
        if pathlib.Path(REPO,'config').exists(): raise RuntimeError('Recovery key missing; do not replace it')
        key.write_text(secrets.token_urlsafe(48)+'\n');key.chmod(0o600)
    if key.stat().st_uid!=0 or key.stat().st_mode&0o077: raise RuntimeError('Recovery key must be root-only')
    if not pathlib.Path(REPO,'config').exists(): restic(['init'])

def dump(schema,path):
    # Stream SQL so large document BLOBs do not accumulate in worker memory.
    with tempfile.TemporaryFile() as errors, gzip.open(path,'wb') as out:
        p=subprocess.Popen(['mysqldump','--single-transaction','--hex-blob','--no-tablespaces','--set-gtid-purged=OFF',schema],stdout=subprocess.PIPE,stderr=errors)
        try: shutil.copyfileobj(p.stdout,out)
        finally: p.stdout.close()
        if p.wait(timeout=1200): raise RuntimeError('Database export failed')

def capture():
    payload=STATE/'payload'
    if payload.exists(): shutil.rmtree(payload)
    payload.mkdir(mode=0o700)
    for schema in cfg['schemas']: dump(schema,payload/(schema+'.sql.gz'))
    source=DOCUSEAL_DATA
    with closing(sqlite3.connect('file:'+str(source/'db.sqlite3')+'?mode=ro',uri=True)) as origin, closing(sqlite3.connect(payload/'docuseal.sqlite3')) as target:
        origin.backup(target)
        if target.execute('PRAGMA integrity_check').fetchone()[0]!='ok': raise RuntimeError('DocuSeal snapshot failed')
    def keep_file(info): return None if pathlib.PurePosixPath(info.name).name.startswith('db.sqlite3') else info
    with tarfile.open(payload/'docuseal-files.tgz','w:gz') as archive: archive.add(source,arcname='docuseal',filter=keep_file)
    # Private service configuration is deliberately outside the data backup.
    # Recover secrets from independent custody, not from the compromised VPS's key.
    (payload/'recovery-requirements.json').write_text(json.dumps({
        'serviceConfigurationIncluded':False,
        'requiredFromIndependentCustody':['restic repository password','Cubit MFA encryption keys','DocuSeal encryption/session secrets'],
        'recreate':['database users and passwords','Cubit JWT secrets (existing sessions end)','DocuSeal API access','S3 credentials and immutable-retention policy','hostname/TLS and service configuration'],
        'instructions':'Use the recorded release deploy/BACKUPS.md. Never enable live integrations during restoration.'}))
    manifest={'format':'cubit-backup-v2','createdAt':nowstr(),'schemas':cfg['schemas'],'release':str(pathlib.Path('/opt/cubit/current').resolve()),'serviceConfigurationIncluded':False,'files':{}}
    for file in payload.iterdir(): manifest['files'][file.name]=digest_file(file).hex()
    (payload/'manifest.json').write_text(json.dumps(manifest))
    return payload

def backup(settings):
    payload=STATE/'payload'
    try:
        payload=capture()
        lines=restic(['backup','--json','--tag',TAG,'--host','cubit-'+cfg['database'],'.'],cwd=payload).decode().splitlines()
        summary=next(json.loads(line) for line in reversed(lines) if json.loads(line).get('message_type')=='summary')
        snapshot=summary['snapshot_id'];remote=False
        if settings['offsiteEnabled']:
            sync_remote()
            remote=True
        # Never prune after a failed capture or copy; only this worker's snapshots.
        restic(['forget','--tag',TAG,'--group-by','host,tags','--keep-last',str(settings['localKeep']),'--prune'])
        return {'snapshot':snapshot[:12],'remote':remote,'message':'Encrypted backup saved'+(' locally and off-server.' if remote else ' locally. Off-server copies are not enabled.')}
    finally: shutil.rmtree(payload,ignore_errors=True)

def sync_remote():
    """Copy every retained snapshot before local cleanup; retry gaps after outages.

    Restic remembers original snapshot IDs and skips copies already accepted.
    The CRM never runs retention against the destination.
    """
    marker=STATE/'remote-sync.json'
    state={'checkedAt':nowstr(),'ok':False}
    try:
        restic(['copy','--from-repo',REPO,'--from-password-file',KEY,'--tag',TAG],True)
        state['ok']=True
    finally:
        temporary=marker.with_suffix('.tmp');temporary.write_text(json.dumps(state));temporary.chmod(0o600);temporary.replace(marker)

def safe_extract(archive,destination):
    with tarfile.open(archive) as t:
        for info in t.getmembers():
            if not info.isfile() and not info.isdir(): raise ValueError('Unexpected archive link/device')
            target=(destination/info.name).resolve()
            if not target.is_relative_to(destination.resolve()): raise ValueError('Unsafe archive path')
        t.extractall(destination,filter='data')

def verify(settings,selected=None):
    # An explicitly chosen copy always refers to the local inventory.
    if selected is not None and not re.fullmatch('[a-f0-9]{64}',selected): raise ValueError('Invalid backup identifier')
    remote=bool(settings['offsiteEnabled']) and selected is None;available=snapshots(remote)
    if not available: raise RuntimeError('No successful backup exists to restore')
    if selected is not None and not any(row['id']==selected for row in available): raise RuntimeError('This backup is no longer retained')
    selected=selected or max(available,key=lambda x:x['time'])['id']
    restic(['check','--read-data'],remote)
    with tempfile.TemporaryDirectory(prefix='recovery-',dir=STATE) as directory:
        stage=pathlib.Path(directory);restic(['restore',selected,'--target',str(stage),'--verify'],remote)
        manifests=list(stage.rglob('manifest.json'))
        manifests=[p for p in manifests if json.loads(p.read_text()).get('format') in ('cubit-backup-v1','cubit-backup-v2')]
        if len(manifests)!=1: raise RuntimeError('Backup manifest missing')
        base=manifests[0].parent;manifest=json.loads(manifests[0].read_text())
        if manifest['schemas']!=cfg['schemas']: raise RuntimeError('Backup schemas do not match this deployment')
        for name,digest in manifest['files'].items():
            if pathlib.Path(name).name!=name or digest_file(base/name).hex()!=digest: raise RuntimeError('Backup file checksum mismatch')
        safe_extract(base/'docuseal-files.tgz',stage/'documents')
        with closing(sqlite3.connect(base/'docuseal.sqlite3')) as db:
            if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok': raise RuntimeError('DocuSeal database failed integrity check')
            for key,checksum in db.execute('SELECT key,checksum FROM active_storage_blobs'):
                if not re.fullmatch('[a-zA-Z0-9_-]+',key): raise RuntimeError('Invalid document storage key')
                file=stage/'documents/docuseal/attachments'/key[:2]/key[2:4]/key
                if not file.is_file() or base64.b64encode(digest_file(file,'md5')).decode()!=checksum: raise RuntimeError('Retained DocuSeal file failed verification')
        container='cubit-recovery-'+secrets.token_hex(6);password=secrets.token_urlsafe(32)
        env={**os.environ,'MYSQL_ROOT_PASSWORD':password,'MYSQL_PWD':password}
        try:
            # MySQL's anonymous volume is removed with the test container.
            # A tmpfs would charge database files against its memory limit.
            run(['docker','run','-d','--name',container,'--label','com.cubit.recovery=true','--network','none','--memory','768m','--cpus','1','--env','MYSQL_ROOT_PASSWORD',cfg['restoreImage']],env=env)
            for attempt in range(90):
                try:
                    # The image first starts a temporary bootstrap server. Do not
                    # import until entrypoint has exec'd the final mysqld as PID 1.
                    if run(['docker','exec',container,'cat','/proc/1/comm'],timeout=10).strip()!=b'mysqld': raise RuntimeError('Recovery database is initializing')
                    run(['docker','exec','--env','MYSQL_PWD',container,'mysql','-uroot','-N','-e','SELECT 1'],env=env,timeout=10);break
                except RuntimeError:
                    if attempt==89: raise
                    time.sleep(2)
            counts={}
            for schema in cfg['schemas']:
                run(['docker','exec','--env','MYSQL_PWD',container,'mysql','-uroot','-e','CREATE DATABASE '+schema],env=env)
                with gzip.open(base/(schema+'.sql.gz'),'rb') as dumpfile, tempfile.TemporaryFile() as errors:
                    p=subprocess.Popen(['docker','exec','-i','--env','MYSQL_PWD',container,'mysql','-uroot','--binary-mode',schema],stdin=subprocess.PIPE,stdout=errors,stderr=errors,env=env)
                    try:
                        shutil.copyfileobj(dumpfile,p.stdin)
                        p.stdin.close()
                    except BrokenPipeError: pass
                    if p.wait(timeout=900):
                        errors.seek(0);diagnostic=errors.read()
                        (STATE/'last-import-error.txt').write_bytes(diagnostic)
                        code=re.search(rb'ERROR \d+ \([A-Z0-9]+\)(?: at line \d+)?',diagnostic)
                        raise RuntimeError('Isolated database restore failed'+(': '+code[0].decode() if code else ' (see private import diagnostic)'))
                if schema=='cubit_parallel':
                    query="SELECT g.counts FROM parallel_current c JOIN parallel_generation g ON g.id=c.generation WHERE c.id=1; SELECT JSON_OBJECT('member',SUM(kind='member'),'plan',SUM(kind='plan'),'member_plan',SUM(kind='member_plan'),'transaction',SUM(kind='transaction'),'member_key',SUM(kind='member_key'),'access_log',SUM(kind='access_log')) FROM parallel_record r JOIN parallel_current c ON c.generation=r.generation; SELECT COALESCE(SUM(CAST(JSON_UNQUOTE(JSON_EXTRACT(payload,'$.amount')) AS DECIMAL(12,2))*100),0) FROM parallel_record r JOIN parallel_current c ON c.generation=r.generation WHERE kind='transaction'; CHECK TABLE parallel_generation,parallel_current,parallel_record,parallel_change,parallel_run"
                    rows=run(['docker','exec','--env','MYSQL_PWD',container,'mysql','-uroot','-N',schema,'-e',query],env=env).decode().splitlines()
                    if len(rows)!=8:raise RuntimeError('Restored parallel snapshot is incomplete')
                    expected=json.loads(rows[0]);actual=json.loads(rows[1])
                    if any(expected.get(kind)!=n for kind,n in actual.items()) or int(float(rows[2]))!=expected['paymentCents'] or any(not row.endswith('\tOK') for row in rows[3:]):raise RuntimeError('Restored parallel snapshot counts/tables failed verification')
                    counts[schema]=actual
                    continue
                query='SELECT COUNT(*) FROM member; SELECT COUNT(*) FROM transaction; SELECT COUNT(*) FROM waiver_document WHERE SHA2(content,256)<>sha256 OR OCTET_LENGTH(content)<>bytes; CHECK TABLE member,transaction,waiver_document,waiver_version'
                rows=run(['docker','exec','--env','MYSQL_PWD',container,'mysql','-uroot','-N',schema,'-e',query],env=env).decode().splitlines()
                if len(rows)<7 or rows[2]!='0' or any(not row.endswith('\tOK') for row in rows[3:]): raise RuntimeError('Restored tables or waiver BLOBs failed verification')
                counts[schema]={'members':int(rows[0]),'payments':int(rows[1])}
            return {'snapshot':selected[:12],'scope':'off-server' if remote else 'local','counts':counts,'message':'Restored '+('off-server' if remote else 'local')+' backup into an isolated database; tables, waiver files and checksums passed.'}
        finally: subprocess.run(['docker','rm','-fv',container],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)

def https_check():
    result={'ok':False,'checkedAt':nowstr(),'message':'Certificate or redirect check failed.'}
    try:
        url=cfg['publicUrl'].rstrip('/')
        code=run(['curl','--silent','--show-error','--max-time','15','--proto','=https','--output','/dev/null','--write-out','%{http_code}',url+'/health'],timeout=20).decode()
        headers=run(['curl','--silent','--show-error','--max-time','15','--head',url.replace('https://','http://',1)],timeout=20).decode()
        if code=='200' and re.search(r'HTTP/[^ ]+ (301|302|307|308)',headers) and re.search(r'(?im)^location: '+re.escape(url)+r'/?\s*$',headers): result.update(ok=True,message='Current hostname serves HTTPS with a trusted certificate and redirects HTTP.')
    except (RuntimeError,subprocess.TimeoutExpired): pass
    return result

def heartbeat():
    now=dt.datetime.now(UTC);previous=sql("SELECT detail FROM backup_runtime WHERE id='default'")
    state=json.loads(previous) if previous else {}
    settings=json.loads(sql("SELECT settings FROM backup_settings WHERE id='default'"));settings['timezone']=sql("SELECT timezone FROM organization_settings WHERE id='default'");_,upcoming=slots(settings,now)
    if not state.get('https') or (now-dt.datetime.fromisoformat(state['https']['checkedAt'])).total_seconds()>3600: state['https']=https_check()
    verified=sql("SELECT DATE_FORMAT(finishedAt,'%Y-%m-%dT%H:%i:%sZ') FROM backup_job WHERE kind='verify' AND status='Succeeded' ORDER BY finishedAt DESC LIMIT 1")
    state.update(localReady=pathlib.Path(REPO,'config').exists(),offsiteConfigured=bool(cfg.get('remote')),nextRunAt=upcoming[1].isoformat() if upcoming else None,lastVerifiedAt=verified or None)
    marker=STATE/'remote-sync.json'
    if marker.exists():state['remoteSync']=json.loads(marker.read_text())
    if cfg.get('remote',{}).get('type')=='rest':
        try:
            c=json.loads(pathlib.Path('/etc/cubit-backup/audit.json').read_text())
            req=urllib.request.Request(c['url'].rstrip('/')+'/status',headers={'Authorization':'Bearer '+c['readToken']})
            with urllib.request.urlopen(req,timeout=8) as response:state['vault']=json.load(response)
            state['vaultError']=False
        except Exception:state['vaultError']=True
    try:
        state.update(snapshots=local_inventory(),inventoryCheckedAt=nowstr(),inventoryError=False)
    except Exception:
        # Retain the last known inventory but label it stale rather than claim an empty repository.
        state['inventoryError']=True
    sql("INSERT INTO backup_runtime(id,detail,heartbeat) VALUES ('default',"+literal(json.dumps(state))+",UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE detail=VALUES(detail),heartbeat=VALUES(heartbeat)")

def cycle():
    initialize()
    # No other worker can be running while this process owns flock. Remove
    # only our labeled, networkless rehearsal containers after interruption.
    for container in run(['docker','ps','-aq','--filter','label=com.cubit.recovery=true']).decode().split():
        if re.fullmatch('[a-f0-9]{12,64}',container): run(['docker','rm','-fv',container])
    sql("INSERT IGNORE INTO backup_settings(id,settings,revision) VALUES ('default',"+literal(json.dumps(DEFAULTS))+",1)")
    # flock guarantees no live worker owns these; recover interrupted operations visibly.
    sql("UPDATE backup_job SET status='Failed',finishedAt=UTC_TIMESTAMP(),result='{"+'"message":"Worker interrupted; retry the operation. Never restored over the working database."'+"}' WHERE status='Running'")
    settings=json.loads(sql("SELECT settings FROM backup_settings WHERE id='default'"));settings['timezone']=sql("SELECT timezone FROM organization_settings WHERE id='default'");settings=validate(settings)
    marker=STATE/'remote-sync.json'
    previous=json.loads(marker.read_text()) if marker.exists() else {}
    if settings['offsiteEnabled'] and (not previous or (not previous.get('ok') and (dt.datetime.now(UTC)-dt.datetime.fromisoformat(previous['checkedAt'])).total_seconds()>300)):
        try:sync_remote()
        except Exception:print('Off-server copy will retry in five minutes.',file=sys.stderr)
    now=dt.datetime.now(UTC);due,_=slots(settings,now)
    if due:
        jid=str(uuid.uuid5(uuid.NAMESPACE_URL,'cubit-backup:'+cfg['database']+':'+due[0]))
        sql("INSERT IGNORE INTO backup_job(id,kind,status,requestedBy) VALUES ("+literal(jid)+",'backup','Queued','Backup schedule')")
    if settings['verifyDays']:
        latest=sql("SELECT DATE_FORMAT(createdAt,'%Y-%m-%dT%H:%i:%sZ') FROM backup_job WHERE kind='verify' ORDER BY createdAt DESC LIMIT 1")
        if (not latest or (now-dt.datetime.fromisoformat(latest)).total_seconds()>settings['verifyDays']*86400) and snapshots():
            sql("INSERT INTO backup_job(id,kind,status,requestedBy) VALUES ("+literal(str(uuid.uuid4()))+",'verify','Queued','Recovery schedule')")
    heartbeat()
    jobs=sql("SELECT JSON_OBJECT('id',id,'kind',kind,'requestedBy',requestedBy,'request',result) FROM backup_job WHERE status='Queued' ORDER BY createdAt,id LIMIT 1")
    if not jobs:return
    job=json.loads(jobs)
    if job['kind'] not in ('backup','verify','prune'): raise ValueError('Invalid queued operation')
    sql("UPDATE backup_job SET status='Running',startedAt=UTC_TIMESTAMP() WHERE id="+literal(job['id']))
    stop=threading.Event()
    def pulse():
        while not stop.wait(45):
            try: heartbeat()
            except Exception: print('Heartbeat update failed',file=sys.stderr)
    thread=threading.Thread(target=pulse,daemon=True);thread.start()
    try:
        request=json.loads(job.get('request') or '{}')
        if job['kind']=='prune' and request.get('localKeep')!=settings['localKeep']: raise ValueError('Retention changed after confirmation; confirm again')
        result=backup(settings) if job['kind']=='backup' else prune_local(settings) if job['kind']=='prune' else verify(settings,request.get('requestedSnapshot'))
        status='Succeeded'
    except Exception as error:
        status='Failed';result={'message':('Backup' if job['kind']=='backup' else 'Local retention' if job['kind']=='prune' else 'Recovery test')+' did not finish. Check the server log and retry. The working database was not replaced.'}
        print(type(error).__name__+': '+str(error),file=sys.stderr)
    finally:
        stop.set();thread.join(timeout=60)
    sql("UPDATE backup_job SET status="+literal(status)+",finishedAt=UTC_TIMESTAMP(),result="+literal(json.dumps(result))+" WHERE id="+literal(job['id']))
    event(('Backup ' if job['kind']=='backup' else 'Local retention ' if job['kind']=='prune' else 'Recovery test ')+status.lower(),job['requestedBy'],{'job':job['id'],**result})
    heartbeat()

if __name__=='__main__':
    import fcntl
    if os.geteuid()!=0: sys.exit('Run as the server operator.')
    os.umask(0o077)
    with open('/run/cubit-backup.lock','w') as lock:
        try: fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError: sys.exit(0)
        cfg=private_config()
        if sys.argv[1:]==['--init-remote']: initialize();restic(['init'],True);print('Encrypted off-server repository initialized.')
        elif not sys.argv[1:]: cycle()
        else: sys.exit('Usage: backup-worker.py [--init-remote]')
