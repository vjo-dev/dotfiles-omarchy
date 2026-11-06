-- SPEC-v2 §7 — the git review deck. No keymaps here (plugins/keymaps.lua).

-- §7.1 Gutter signs, staging, blame (keymaps give it hands, fixes wart #12)
require("gitsigns").setup({})

-- §7.2 In-file overlay of what changed. Its own mappings are disabled:
-- staging stays gitsigns' job, mini.diff only provides the overlay view.
require("mini.diff").setup({
	view = { style = "sign" },
	mappings = {
		apply = "",
		reset = "",
		textobject = "",
		goto_first = "",
		goto_prev = "",
		goto_next = "",
		goto_last = "",
	},
})

-- §7.3 Side-by-side review workspace for large agent changesets.
-- Downloads its prebuilt diff library on first use.
require("codediff").setup({
	explorer = {
		view_mode = "tree",
		line_stats = { enabled = true }, -- per-file +/- counts
	},
})

-- §7.4 lazygit opens through Snacks.lazygit() (configured in plugins/ui.lua);
-- its own config lives outside Neovim in ~/.config/lazygit/config.yml.
