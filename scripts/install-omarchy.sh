#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

# Omarchy itself is the distro, so no ensure_pkg here. This package only
# manages branding files (e.g. the "VJO-DEV" screensaver ASCII art).

printf '\n'
# --no-folding: ~/.config/omarchy must stay a real directory (omarchy owns
# sibling files like shell.json and branding/about.txt); only
# branding/screensaver.txt is symlinked from this package.
stow_pkg omarchy --no-folding

# Re-render the screensaver so a running session picks up the new art.
# Harmless if the screensaver isn't active; ignore failure on headless runs.
omarchy-launch-screensaver force >/dev/null 2>&1 || true

printf '\nomarchy: done.\n'
