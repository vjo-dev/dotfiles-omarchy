#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

ensure_pkg ghostty

echo "Setting omarchy by default..."
omarchy default terminal ghostty

stow_pkg ghostty

echo "ghostty installed."
