#!/usr/bin/env python3
"""Remove inactive code releases only. Databases, secrets and backups are elsewhere."""
import argparse
import os
from pathlib import Path
import re
import shutil
import sys

RELEASE_NAME = re.compile(r"[a-f0-9]{40}-[0-9]{8}T[0-9]{6}Z")


def plan(root, current):
    root, current = Path(root), Path(current)
    if root.is_symlink() or root.resolve(strict=True) != root or not root.is_dir():
        raise RuntimeError("Release root must be an absolute, real directory")
    if not current.is_symlink():
        raise RuntimeError("Current release must be a symlink")
    active = current.resolve(strict=True)
    if active.parent != root or not active.is_dir() or not RELEASE_NAME.fullmatch(active.name):
        raise RuntimeError("Current release is not a recognized direct child of the release root")
    candidates = []
    for child in sorted(root.iterdir()):
        if child.is_symlink() or not child.is_dir() or not RELEASE_NAME.fullmatch(child.name):
            raise RuntimeError(f"Unrecognized release entry; refusing cleanup: {child.name}")
        if child.resolve(strict=True).parent != root:
            raise RuntimeError("Release path escaped its root")
        if child != active:
            candidates.append(child)
    return active, candidates


def assert_unused(candidates):
    # Refuse any mounted subtree rather than traversing into another filesystem.
    mounts = Path('/proc/self/mountinfo').read_text().splitlines()
    for line in mounts:
        mount = re.sub(r'\\([0-7]{3})', lambda m: chr(int(m[1], 8)), line.split()[4])
        if any(mount == str(p) or mount.startswith(str(p) + '/') for p in candidates):
            raise RuntimeError('An inactive release contains a mount; refusing cleanup')
    for proc in Path('/proc').glob('[0-9]*'):
        try:
            references = [os.readlink(proc / 'cwd'), os.readlink(proc / 'exe')]
            references += (proc / 'cmdline').read_bytes().decode(errors='replace').split('\0')
        except (FileNotFoundError, ProcessLookupError):
            continue
        except PermissionError as error:
            raise RuntimeError('Cannot inspect a running process; refusing cleanup') from error
        if any(str(p) in ref for p in candidates for ref in references):
            raise RuntimeError(f'Process {proc.name} still references an inactive release')


def prune(root, current, apply=False, inspect=assert_unused):
    active, candidates = plan(root, current)
    inspect(candidates)
    print(f'Keep active release: {active}', flush=True)
    print(f'{"Removing" if apply else "Would remove"} {len(candidates)} inactive code releases', flush=True)
    for candidate in candidates:
        # Recheck the current pointer and every target immediately before deleting.
        latest, eligible = plan(root, current)
        if latest != active or candidate not in eligible:
            raise RuntimeError('Release state changed; cleanup stopped')
        if apply:
            inspect([candidate])
            shutil.rmtree(candidate)
        print(f'{"Removed" if apply else "Candidate"}: {candidate.name}', flush=True)
    return len(candidates)


def main():
    import fcntl
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Delete inspected inactive releases')
    parser.add_argument('--under-update-lock', action='store_true', help='Use updater-inherited descriptor 9')
    args = parser.parse_args()
    if os.geteuid() != 0:
        raise RuntimeError('Run with sudo')
    lock_path = '/run/cubit-update.lock'
    if args.under_update_lock:
        stat, inherited = os.stat(lock_path), os.fstat(9)
        if (stat.st_dev, stat.st_ino) != (inherited.st_dev, inherited.st_ino):
            raise RuntimeError('Updater lock descriptor is invalid')
        fcntl.flock(9, fcntl.LOCK_EX | fcntl.LOCK_NB)
        prune('/opt/cubit/releases', '/opt/cubit/current', args.apply)
    else:
        with open(lock_path, 'a') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            prune('/opt/cubit/releases', '/opt/cubit/current', args.apply)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(f'Release cleanup stopped: {error}', file=sys.stderr)
        sys.exit(1)
