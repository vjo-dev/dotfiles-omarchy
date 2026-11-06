-- Neovim v2 — spec-driven config. The spec is the source of truth:
-- ~/dotfiles/nvim/SPEC-v2.md (build), ~/dotfiles/nvim/SPEC.md (v1 baseline).
vim.loader.enable()

require("config.options")
require("config.keymaps")
require("config.autocmds")
require("config.clipboard")
require("plugins")
