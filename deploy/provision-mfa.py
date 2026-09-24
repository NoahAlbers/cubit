#!/usr/bin/env python3
"""Provision missing service MFA encryption keys without displaying secrets."""
import os
import re
import secrets
from pathlib import Path

def main():
    if os.geteuid() != 0:
        raise SystemExit('Run as the deployment operator.')
    for name, filename in (('review', '/etc/cubit/review.env'), ('demo', '/etc/cubit-demo/demo.env')):
        path = Path(filename)
        if not path.exists():
            continue
        if path.is_symlink() or not path.is_file():
            raise SystemExit('Refusing an unexpected environment-file target.')
        if path.stat().st_uid != 0 or path.stat().st_mode & 0o027:
            raise SystemExit('Environment files must be root-owned, not group-writable or world-accessible.')
        text = path.read_text()
        existing = re.findall(r'^MFA_ENCRYPTION_KEY=(.*)$', text, re.MULTILINE)
        if existing:
            if len(existing) != 1 or not re.fullmatch('[a-fA-F0-9]{64}', existing[0].strip()):
                raise SystemExit('Existing MFA key configuration needs operator review; it was not replaced.')
            print(name + ': existing key retained')
            continue
        with path.open('a') as target:
            target.write('\nMFA_ENCRYPTION_KEY=' + secrets.token_hex(32) + '\n')
        print(name + ': private key provisioned; external custody remains required')

if __name__ == '__main__':
    main()
