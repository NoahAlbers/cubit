#!/usr/bin/env python3
"""Source-side read-only export and one-way push. Compatible with Ubuntu 18 Python 3.6.
Installed OUTSIDE Tonic's watched volume. No application HTTP endpoints are used.
"""
import fcntl, hashlib, json, os, pathlib, subprocess, tempfile, time

ROOT=pathlib.Path('/opt/cubit-export')
STATE=pathlib.Path('/var/lib/cubit-export')
def main():
    os.umask(0o077)
    config=ROOT/'source.json'
    if config.stat().st_uid!=0 or config.stat().st_mode&0o077: raise ValueError('Source configuration must be root-only')
    c=json.loads(config.read_text())
    if c['database']['DATABASE_USERNAME']!='cubit_export' or c['database']['DATABASE_URI']!='mysql':raise ValueError('Restricted exporter required')
    with (STATE/'export.lock').open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        started=time.monotonic()
        # Data passed through stdin, never credentials in process arguments/history.
        script='process.env.CUBIT_EXPORT_CONFIG_JSON='+json.dumps(json.dumps(c['database']))+';\n'+(ROOT/'export-legacy-data.cjs').read_text()
        with tempfile.TemporaryFile() as output, tempfile.TemporaryFile() as errors:
            result=subprocess.run(['docker','exec','-i','-w','/Tonic/TonicServices','Tonic','node','-'],input=script.encode(),stdout=output,stderr=errors,timeout=45)
            if result.returncode:raise RuntimeError('Restricted snapshot export failed')
            size=output.tell()
            if size>64*1024*1024:raise RuntimeError('Snapshot exceeds size limit')
            output.seek(0);data=output.read();snapshot=json.loads(data.decode())
            if snapshot.get('complete') is not True:raise RuntimeError('Incomplete snapshot')
        checksum=hashlib.sha256(data).hexdigest()
        result=subprocess.run(['ssh','-i',str(ROOT/'push_key'),'-o','BatchMode=yes','-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=yes','-o','UserKnownHostsFile='+str(ROOT/'known_hosts'),'-o','ConnectTimeout=10',c['destination'],'receive'],input=data,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=45)
        if result.returncode or result.stdout.decode().strip()!=checksum:raise RuntimeError('Snapshot delivery not acknowledged')
        state={'lastDelivered':snapshot['source']['snapshotUtc'],'sha256':checksum,'bytes':size,'durationSeconds':round(time.monotonic()-started,3),'counts':snapshot['counts']}
        temp=STATE/'status.tmp';temp.write_text(json.dumps(state));temp.replace(STATE/'status.json')
        print(json.dumps(state))
if __name__=='__main__':main()
