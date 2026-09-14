#!/usr/bin/env bash
# Template: copy to scripts/install-<tool>.sh and replace "example" with your tool.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

ensure_pkg example

# Optional: configure the tool here, e.g. omarchy default terminal example.

stow_pkg example

echo "example installed."