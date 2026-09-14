#!/usr/bin/env bash
# Shared helpers for dotfile deployment.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() { printf '%s\n' "$*"; }

is_installed() {
	pacman -Q "$1" >/dev/null 2>&1
}

ensure_pkg() {
	local pkg="$1"
	if is_installed "$pkg"; then
		say "$pkg: already installed"
		return 0
	fi
	say "installing $pkg..."
	yay -S --noconfirm --needed "$pkg"
}

# Deploy a stow package into $HOME. Idempotent via --restow.
# On failure (e.g. an existing non-symlink file/dir in the way), prints
# stow's output as a warning and returns non-zero: fix manually, re-run.
stow_pkg() {
	local pkg="$1"
	local output
	say "stowing '$pkg'..."
	if ! output="$(cd "$REPO_DIR" && stow --restow "$pkg" 2>&1)"; then
		printf 'WARNING: could not stow %s, fix manually and re-run:\n%s\n' \
			"$pkg" "$output" >&2
		return 1
	fi
	say "'$pkg' stowed."
}
