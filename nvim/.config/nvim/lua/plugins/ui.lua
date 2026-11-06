-- SPEC-v2 §3 — look & feel. No keymaps here (see plugins/keymaps.lua).

-- Single icon source; mock nvim-web-devicons for lualine/bufferline.
require("mini.icons").setup()
MiniIcons.mock_nvim_web_devicons()

-- Other occurrences of the word under the cursor (textual, no LSP needed)
require("mini.cursorword").setup()

-- snacks: notifier (vim.notify), indent guides, bigfile, picker (§4),
-- lazygit float (§7.4). Smooth scroll and words stay off.
require("snacks").setup({
	bigfile = { enabled = true },
	notifier = { enabled = true },
	indent = { enabled = true },
	picker = { ui_select = true }, -- also replaces vim.ui.select
	lazygit = {}, -- theme synced to the active colorscheme by default
	scroll = { enabled = false },
	words = { enabled = false }, -- mini.cursorword covers this without LSP
})

-- LSP progress spinner
require("fidget").setup({})

-- Global statusline, theme follows the Omarchy theme bridge (fixes v1's
-- hardcoded nightfly, SPEC.md wart #10).
vim.o.showmode = false -- lualine shows the mode
require("lualine").setup({
	options = {
		theme = "auto",
		icons_enabled = true,
		section_separators = { left = "", right = "" },
		component_separators = { left = "", right = "" },
		globalstatus = true,
	},
	sections = {
		lualine_a = { "mode" },
		lualine_b = { "branch" },
		lualine_c = { { "filename", file_status = true, path = 1 } },
		lualine_x = {
			{
				"diagnostics",
				sources = { "nvim_diagnostic" },
				symbols = { error = " ", warn = " ", info = " ", hint = " " },
			},
			"encoding",
			"filetype",
		},
		lualine_y = { "progress" },
		lualine_z = { "location" },
	},
})

-- Buffers as tabs (kept v1 habit; keymaps in plugins/keymaps.lua)
require("bufferline").setup({})

-- TODO/FIXME highlighting; picker source wired in plugins/keymaps.lua
require("todo-comments").setup({})

-- Paint hex/rgb/hsl color literals
require("nvim-highlight-colors").setup({})

-- Browser live-preview for Markdown (replaces in-buffer render-markdown;
-- see docs/research/nvim-markdown-preview.md). Serves from Neovim's cwd so
-- repo-relative links/images resolve; keymaps in plugins/keymaps.lua.
require("livepreview.config").set({
	browser = "brave",
	picker = "vim.ui.select", -- Snacks replaces vim.ui.select (ui_select above);
	-- the plugin's "snacks.picker" enum value is broken upstream (no picker fn)
	dynamic_root = false,
	sync_scroll = true,
})

-- Floating cmdline on top of ui2 (setup-less plugin; §1.6 enabled ui2 and
-- cmdheight=0). Near the top, where the eyes already are.
vim.g.tiny_cmdline = {
	position = { x = "50%", y = "20%" },
}
