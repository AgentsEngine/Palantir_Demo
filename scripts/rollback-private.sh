#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <IMAGE_TAG> [--env .env] [--compose docker/docker-compose.release.yml]" >&2
  exit 2
fi

TARGET_TAG="$1"
shift
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker/docker-compose.release.yml}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env) ENV_FILE="$2"; shift 2 ;;
    --compose) COMPOSE_FILE="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

python - "$ENV_FILE" "$TARGET_TAG" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
tag = sys.argv[2]
lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
found = False
out = []
for line in lines:
    if line.startswith("IMAGE_TAG="):
        out.append(f"IMAGE_TAG={tag}")
        found = True
    else:
        out.append(line)
if not found:
    out.append(f"IMAGE_TAG={tag}")
path.write_text("\n".join(out) + "\n", encoding="utf-8")
PY

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull backend frontend
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d backend frontend
python "$ROOT/scripts/doctor.py" --env "$ENV_FILE" --compose "$COMPOSE_FILE" --wait 60
