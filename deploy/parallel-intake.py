#!/usr/bin/env python3
"""Forced SSH command: bounded snapshot intake only; no shell/file paths from caller."""
import hashlib,json,os,pathlib,signal,sys,tempfile
ROOT=pathlib.Path('/var/lib/cubit-parallel/inbox')
def main():
    os.umask(0o077);signal.alarm(40)
    data=sys.stdin.buffer.read(64*1024*1024+1)
    if len(data)>64*1024*1024:raise ValueError('Snapshot too large')
    value=json.loads(data)
    if value.get('format')!='cubit-tonic-export' or value.get('complete') is not True:raise ValueError('Incomplete snapshot')
    if len(list(ROOT.iterdir()))>10:raise ValueError('Intake is full; investigate publisher')
    digest=hashlib.sha256(data).hexdigest();target=ROOT/(digest+'.json')
    if not target.exists():
        fd,name=tempfile.mkstemp(prefix='receiving-',dir=ROOT)
        try:
            with os.fdopen(fd,'wb') as output:output.write(data);output.flush();os.fsync(output.fileno())
            os.replace(name,target)
        finally:
            if os.path.exists(name):os.unlink(name)
    print(digest)
if __name__=='__main__':
    try:main()
    except Exception:print('Snapshot intake rejected',file=sys.stderr);sys.exit(1)
