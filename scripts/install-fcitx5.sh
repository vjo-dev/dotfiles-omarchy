#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

# fcitx5 ships with Omarchy; this only deploys config (disables word-hint mode).
stow_pkg fcitx5

# Reload config if fcitx5 is running.
if pgrep -x fcitx5 >/dev/null 2>&1; then
	fcitx5-remote -r
	say "fcitx5: config reloaded."
fi

printf '\nfcitx5: done.\n'
