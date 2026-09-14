#!/usr/bin/env bash
# Shared helpers for dotfile deployment.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

say() { printf '%s\n' "$*"; }
die() {
	printf 'ERROR: %s\n' "$*" >&2
	exit 1
}

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

# Deploy a stow package into $STOW_TARGET. Idempotent via --restow.
stow_pkg() {
	local pkg="$1"
	local output
	say "stowing '$pkg'..."
	if ! output="$(cd "$REPO_DIR" && stow "$pkg" --restow 2>&1)"; then
		say "$output"
		die "Existing folder: package ${pkg} was not deployed."
	fi
}
