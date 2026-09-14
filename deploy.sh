#!/usr/bin/env sh

if pacman -Q stow >/dev/null 2>&1; then
	printf '\n==> stow: already installed\n'
else
	printf '\n==> Bootstrap: installing stow...\n'
	yay -S --noconfirm --needed stow
	printf '==> stow installed.\n'
fi

printf '\n==> Deploying my config...\n'

tools="ghostty nvim"

# Conflict resolution when no terminal is available to ask:
# adopt | backup | skip (interactive runs always prompt).
CONFLICT_MODE=backup
export CONFLICT_MODE

failed=""
skipped=""
for tool in $tools; do
	printf '\n----- %s -----\n' "$tool"
	if "./scripts/install-$tool.sh"; then
		:
	else
		rc=$?
		if [ "$rc" -eq 3 ]; then
			skipped="$skipped $tool"
		else
			printf '\nWARNING: install-%s.sh failed, continuing...\n' "$tool" >&2
			failed="$failed $tool"
		fi
	fi
done

printf '\n'
if [ -n "$skipped" ]; then
	printf '==> Skipped:%s\n' "$skipped"
fi
if [ -n "$failed" ]; then
	printf '==> Deploy finished with failures:%s\n\n' "$failed" >&2
	exit 1
fi
printf '==> Deploy finished successfully.\n\n'
