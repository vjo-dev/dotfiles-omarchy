#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

# pi is installed via mise, not pacman — no ensure_pkg.
if ! command -v pi >/dev/null 2>&1; then
	printf 'NOTE: pi not found on PATH; stowing config anyway.\n' >&2
fi

printf '\n'
# --no-folding, strict allowlist: ~/.pi/agent holds credentials and live
# state alongside config (auth.json, models-store.json, trust.json,
# sessions/, npm/ installs, and extensions/browser/.profile/ — a live
# Chromium profile with session cookies). Only the files present in this
# package are symlinked; everything else in ~/.pi/agent stays untouched on
# disk and is never adopted. npm/ is reinstalled by pi itself from the
# `packages` list in settings.json; it is not tracked here.
stow_pkg pi --no-folding

printf '\npi: done.\n'
