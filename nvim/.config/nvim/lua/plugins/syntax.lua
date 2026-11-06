-- SPEC-v2 §5 — treesitter (main branch, configured for the main branch) and
-- editing helpers. Fixes SPEC.md wart #1: v1 passed master-branch options the
-- main branch ignores, so most filetypes fell back to regex highlighting.

local ts = require("nvim-treesitter")

-- §5.1 Ensure parsers (async; skips what is already installed)
local parsers = {
	"bash",
	"css",
	"diff",
	"gitcommit",
	"gitignore",
	"html",
	"javascript",
	"jsdoc",
	"json",
	"lua",
	"luadoc",
	"luap",
	"markdown",
	"markdown_inline",
	"powershell",
	"printf",
	"python",
	"query",
	"regex",
	"scss",
	"sql",
	"toml",
	"tsx",
	"typescript",
	"vim",
	"vimdoc",
	"xml",
	"yaml",
}
ts.install(parsers)

-- Activate highlighting + indent whenever a parser exists (the main-branch way)
vim.api.nvim_create_autocmd("FileType", {
	group = vim.api.nvim_create_augroup("v2-treesitter", { clear = true }),
	desc = "Start treesitter highlight/indent when a parser exists",
	callback = function(ev)
		local lang = vim.treesitter.language.get_lang(ev.match) or ev.match
		local ok, added = pcall(vim.treesitter.language.add, lang)
		if ok and added then
			vim.treesitter.start(ev.buf, lang)
			vim.bo[ev.buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
		end
	end,
})

-- Keep parsers in sync with the plugin version
vim.api.nvim_create_autocmd("PackChanged", {
	group = vim.api.nvim_create_augroup("v2-treesitter-update", { clear = true }),
	desc = "Update treesitter parsers when the plugin updates",
	callback = function(ev)
		if ev.data.spec and ev.data.spec.name == "nvim-treesitter" and ev.data.kind == "update" then
			vim.schedule(function()
				require("nvim-treesitter").update()
			end)
		end
	end,
})

-- §5.2 Editing helpers
require("nvim-ts-autotag").setup({}) -- auto-close/rename HTML/JSX tags
require("mini.pairs").setup({ modes = { insert = true, command = true } })
require("mini.ai").setup({ n_lines = 500 }) -- better a/i textobjects
require("mini.surround").setup({}) -- sa / sd / sr
