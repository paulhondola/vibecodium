#!/usr/bin/env bash
# Idempotent deploy script for VibeCodium.
# Run on the host (Oracle Cloud Ampere A1, Hetzner CX22, etc.) after the
# initial setup (Docker installed, repo cloned, .env filled in).
#
# Usage:  bash scripts/deploy.sh
#
# Steps:
#   1. Fast-forward pull
#   2. Ensure all 6 sandbox images exist; build them if missing
#   3. Rebuild server image and restart the compose stack
#   4. Print status

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if [ ! -f .env ]; then
  echo "✗ .env not found. Copy .env.production.example to .env and fill in values." >&2
  exit 1
fi

echo "→ Pulling latest from origin..."
git pull --ff-only

echo "→ Verifying sandbox images..."
SANDBOX_IMAGES=(
  vibecodium-python
  vibecodium-node
  vibecodium-cpp
  vibecodium-rust
  vibecodium-go
  vibecodium-bun
)
MISSING=0
for img in "${SANDBOX_IMAGES[@]}"; do
  if ! docker image inspect "${img}:latest" >/dev/null 2>&1; then
    echo "  · missing: ${img}:latest"
    MISSING=1
  fi
done
if [ "$MISSING" -eq 1 ]; then
  echo "→ Building missing sandbox images..."
  bash scripts/setup_docker.sh
fi

echo "→ Rebuilding and restarting server..."
docker compose up -d --build

echo
echo "✅ Deployed."
docker compose ps
echo
echo "Smoke test:  curl http://localhost:3000/health"
