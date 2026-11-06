-- SPEC-v2 §6 — LSP, completion, formatting. No keymaps here except the
-- LspAttach document-highlight autocmd (see plugins/keymaps.lua for keymaps).

-- §6.6 Diagnostics look — v1 behavior: gutter icons left of the line numbers,
-- NO inline virtual text (the code stays clean); messages appear in a float
-- when jumping with ]d / [d or on <leader>e.
vim.diagnostic.config({
	severity_sort = true,
	update_in_insert = false,
	underline = true,
	virtual_text = false,
	float = { source = "if_many" },
	signs = {
		text = {
			[vim.diagnostic.severity.ERROR] = " ",
			[vim.diagnostic.severity.WARN] = " ",
			[vim.diagnostic.severity.INFO] = " ",
			[vim.diagnostic.severity.HINT] = " ",
		},
	},
})

-- §6.1 Mason installs servers/tools once, never auto-updates, and no forced
-- :MasonToolsInstall at startup (fixes SPEC.md wart #14). Mason package names.
require("mason").setup()
require("mason-tool-installer").setup({
	ensure_installed = {
		-- servers
		"lua-language-server",
		"vtsls",
		"pyright",
		"bash-language-server",
		"css-lsp",
		"html-lsp",
		"json-lsp",
		"yaml-language-server",
		"marksman",
		"tailwindcss-language-server",
		"powershell-editor-services",
		-- formatters (prettier/black are not on the system PATH)
		"stylua",
		"prettier",
		"black",
	},
	auto_update = false,
})

-- §6.3 Completion: blink.cmp — Enter accepts, C-j/C-k navigate (v1 muscle
-- memory), docs after 200 ms. Replaces nvim-cmp + LuaSnip + 3 source plugins.
require("blink.cmp").setup({
	keymap = {
		preset = "enter",
		["<C-j>"] = { "select_next", "fallback" },
		["<C-k>"] = { "select_prev", "fallback" },
	},
	completion = {
		documentation = { auto_show = true, auto_show_delay_ms = 200 },
	},
	appearance = { nerd_font_variant = "mono" },
	fuzzy = { implementation = "prefer_rust_with_warning" },
})

-- §6.1 Servers, 0.12 style: nvim-lspconfig supplies defaults, our overrides
-- live in after/lsp/<name>.lua, vim.lsp.enable turns them on. Every server
-- gets blink capabilities (file-rename support comes with the defaults).
vim.lsp.config("*", {
	capabilities = require("blink.cmp").get_lsp_capabilities(),
})
vim.lsp.enable({
	"lua_ls",
	"vtsls",
	"pyright",
	"bashls",
	"cssls",
	"html",
	"jsonls",
	"yamlls",
	"marksman",
	"tailwindcss",
})

-- Document-highlight of the symbol under the cursor on CursorHold (kept v1)
vim.api.nvim_create_autocmd("LspAttach", {
	group = vim.api.nvim_create_augroup("v2-lsp-attach", { clear = true }),
	desc = "LSP document highlight",
	callback = function(event)
		local client = vim.lsp.get_client_by_id(event.data.client_id)
		if client and client:supports_method("textDocument/documentHighlight") then
			local group = vim.api.nvim_create_augroup("v2-lsp-highlight", { clear = false })
			vim.api.nvim_create_autocmd({ "CursorHold", "CursorHoldI" }, {
				buffer = event.buf,
				group = group,
				callback = vim.lsp.buf.document_highlight,
			})
			vim.api.nvim_create_autocmd({ "CursorMoved", "CursorMovedI" }, {
				buffer = event.buf,
				group = group,
				callback = vim.lsp.buf.clear_references,
			})
			vim.api.nvim_create_autocmd("LspDetach", {
				group = vim.api.nvim_create_augroup("v2-lsp-detach", { clear = true }),
				callback = function(ev)
					vim.lsp.buf.clear_references()
					vim.api.nvim_clear_autocmds({ group = "v2-lsp-highlight", buffer = ev.buf })
				end,
			})
		end
	end,
})

-- §6.4 Formatting: conform is the ONLY pipeline (prettier.nvim cut, wart #5).
-- Format-on-save everywhere except markdown (notes are formatted on demand).
require("conform").setup({
	notify_on_error = false,
	format_on_save = function(bufnr)
		if vim.b[bufnr].disable_autoformat or vim.bo[bufnr].filetype == "markdown" then
			return
		end
		return { timeout_ms = 500, lsp_format = "fallback" }
	end,
	formatters_by_ft = {
		lua = { "stylua" },
		python = { "black" },
		javascript = { "prettier" },
		typescript = { "prettier" },
		javascriptreact = { "prettier" },
		typescriptreact = { "prettier" },
		json = { "prettier" },
		jsonc = { "prettier" },
		css = { "prettier" },
		scss = { "prettier" },
		less = { "prettier" },
		yaml = { "prettier" },
		markdown = { "prettier" }, -- manual <leader>= only
	},
})

-- :ToggleFormatter flips format-on-save for the current buffer
vim.api.nvim_create_user_command("ToggleFormatter", function()
	vim.b.disable_autoformat = not vim.b.disable_autoformat
	vim.notify("Format on save: " .. (vim.b.disable_autoformat and "off" or "on") .. " (this buffer)")
end, { desc = "Toggle format-on-save for the current buffer" })
