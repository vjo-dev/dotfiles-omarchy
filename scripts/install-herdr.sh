#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

ensure_pkg herdr

printf '\n'
# --no-folding: ~/.config/herdr must stay a real directory — herdr keeps
# live runtime state there (herdr.sock, herdr-client.sock, *.log,
# session.json, session-snapshots/, .plugins.lock, release-notes.json);
# only config.toml is symlinked from this package.
stow_pkg herdr --no-folding

printf '\nherdr: done.\n'
