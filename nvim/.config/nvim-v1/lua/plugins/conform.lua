-- Autoformat
-- https://github.com/stevearc/conform.nvim

return {
	"stevearc/conform.nvim",
	lazy = false,
	keys = {
		{
			"<leader>=",
			function()
				require("conform").format({ async = true, lsp_fallback = false })
			end,
			mode = "",
			desc = "[F]ormat buffer",
		},
	},
	opts = {
		notify_on_error = false,
		format_on_save = function(bufnr)
			-- Disable "format_on_save lsp_fallback" for languages that don't
			-- have a well standardized coding style. You can add additional
			-- languages here or re-enable it for the disabled ones.
			local disable_filetypes = { c = true, cpp = true }
			return {
				timeout_ms = 500,
				lsp_fallback = not disable_filetypes[vim.bo[bufnr].filetype],
			}
		end,
		formatters_by_ft = {
			lua = { "stylua" },
			-- python = { "autopep8" },
			python = { "black" },
			css = { "prettier" },
			javascript = { "prettier" },
			typescript = { "prettier" },
			javascriptreact = { "prettier" },
			typescriptreact = { "prettier" },
			json = { "prettier" },
			scss = { "prettier" },
			less = { "prettier" },
		},
	},
}
