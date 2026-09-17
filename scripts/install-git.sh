#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

ensure_pkg git

pkg_dir="$REPO_DIR/git/.config/git"
needs_identity=0
if [ ! -e "$pkg_dir/config.local" ]; then
	say "git: seeding config.local from config.local.example..."
	cp "$pkg_dir/config.local.example" "$pkg_dir/config.local"
	needs_identity=1
fi

printf '\n'
# --no-folding: keep ~/.config/git a real dir (not a single symlink to the
# repo), so config.local.example / .stow-local-ignore stay repo-only.
stow_pkg git --no-folding

if [ "$needs_identity" = 1 ]; then
	printf '\nACTION REQUIRED: set this machine'\''s email in %s\n' \
		"$pkg_dir/config.local" >&2
fi

printf '\ngit: done.\n'
