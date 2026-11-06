-- SPEC-v2 §1.1/§10 — every plugin in ONE vim.pack.add() call, then the group
-- files. confirm = false: installs run unattended (agent-driven workflow).
-- Group files configure plugins; plugins/keymaps.lua (last) holds every
-- plugin-dependent keymap.

local function gh(repo)
	return "https://github.com/" .. repo
end

vim.pack.add({
	-- §2.1 Theme bridge: every colorscheme the installed Omarchy 4 references
	-- (grep of /usr/share/omarchy/themes/*/neovim.lua + themed tpl), preinstalled
	-- so theme switching works instantly and offline. aether pinned to the exact
	-- name/branch Omarchy 4 generates. v1's Omarchy-3.8-only schemes
	-- (monokai-pro, ethereal, vantablack, white, miasma) are cut — unreferenced
	-- here, and monokai-pro's repo no longer exists.
	{ src = gh("bjarneo/aether.nvim"), name = "aether", version = "v3" },
	gh("ribru17/bamboo.nvim"),
	gh("bjarneo/hackerman.nvim"),
	{ src = gh("catppuccin/nvim"), name = "catppuccin" },
	gh("neanias/everforest-nvim"),
	gh("kepano/flexoki-neovim"),
	gh("ellisonleao/gruvbox.nvim"),
	gh("rebelot/kanagawa.nvim"),
	gh("tahayvr/matteblack.nvim"),
	gh("EdenEast/nightfox.nvim"),
	{ src = gh("rose-pine/neovim"), name = "rose-pine" },
	gh("ficcdaf/ashen.nvim"),
	gh("folke/tokyonight.nvim"),
	gh("OldJobobo/retro-82.nvim"),
	gh("omacom-io/lumon.nvim"),

	-- §3 Look & feel
	gh("nvim-mini/mini.icons"),
	gh("nvim-lualine/lualine.nvim"),
	gh("akinsho/bufferline.nvim"),
	gh("folke/snacks.nvim"),
	gh("j-hui/fidget.nvim"),
	gh("nvim-lua/plenary.nvim"), -- todo-comments dependency
	gh("folke/todo-comments.nvim"),
	gh("brenoprata10/nvim-highlight-colors"),
	gh("MeanderingProgrammer/render-markdown.nvim"),
	gh("rachartier/tiny-cmdline.nvim"),

	-- §4 Navigating
	gh("stevearc/oil.nvim"),
	gh("benomahony/oil-git.nvim"),
	gh("christoomey/vim-tmux-navigator"),
	gh("folke/which-key.nvim"),

	-- §5 Syntax
	{ src = gh("nvim-treesitter/nvim-treesitter"), version = "main" },
	gh("windwp/nvim-ts-autotag"),
	gh("nvim-mini/mini.pairs"),
	gh("nvim-mini/mini.ai"),
	gh("nvim-mini/mini.surround"),
	gh("nvim-mini/mini.cursorword"),

	-- §6 Code smarts
	gh("mason-org/mason.nvim"),
	gh("WhoIsSethDaniel/mason-tool-installer.nvim"),
	gh("neovim/nvim-lspconfig"),
	{ src = gh("Saghen/blink.cmp"), version = vim.version.range("^1.0.0") },
	gh("stevearc/conform.nvim"),
	gh("TheLeoP/powershell.nvim"),

	-- §7 Git review deck (vim-dadbod is NOT here: lazy-loaded in plugins/lang.lua)
	gh("lewis6991/gitsigns.nvim"),
	gh("nvim-mini/mini.diff"),
	gh("esmuellert/codediff.nvim"),
}, { confirm = false })

require("plugins.theme")
require("plugins.ui")
require("plugins.nav")
require("plugins.syntax")
require("plugins.lsp")
require("plugins.git")
require("plugins.lang")
require("plugins.keymaps")
