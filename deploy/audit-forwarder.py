#!/usr/bin/env python3
"""Durable outbox delivery; never delete source records or remote history."""
import datetime as dt,json,os,pathlib,subprocess,urllib.request,fcntl
CONFIG=pathlib.Path('/etc/cubit-backup/audit.json')
def sql(query):
    return subprocess.check_output(['mysql','--batch','--raw','--skip-column-names','cubit_review','-e',query],timeout=30).decode().strip()
def literal(v):return 'CONVERT(0x'+str(v).encode().hex()+' USING utf8mb4)'
def cycle():
    c=json.loads(CONFIG.read_text());last=sql("SELECT detail FROM backup_runtime WHERE id='audit-vault'");state=json.loads(last) if last else {}
    try:
        sent=0
        for _ in range(10):
            rows=sql("SELECT JSON_OBJECT('queueId',CAST(id AS CHAR),'event',JSON_EXTRACT(payload,'$')) FROM audit_outbox WHERE deliveredAt IS NULL ORDER BY id LIMIT 50")
            if not rows:break
            batch=[];size=0
            for line in rows.splitlines():
                row=json.loads(line);length=len(json.dumps(row['event']).encode())
                if size+length>750000 and batch:break
                batch.append(row);size+=length
            request=urllib.request.Request(c['url'].rstrip('/')+'/audit/append',data=json.dumps([r['event'] for r in batch]).encode(),headers={'Content-Type':'application/json','Authorization':'Bearer '+c['writeToken']},method='POST')
            with urllib.request.urlopen(request,timeout=20) as response:receipt=json.load(response)
            if set(receipt['accepted'])!={r['event']['id'] for r in batch}:raise ValueError('Archive acknowledgment mismatch')
            ids=[str(int(r['queueId'])) for r in batch];sql('UPDATE audit_outbox SET deliveredAt=UTC_TIMESTAMP() WHERE id IN ('+','.join(ids)+')')
            sent+=len(batch);state['receipt']=receipt.get('receipt')
        state.update(ok=True,lastSyncedAt=dt.datetime.now(dt.timezone.utc).isoformat(),message='Audit archive connected',sent=sent)
    except Exception as error:
        state.update(ok=False,message='Audit delivery failed; queued records will retry.');print('Audit archive delivery failed: '+type(error).__name__)
    state['pending']=int(sql('SELECT COUNT(*) FROM audit_outbox WHERE deliveredAt IS NULL'))
    sql("INSERT INTO backup_runtime(id,detail,heartbeat) VALUES ('audit-vault',"+literal(json.dumps(state))+",UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE detail=VALUES(detail),heartbeat=VALUES(heartbeat)")
if __name__=='__main__':
    if os.geteuid()!=0:raise SystemExit('Run as operator')
    os.umask(0o077)
    with open('/run/cubit-audit-forwarder.lock','w') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise SystemExit(0)
        if CONFIG.stat().st_mode&0o077:raise ValueError('Configuration must be private')
        cycle()
