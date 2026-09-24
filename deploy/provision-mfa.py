#!/usr/bin/env python3
"""Provision missing service MFA encryption keys without displaying secrets."""
import os
import re
import secrets
from pathlib import Path

def main():
    if os.geteuid() != 0:
        raise SystemExit('Run as the deployment operator.')
    for name in ('review', 'demo'):
        path = Path('/etc/cubit') / (name + '.env')
        if not path.exists():
            continue
        if path.is_symlink() or not path.is_file():
            raise SystemExit('Refusing an unexpected environment-file target.')
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
