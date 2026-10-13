# Omarchy environment (OMARCHY_PATH + PATH), needed even for non-interactive shells
[[ -r /usr/share/omarchy/default/bash/env-bootstrap ]] && source /usr/share/omarchy/default/bash/env-bootstrap

# If not running interactively, don't do anything else (leave this above the rc source)
[[ $- != *i* ]] && return

# All the default Omarchy aliases and functions
# (don't mess with these directly, just overwrite them here!)
source "$OMARCHY_PATH/default/bash/rc"

# Python dev env
. "$HOME/.local/share/../bin/env"

###### ALIASES
alias vim='nvim'

# ssh-agent
export SSH_AUTH_SOCK="$XDG_RUNTIME_DIR/ssh-agent.socket"

# Free Ctrl+T for the herdr prefix (see herdr/.config/herdr/config.toml);
# fzf's file widget moves to Ctrl+G. Ctrl+R (history) and Alt+C (cd) are
# untouched; the `ff` alias is still available as a mouse-free fallback.
bind -r '\C-t' 2>/dev/null
bind -x '"\C-g": fzf-file-widget' 2>/dev/null
