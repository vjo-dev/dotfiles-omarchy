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
# Material theme + superfences so ```mermaid blocks render as diagrams.
# Picks the first free port from 8765 up, so several projects can run at
# once; `mdocs 9000` forces a port. Ctrl+C stops it.
# See dotfiles docs/research/nvim-markdown-preview.md.
mdocs() {
  local port="${1:-8765}"
  if [[ -z "$1" ]]; then
    while (echo > "/dev/tcp/127.0.0.1/$port") 2>/dev/null; do
      port=$((port + 1))
    done
  fi
  echo "mdocs: serving ${PWD##*/} on http://127.0.0.1:$port/"
  (sleep 2 && brave --new-window "http://127.0.0.1:$port/" >/dev/null 2>&1) &
  uvx --with mkdocs-material mkdocs serve -f - -a "127.0.0.1:$port" <<EOF
site_name: "${PWD##*/}"
docs_dir: "$PWD"
site_dir: "/tmp/mkdocs-preview"
theme:
  name: material
markdown_extensions:
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
EOF
}

# Blinking block cursor (DECSCUSR 1) at every prompt. Ghostty blinks by
# default, but herdr forwards each pane's requested cursor style (steady
# block) to the host terminal, so the shell has to ask for blink itself.
PROMPT_COMMAND="${PROMPT_COMMAND:+$PROMPT_COMMAND; }printf '\\e[1 q'"

# ssh-agent
export SSH_AUTH_SOCK="$XDG_RUNTIME_DIR/ssh-agent.socket"

# Free Ctrl+T for the herdr prefix (see herdr/.config/herdr/config.toml);
# fzf's file widget moves to Ctrl+G. Ctrl+R (history) and Alt+C (cd) are
# untouched; the `ff` alias is still available as a mouse-free fallback.
bind -r '\C-t' 2>/dev/null
bind -x '"\C-g": fzf-file-widget' 2>/dev/null
