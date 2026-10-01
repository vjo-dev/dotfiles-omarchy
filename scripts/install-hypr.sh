#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$SCRIPT_DIR/lib.sh"

# Hyprland itself ships with omarchy, so no ensure_pkg here.
ensure_pkg ydotool

# ydotoold, the daemon the `ydotool` client talks to, needs /dev/uinput. The
# package's udev rule (80-uinput.rules) gives that device to group "input", but
# its post_install only prints a reminder instead of adding the user, so do it
# here. Group membership only lands on a new login.
if id -nG | tr ' ' '\n' | grep -qx input; then
	say "input group: already a member"
else
	if sudo usermod -aG input "$USER"; then
		say "input group: added $USER"
		printf 'NOTE: log out and back in so the input group takes effect.\n' >&2
	else
		printf 'ACTION REQUIRED: run `sudo usermod -aG input %s`, then log out and back in\n' \
			"$USER" >&2
	fi
fi

# Without the daemon the scroll binds die silently: Hyprland drops the exit
# status of a failing exec bind, so the keys just stop scrolling.
if systemctl --user enable --now ydotool.service; then
	say "ydotool.service: enabled and started"
else
	printf 'ACTION REQUIRED: run `systemctl --user enable --now ydotool.service`\n' >&2
fi

if ! systemctl --user is-active --quiet ydotool.service; then
	printf 'ydotool.service is not running; see `systemctl --user status ydotool`\n' >&2
fi

printf '\n'
# --no-folding: ~/.config/hypr must stay a real directory (omarchy owns the
# sibling files there, e.g. hyprland.lua, monitors.lua); only bindings.lua
# is symlinked from this package. ~/.local/bin/ydotool-scroll, which the
# scroll binds call, is still symlinked as usual.
stow_pkg hypr --no-folding

printf '\nhypr: done.\n'
