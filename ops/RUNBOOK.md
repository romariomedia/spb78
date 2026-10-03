# SportBuddy VPS release procedure

These scripts prepare and activate code; they never modify Firestore data.
They do not claim that uploads, payments or Firebase are healthy. The health
endpoint verifies process startup, required route imports and release identity.
Run as the same Unix user that owns the existing PM2 process (currently root).
Node >=22, npm, git, curl, flock, nginx and PM2 must already be installed.

## 1. Inspect and back up the existing VPS before the first migration

Do not pull into the dirty live checkout, run git clean, reset it or remove .env.
Keep the original /opt/sportbuddy-api as the first rollback target.
Run the following on the VPS; never post the backup contents in chat:

```bash
umask 077
backup=/root/sportbuddy-backup-$(date -u +%Y%m%dT%H%M%SZ)
mkdir "$backup"
cp -a /opt/sportbuddy-api/.env "$backup/env"
cp -a /etc/nginx "$backup/nginx"
pm2 jlist > "$backup/pm2.json"
pm2 save
cp -a /root/.pm2/dump.pm2 "$backup/dump.pm2"
tar -czf "$backup/live-app.tar.gz" -C /opt sportbuddy-api
```

The full copy needs disk space and includes dependencies, local modifications
and secrets. Verify free space and that the tar command succeeded. Keep it private.
For database backup use Firebase's configured export/backup procedure separately.
No database schema migration is part of this deployment.

## 2. Obtain the reviewed revision in a separate clone

Use the existing GitHub credentials on the VPS. Never place a token in commands
or a remote URL. Example (if the source clone does not yet exist):

```bash
git clone --branch main https://github.com/romariomedia/spb78.git /opt/sportbuddy-source
cd /opt/sportbuddy-source
git log -1 --oneline
```

Актуальная линия — `main`. Деплой всегда делается из проверенного коммита, поэтому если работа
шла в отдельной ветке, сначала влейте её в `main` (или используйте её коммит напрямую).

Choose and record the FULL 40-character reviewed commit SHA, not a moving branch.
Substitute it below:

```bash
bash ops/prepare-release.sh /opt/sportbuddy-source FULL_COMMIT_SHA /opt/sportbuddy-api/.env
```

This creates /opt/sportbuddy-releases/FULL_COMMIT_SHA, copies .env privately,
runs npm ci, tests and build, and writes .release-ready only after success.
A failure leaves an inactive directory for diagnosis; it never changes the live
app. Do not upload .env or logs containing secrets. Ensure the production .env
has the correct VITE_* build configuration before preparing the release.

## 3. One-time nginx migration (before activating the first release)

Identify the actual HTTPS server block for sportbuddy78.pro with nginx -T locally.
Do not replace the complete nginx configuration or its TLS/API proxy sections.
Confirm its existing static root is /opt/sportbuddy-api/dist, as expected.

Create a symlink only if /opt/sportbuddy-current does not already exist:

```bash
ln -s /opt/sportbuddy-api /opt/sportbuddy-current
```

In that server block change only the static root to:

```nginx
root /opt/sportbuddy-current/dist;
```

Preserve existing SPA fallback, /api proxy to 127.0.0.1:3001, TLS and limits.
Check nginx symlink restrictions and worker read/traverse permissions. Then:

```bash
nginx -t && systemctl reload nginx
curl -fsS https://sportbuddy78.pro/api/health
curl -fsS -o /dev/null https://sportbuddy78.pro/
```

At this stage the original app is still served. If either request fails, restore
the backed-up nginx configuration and investigate before activating anything.

## 4. Activate

```bash
cd /opt/sportbuddy-source
bash ops/activate-release.sh /opt/sportbuddy-releases/FULL_COMMIT_SHA
curl -fsS https://sportbuddy78.pro/api/health
curl -fsS -o /dev/null https://sportbuddy78.pro/
pm2 logs sportbuddy-api --lines 30 --nostream
```

The script locks deployment, saves a private PM2 inventory and previous target,
recreates only the sportbuddy-api process registration using explicit script/cwd, checks the release SHA in localhost
health, atomically switches static files, then saves PM2 state. Expect a short
API interruption with one fork-mode process. It does not reload nginx per release.
On activation failure it restores both the previous symlink and API process.
Public checks above are essential: local health cannot test DNS/TLS/nginx.
If a public or functional check fails after activation, roll back immediately.
Existing open browser tabs may need reload after assets change; old release
folders are retained, but nginx only serves assets from the active release.

## 5. Rollback

Read /opt/sportbuddy-deploy/previous-release and record its path before another
activation overwrites that marker. For a previously prepared release, use the
same activation command with that previous directory.

The initial legacy checkout has no .release-ready marker. To restore it manually:

```bash
pm2 delete sportbuddy-api
SB_RELEASE_DIR=/opt/sportbuddy-api SB_RELEASE_ID=legacy pm2 start /opt/sportbuddy-source/ops/ecosystem.config.cjs --only sportbuddy-api --update-env
curl -fsS http://127.0.0.1:3001/api/health
ln -s /opt/sportbuddy-api /opt/sportbuddy-current.rollback
mv -Tf /opt/sportbuddy-current.rollback /opt/sportbuddy-current
pm2 save
```

If process configuration differs from the known single-node setup, use the saved
PM2 dump and original configuration instead. A code rollback does not roll back
user data, payments, new medals or other writes already made.

## Acceptance on two real devices

- Email and VK: sign in, sign out, same account after re-entry.
- Photo + portfolio: verification, trial Premium, persisted profile.
- Training preference: allowed signup, denied signup, cancellation, capacity.
- Friends/matches, chat, image/video post with server-confirmed state.
- Daily medal: reload and second device do not duplicate; profile ranks agree.
- Earned promo appears on another device; test payment/webhook without real charge.

No public release is approved solely by unit tests or /api/health.

## PM2 path retention fix

The first VPS activation restarted the legacy script under its existing PM2
name. startOrRestart is no longer used: registration for sportbuddy-api alone
is removed and recreated, then pm_exec_path, pm_cwd and release ID are checked.
The same procedure applies during recovery. Other PM2 applications are untouched.

Validation: 55 tests pass, including isolated activation/recovery simulations.
An additional attempt to run real PM2 7.0.4 locally was blocked by Unix-socket
permissions (EPERM), so this is not claimed as a successful live PM2 test.
The first real activation must still be checked using public health and PM2 paths.
