#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

ensure_pkg ghostty

printf '\nSetting omarchy default terminal...\n'
omarchy default terminal ghostty

printf '\n'
stow_pkg ghostty

printf '\nghostty: done.\n'
