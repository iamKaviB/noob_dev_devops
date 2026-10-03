#!/usr/bin/env bash
# =============================================================================
# deploy.sh — rebuild and restart only the part of the app that changed.
#
#   ./deploy.sh              auto: detect what changed since the last deploy
#   ./deploy.sh backend      force: rebuild only the backend
#   ./deploy.sh frontend     force: rebuild only the frontend
#   ./deploy.sh all          force: rebuild backend + frontend
#
# How "changed" is detected: the script fingerprints (hashes) every source file
# in DockerBackend/ and DockerFe/ and compares with the fingerprint saved at the
# last successful deploy (.deploy-state/). The database is never rebuilt, and
# --no-deps means redeploying one service doesn't restart the others.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")"

STATE_DIR=.deploy-state
mkdir -p "$STATE_DIR"
[ -f .env ] || cp .env.example .env

# Fingerprint a folder, skipping build output / dependencies / IDE files.
fingerprint() {
  find "$1" -type f \
    -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/target/*' \
    -not -path '*/.git/*' -not -path '*/.idea/*' -not -path '*/my-next-app/*' \
    -not -name '.DS_Store' -not -name 'next-env.d.ts' \
    -print0 | sort -z | xargs -0 shasum | shasum | cut -d' ' -f1
}

changed() {  # changed <service> <folder>
  [ "$(cat "$STATE_DIR/$1" 2>/dev/null)" != "$(fingerprint "$2")" ]
}

save() {  # save <service> <folder>
  fingerprint "$2" > "$STATE_DIR/$1"
}

services=()
case "${1:-auto}" in
  backend)  services=(backend) ;;
  frontend) services=(frontend) ;;
  all)      services=(backend frontend) ;;
  auto)
    changed backend  DockerBackend && services+=(backend)
    changed frontend DockerFe      && services+=(frontend)
    ;;
  *) echo "Usage: $0 [backend|frontend|all]"; exit 1 ;;
esac

# The database must be running before backend/frontend can become healthy.
docker compose up -d --wait db

if [ ${#services[@]} -eq 0 ]; then
  echo "✔ Nothing changed since the last deploy. (Use '$0 all' to force.)"
  docker compose up -d --wait   # make sure everything is running anyway
  exit 0
fi

echo "▶ Deploying: ${services[*]}"
docker compose up -d --build --no-deps --wait "${services[@]}"

for s in "${services[@]}"; do
  [ "$s" = backend ] && save backend DockerBackend
  [ "$s" = frontend ] && save frontend DockerFe
done

# Start anything that isn't running yet (e.g. very first deploy).
docker compose up -d --wait
docker compose ps
echo "✔ Deployed: ${services[*]}"
