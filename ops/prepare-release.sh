#!/usr/bin/env bash
# Build a pinned checkout without touching the running application.
set -Eeuo pipefail
umask 077
[[ $# == 3 ]] || { echo 'Usage: bash ops/prepare-release.sh SOURCE_REPO COMMIT_SHA ENV_FILE' >&2; exit 2; }
source_repo=$(realpath "$1")
commit=$2
env_file=$(realpath "$3")
base=${SB_RELEASES_ROOT:-/opt/sportbuddy-releases}
[[ $commit =~ ^[a-f0-9]{40}$ ]] || { echo 'Use the full reviewed commit SHA' >&2; exit 2; }
[[ -r $env_file ]] || { echo 'Environment file is not readable' >&2; exit 2; }
for cmd in git node npm tar flock curl; do command -v "$cmd" >/dev/null; done
node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)' || { echo 'Node 22 or newer is required' >&2; exit 2; }
git -C "$source_repo" cat-file -e "$commit^{commit}"
mkdir -p "$base"
exec 9>"$base/.prepare.lock"
flock -n 9 || { echo 'Another release is being prepared' >&2; exit 1; }
release="$base/$commit"
[[ ! -e $release ]] || { echo 'Release directory already exists; use a new commit or inspect it manually' >&2; exit 1; }
mkdir "$release"
# No git checkout/reset/clean in the live directory.
git -C "$source_repo" archive "$commit" | tar -x -C "$release"
install -m 600 "$env_file" "$release/.env"
cd "$release"
npm ci --include=dev
npm test
npm run build
[[ -s dist/index.html ]]
printf '%s\n' "$commit" > RELEASE_ID
# nginx worker must be able to traverse the release and read static files only.
chmod 755 "$base" "$release"
find dist -type d -exec chmod 755 {} +
find dist -type f -exec chmod 644 {} +
touch .release-ready
printf 'Prepared release: %s\nNo live process or nginx configuration was changed.\n' "$release"
