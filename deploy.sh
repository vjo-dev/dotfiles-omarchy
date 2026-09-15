#!/usr/bin/env sh

if pacman -Q stow >/dev/null 2>&1; then
  printf '\n==> stow: already installed\n'
else
  printf '\n==> Bootstrap: installing stow...\n'
  yay -S --noconfirm --needed stow
  printf '==> stow installed.\n'
fi

printf '\n==> Deploying my config...\n'

tools="shell ghostty nvim"

failed=""
for tool in $tools; do
  printf '\n----- %s -----\n' "$tool"
  if ! "./scripts/install-$tool.sh"; then
    printf '\nWARNING: install-%s.sh failed, continuing...\n' "$tool" >&2
    failed="$failed $tool"
  fi
done

printf '\n'
if [ -n "$failed" ]; then
  printf '==> Deploy finished with failures:%s\n\n' "$failed" >&2
  exit 1
fi
printf '==> Deploy finished successfully.\n\n'
