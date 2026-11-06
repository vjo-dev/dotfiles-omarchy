-- SPEC-v2 §4 — navigating. No keymaps here (see plugins/keymaps.lua).

-- File explorer: directories are editable buffers; :w applies the changes.
-- Renames go through the LSP (vtsls updates imports) and save those edits.
require("oil").setup({
	columns = { "icon" },
	keymaps = {
		["<C-h>"] = false, -- stays tmux-navigator's
		["<M-h>"] = "actions.select_split",
	["q"] = "actions.close",
	["<Esc>"] = "actions.close",
	},
	view_options = {
		show_hidden = true,
	},
	lsp_file_methods = {
		enabled = true,
		autosave_changes = true,
	},
	float = {
		max_width = 0.4,
		max_height = 0.6,
		border = "rounded",
	},
})
-- oil-git needs no setup: git status highlights inside oil automatically.

-- which-key: only groups that contain real mappings (fixes SPEC.md wart #11)
local wk = require("which-key")
wk.setup({})
wk.add({
	{ "<leader>f", group = "[F]ind" },
	{ "<leader>g", group = "[G]it" },
	{ "<leader>d", group = "[D]iff" },
	{ "<leader>c", group = "[C]ode" },
	{ "<leader>t", group = "[T]oggle" },
	{ "<leader>y", group = "[Y]ank for agent" },
})

-- vim-tmux-navigator maps <C-h/j/k/l> and <C-\> itself on load (§4.3).
