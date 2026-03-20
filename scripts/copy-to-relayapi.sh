#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_DEST="$(cd "${SOURCE_DIR}/.." && pwd)/relayAPI"

DEST_DIR="${DEFAULT_DEST}"
DRY_RUN=0
DELETE_MODE=0

usage() {
  cat <<'EOF'
Usage:
  ./scripts/copy-to-relayapi.sh [destination] [--dry-run] [--delete]

Description:
  Sync this project into ../relayAPI by default, while skipping dependencies,
  build artifacts, caches, logs, local env files, and generated temp files.

Options:
  --dry-run   Show what would be copied without making changes
  --delete    Delete files in destination that no longer exist in source
  -h, --help  Show this help message

Examples:
  ./scripts/copy-to-relayapi.sh
  ./scripts/copy-to-relayapi.sh --dry-run
  ./scripts/copy-to-relayapi.sh ../relayAPI --delete
EOF
}

while (($# > 0)); do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --delete)
      DELETE_MODE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      DEST_DIR="$1"
      shift
      ;;
  esac
done

mkdir -p "${DEST_DIR}"

RSYNC_ARGS=(
  -av
  --human-readable
  --exclude=.git/
  --exclude=node_modules/
  --exclude=dist/
  --exclude=coverage/
  --exclude=.vite/
  --exclude=.cache/
  --exclude=.eslintcache
  --exclude=playwright-report/
  --exclude=test-results/
  --exclude=__pycache__/
  --exclude=*.log
  --exclude=.DS_Store
  --exclude=.env
  --exclude=.env.example
  --exclude=.env.local
  --exclude=.env.*
  --exclude=scripts/.generated/
  --exclude=public/APIreview.html
  --exclude=public/api-review-assets/
)

if [[ "${DRY_RUN}" -eq 1 ]]; then
  RSYNC_ARGS+=(--dry-run --itemize-changes)
fi

if [[ "${DELETE_MODE}" -eq 1 ]]; then
  RSYNC_ARGS+=(--delete)
fi

printf 'Source: %s\n' "${SOURCE_DIR}"
printf 'Destination: %s\n' "${DEST_DIR}"

if [[ "${DRY_RUN}" -eq 1 ]]; then
  printf 'Mode: dry-run\n'
fi

if [[ "${DELETE_MODE}" -eq 1 ]]; then
  printf 'Delete mode: enabled\n'
fi

rsync "${RSYNC_ARGS[@]}" "${SOURCE_DIR}/" "${DEST_DIR}/"
