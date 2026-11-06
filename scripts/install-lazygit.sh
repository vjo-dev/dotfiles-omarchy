#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

ensure_pkg lazygit
ensure_pkg git-delta

printf '\n'
stow_pkg lazygit

printf '\nlazygit: done.\n'
