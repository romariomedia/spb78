#!/usr/bin/env python3
"""Conservative release retention. Dry-run by default; no secrets are printed."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys

SHA = re.compile(r'[0-9a-f]{40}')


def ready(path):
    return (not path.is_symlink() and path.is_dir() and SHA.fullmatch(path.name)
            and (path / '.release-ready').is_file()
            and not (path / 'RELEASE_ID').is_symlink()
            and (path / 'RELEASE_ID').read_text().strip() == path.name)


def plan(base, current, previous, history, apps):
    if current.parent != base or not ready(current):
        raise ValueError('Current release is not a ready SHA directory; cleanup skipped')
    protected = {current, previous}
    api = [app for app in apps if app.get('name') == 'sportbuddy-api']
    if len(api) != 1 or api[0].get('pm2_env', {}).get('status') != 'online':
        raise ValueError('API process identity/status is uncertain; cleanup skipped')
    for app in apps:
        env = app.get('pm2_env', {})
        for field in ('pm_cwd', 'pm_exec_path'):
            value = env.get(field)
            if not isinstance(value, str) or not os.path.isabs(value):
                raise ValueError('PM2 process paths are incomplete; cleanup skipped')
            protected.add(Path(value).resolve())
        if env.get('SB_RELEASE_DIR'):
            protected.add(Path(env['SB_RELEASE_DIR']).resolve())
    api_env = api[0]['pm2_env']
    if Path(api_env['pm_cwd']).resolve() != current or Path(api_env['pm_exec_path']).resolve() != current / 'server.js':
        raise ValueError('PM2 and current symlink disagree; cleanup skipped')
    releases = [p for p in base.iterdir() if not p.is_symlink() and SHA.fullmatch(p.name) and ready(p)]
    # Actual activation history takes priority. On first adoption, retain recent ready builds too.
    prior = []
    for p in [previous, *history, *sorted(releases, key=lambda p: (p / '.release-ready').stat().st_mtime, reverse=True)]:
        if p in releases and p != current and p not in prior:
            prior.append(p)
    protected.update(prior[:2])
    candidates = sorted(p for p in releases if not any(p == q or p in q.parents for q in protected))
    return candidates, [current, *prior[:2]]


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--deploy-lock-fd', type=int, help=argparse.SUPPRESS)
    args = parser.parse_args()
    base = Path(os.environ.get('SB_RELEASES_ROOT', '/opt/sportbuddy-releases')).resolve(strict=True)
    state = Path(os.environ.get('SB_DEPLOY_STATE', '/opt/sportbuddy-deploy'))
    link = Path(os.environ.get('SB_CURRENT_LINK', '/opt/sportbuddy-current'))
    state.mkdir(mode=0o700, parents=True, exist_ok=True)
    with (state / 'deploy.lock').open('a') as own_lock, (base / '.prepare.lock').open('a') as prepare_lock:
        lock_fd = args.deploy_lock_fd if args.deploy_lock_fd is not None else own_lock.fileno()
        inherited, owned = os.fstat(lock_fd), os.fstat(own_lock.fileno())
        if (inherited.st_dev, inherited.st_ino) != (owned.st_dev, owned.st_ino):
            raise ValueError('Invalid deployment lock')
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        fcntl.flock(prepare_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if not link.is_symlink():
            raise ValueError('Current link is missing')
        current = link.resolve(strict=True)
        previous = Path((state / 'previous-release').read_text().strip()).resolve(strict=True)
        history_file = state / 'successful-releases.json'
        raw_history = json.loads(history_file.read_text()) if history_file.exists() else []
        if not isinstance(raw_history, list) or any(not isinstance(p, str) or not os.path.isabs(p) for p in raw_history):
            raise ValueError('Invalid release history')
        history = [Path(p).resolve() for p in raw_history]
        apps = json.loads(subprocess.check_output(['pm2', 'jlist'], text=True, timeout=20))
        if not isinstance(apps, list):
            raise ValueError('Invalid PM2 inventory')
        candidates, retained = plan(base, current, previous, history, apps)
        health = json.loads(subprocess.check_output(['curl', '-fsS', '--max-time', '10', 'http://127.0.0.1:3001/api/health'], text=True, timeout=15))
        if health.get('status') != 'ok' or health.get('release') != current.name:
            raise ValueError('Health does not match active release')
        mounts = [Path(re.sub(r'\\([0-7]{3})', lambda m: chr(int(m[1], 8)), line.split()[4])) for line in Path('/proc/self/mountinfo').read_text().splitlines()]
        candidates = [p for p in candidates if not any(m == p or p in m.parents for m in mounts)]
        print('Retained:', ', '.join(p.name for p in retained), '(plus all PM2 paths)')
        for path in candidates:
            print(('Remove: ' if args.apply else 'Would remove: ') + str(path), flush=True)
        if not args.apply:
            print('Dry-run only. Use --apply to remove listed releases.')
            return
        temp = state / f'successful-releases.{os.getpid()}.tmp'
        temp.write_text(json.dumps([str(p) for p in retained]) + '\n')
        temp.chmod(0o600)
        temp.replace(history_file)
        for path in candidates:
            if link.resolve(strict=True) != current or not ready(path):
                raise ValueError('Release state changed; cleanup stopped')
            shutil.rmtree(path)
        print(f'Removed {len(candidates)} old releases. Active release unchanged.')


if __name__ == '__main__':
    try:
        run()
    except Exception:
        # PM2/SDK subprocess output could contain environment secrets; never print exception payloads.
        print('Cleanup skipped or stopped: check locks, PM2 paths, health and release state. Application was not restarted.', file=sys.stderr)
        sys.exit(1)
