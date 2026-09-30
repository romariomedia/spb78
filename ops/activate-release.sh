#!/usr/bin/env bash
# nginx must already serve /opt/sportbuddy-current/dist (see RUNBOOK).
set -Eeuo pipefail
umask 077
[[ $# == 1 ]] || { echo 'Usage: bash ops/activate-release.sh /opt/sportbuddy-releases/FULL_SHA' >&2; exit 2; }
release=$(realpath "$1")
current=${SB_CURRENT_LINK:-/opt/sportbuddy-current}
state=${SB_DEPLOY_STATE:-/opt/sportbuddy-deploy}
config=$(realpath "$(dirname "$0")/ecosystem.config.cjs")
for cmd in pm2 curl node flock nginx; do command -v "$cmd" >/dev/null; done
[[ -f "$release/.release-ready" && -s "$release/RELEASE_ID" && -s "$release/dist/index.html" && -r "$release/.env" ]]
[[ -L $current ]] || { echo 'Initialize the current symlink and nginx using RUNBOOK first' >&2; exit 2; }
previous=$(readlink -f "$current")
[[ $previous != "$release" ]] || { echo 'This release is already active'; exit 0; }
[[ -f "$previous/server.js" && -s "$previous/dist/index.html" ]] || { echo 'Previous release is not usable for rollback' >&2; exit 2; }
nginx -t
mkdir -p "$state"
exec 9>"$state/deploy.lock"
flock -n 9 || { echo 'Another activation is running' >&2; exit 1; }
# PM2 snapshots can contain secrets; keep backups private and outside the repository.
stamp=$(date -u +%Y%m%dT%H%M%SZ)
pm2 jlist > "$state/pm2-$stamp.json"
printf '%s\n' "$previous" > "$state/previous-release"
start_api() {
  local target=$1 id=legacy
  if [[ -s "$target/RELEASE_ID" ]]; then id=$(cat "$target/RELEASE_ID"); fi
  # Restarting an existing PM2 name can retain its old pm_exec_path.
  # Remove only this app registration, then recreate it with an explicit cwd.
  if pm2 describe sportbuddy-api >/dev/null 2>&1; then
    pm2 delete sportbuddy-api || return 1
  fi
  SB_RELEASE_DIR="$target" SB_RELEASE_ID="$id" pm2 start "$config" --only sportbuddy-api || return 1
  pm2 jlist | node -e '
    let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{
      try { const e=JSON.parse(s).find(p=>p.name==="sportbuddy-api")?.pm2_env;
        const dir=process.argv[1];
        if (!e || e.pm_exec_path!==dir+"/server.js" || e.pm_cwd!==dir || e.SB_RELEASE_ID!==process.argv[2]) {
          console.error("PM2 process path, cwd or release does not match requested version");process.exit(1);
        }
      } catch {process.exit(1);}
    });
  ' "$target" "$id"
}
health() {
  local expected=$1
  for ((attempt=0; attempt<20; attempt++)); do
    if curl -fsS --max-time 2 http://127.0.0.1:3001/api/health | node -e '
      let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const h=JSON.parse(s);process.exit(h.status==="ok"&&(process.argv[1]==="legacy"||h.release===process.argv[1])?0:1)}catch{process.exit(1)}});
    ' "$expected"; then return 0; fi
    sleep 1
  done
  return 1
}
switch_link() {
  ln -s "$1" "$current.next.$$"
  mv -Tf "$current.next.$$" "$current"
}
rollback() {
  trap - ERR INT TERM
  echo 'Activation failed; restoring previous application' >&2
  switch_link "$previous"
  if start_api "$previous" && health "$(cat "$previous/RELEASE_ID" 2>/dev/null || echo legacy)"; then
    pm2 save
    echo 'Previous release restored' >&2
  else
    echo 'Automatic recovery failed. See private PM2 snapshot and RUNBOOK.' >&2
  fi
  exit 1
}
trap rollback ERR INT TERM
start_api "$release"
health "$(cat "$release/RELEASE_ID")"
switch_link "$release"
pm2 save
trap - ERR INT TERM
printf 'Active: %s\nPrevious: %s\n' "$release" "$previous"
