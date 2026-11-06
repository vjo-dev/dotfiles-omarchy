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

# Whole-repo Markdown preview in Brave: mkdocs with an inline config (no
# per-project mkdocs.yml needed; nav is inferred from every .md under $PWD).
# See dotfiles docs/research/nvim-markdown-preview.md. Ctrl+C stops it.
mdocs() {
  (sleep 2 && brave --new-window http://127.0.0.1:8765/ >/dev/null 2>&1) &
  printf 'site_name: "%s"\ndocs_dir: "%s"\nsite_dir: "/tmp/mkdocs-preview"\n' \
    "${PWD##*/}" "$PWD" | uvx mkdocs serve -f - -a 127.0.0.1:8765
}

# ssh-agent
export SSH_AUTH_SOCK="$XDG_RUNTIME_DIR/ssh-agent.socket"

# Free Ctrl+T for the herdr prefix (see herdr/.config/herdr/config.toml);
# fzf's file widget moves to Ctrl+G. Ctrl+R (history) and Alt+C (cd) are
# untouched; the `ff` alias is still available as a mouse-free fallback.
bind -r '\C-t' 2>/dev/null
bind -x '"\C-g": fzf-file-widget' 2>/dev/null
