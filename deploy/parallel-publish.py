#!/usr/bin/env python3
"""CRM operator worker. Publishes received files with separate writer credentials."""
import fcntl,hashlib,json,os,pathlib,subprocess,time
ROOT=pathlib.Path('/var/lib/cubit-parallel')
def main():
    os.umask(0o077)
    with (ROOT/'publish.lock').open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        for file in sorted((ROOT/'inbox').glob('*.json'),key=lambda p:p.stat().st_mtime):
            if file.is_symlink() or not file.is_file() or file.stat().st_size>64*1024*1024:raise ValueError('Invalid intake file')
            content=file.read_bytes()
            if file.stem!=hashlib.sha256(content).hexdigest():raise ValueError('Intake checksum mismatch')
            # Move out of intake before root publisher reads it; intake cannot modify custody.
            owned=ROOT/'processing'/file.name;file.replace(owned);owned.chmod(0o600);os.chown(owned,0,0)
            started=time.monotonic()
            p=subprocess.run(['/usr/local/bin/node','/opt/cubit/current/dev/import-parallel-snapshot.cjs','import','/etc/cubit-parallel/writer.json',str(owned)],capture_output=True,timeout=90)
            status='published' if p.returncode==0 else 'rejected'
            owned.replace(ROOT/status/file.name)
            # Importer emits counts/status only, never raw records or secrets.
            print(json.dumps({'file':file.stem,'status':status,'durationSeconds':round(time.monotonic()-started,3)}),flush=True)
            if p.returncode:print('Import rejected; see snapshot history.',flush=True)
        for folder in ['published','rejected']:
            files=sorted((ROOT/folder).glob('*.json'),key=lambda p:p.stat().st_mtime,reverse=True)
            for file in files[3:]:file.unlink()
if __name__=='__main__':main()
