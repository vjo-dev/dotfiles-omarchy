#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

# npm itself is provided by mise (node), so nothing to install here.
printf '\n'
stow_pkg npm

printf '\nnpm: done.\n'
