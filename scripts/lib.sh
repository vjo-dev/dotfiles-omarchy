#!/usr/bin/env bash
# Shared helpers for dotfile deployment.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# What to do on a stow conflict when no terminal is available to ask:
# adopt | backup | skip. deploy.sh exports it; backup is the default.
CONFLICT_MODE="${CONFLICT_MODE:-backup}"

# Exit code meaning "package skipped on purpose" (deploy.sh treats it
# as informational, not as a failure).
SKIP_EXIT=3

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

# Extract conflicting target paths (relative to $HOME) from stow's output.
conflict_paths() {
	sed -n \
		-e 's/.*existing target \([^ ]*\) since.*/\1/p' \
		-e 's/.*existing target is [^:]*: \(.*\)$/\1/p' |
		sort -u
}

# Map a conflict path to the top-level unit to back up:
#   .config/ghostty/config -> .config/ghostty
#   .bashrc                -> .bashrc
backup_unit() {
	local path="$1"
	case "$path" in
	.config/*/*) printf '%s\n' "$path" | cut -d/ -f1-2 ;;
	*) printf '%s\n' "${path%%/*}" ;;
	esac
}

# Ask the user how to resolve a conflict. Falls back to $CONFLICT_MODE
# when no terminal is available (e.g. CI). Prints: adopt | backup | skip.
ask_conflict_choice() {
	local choice
	if (exec </dev/tty >/dev/tty) 2>/dev/null; then
		while :; do
			{
				printf '  [a] adopt  - move the existing files INTO the repo, then stow\n'
				printf '  [b] backup - move existing to <path>.bak-<timestamp>, then stow\n'
				printf '  [s] skip   - leave everything as is, continue with next package\n'
				printf 'Choice [a/b/s] (default: b): '
			} >/dev/tty
			IFS= read -r choice </dev/tty || choice=s
			case "$choice" in
			a | A) echo adopt; return ;;
			b | B | "") echo backup; return ;;
			s | S) echo skip; return ;;
			esac
			printf 'Please answer a, b or s.\n' >/dev/tty
		done
	else
		say "no terminal available, defaulting to '$CONFLICT_MODE'" >&2
		echo "$CONFLICT_MODE"
	fi
}

# Deploy a stow package into $HOME. Idempotent via --restow.
# On conflict, offers to adopt, backup or skip (exit $SKIP_EXIT).
stow_pkg() {
	local pkg="$1"
	local output conflicts choice
	say "stowing '$pkg'..."
	if output="$(cd "$REPO_DIR" && stow -n --restow "$pkg" 2>&1)"; then
		(cd "$REPO_DIR" && stow --restow "$pkg")
		say "'$pkg' stowed."
		return 0
	fi

	conflicts="$(printf '%s\n' "$output" | conflict_paths)"
	if [ -z "$conflicts" ]; then
		printf 'ERROR: stow failed for %s:\n%s\n' "$pkg" "$output" >&2
		exit 1
	fi

	say ""
	say "Conflict for package '$pkg':"
	local c
	while IFS= read -r c; do
		say "  ~/$c already exists and is not managed by stow"
	done <<<"$conflicts"

	choice="$(ask_conflict_choice)"
	case "$choice" in
	adopt)
		say "adopting existing files into the repo..."
		(cd "$REPO_DIR" && stow --adopt --restow "$pkg")
		say "'$pkg' stowed (adopted)."
		say "NOTE: repo files for '$pkg' were replaced by your local ones."
		say "      Review with: git -C $REPO_DIR diff -- $pkg"
		;;
	backup)
		local ts units unit
		ts="$(date +%Y%m%d-%H%M%S)"
		units="$(while IFS= read -r c; do backup_unit "$c"; done <<<"$conflicts" | sort -u)"
		while IFS= read -r unit; do
			say "backing up ~/$unit -> ~/$unit.bak-$ts"
			mv "$HOME/$unit" "$HOME/$unit.bak-$ts"
		done <<<"$units"
		(cd "$REPO_DIR" && stow --restow "$pkg")
		say "'$pkg' stowed (existing config backed up)."
		;;
	skip)
		say "skipping package '$pkg'."
		exit "$SKIP_EXIT"
		;;
	*)
		printf 'ERROR: unknown conflict mode: %s\n' "$choice" >&2
		exit 1
		;;
	esac
}
