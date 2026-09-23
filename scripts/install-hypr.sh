#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

# Hyprland itself ships with omarchy, so no ensure_pkg here.

printf '\n'
# --no-folding: ~/.config/hypr must stay a real directory (omarchy owns the
# sibling files there, e.g. hyprland.lua, monitors.lua); only bindings.lua
# is symlinked from this package.
stow_pkg hypr --no-folding

printf '\nhypr: done.\n'
