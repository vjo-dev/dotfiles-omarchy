-- https://github.com/stevearc/oil.nvim

return {
	"stevearc/oil.nvim",
	---@module 'oil'
	---@type oil.SetupOpts
	-- Optional dependencies
	dependencies = { { "echasnovski/mini.icons", opts = {} } },
	-- Lazy loading is not recommended because it is very tricky to make it work correctly in all situations.
	lazy = false,
	config = function()
		require("oil").setup({
			columns = { "icon" },
			keymaps = {
				["<C-h>"] = false,
				["<M-h>"] = "actions.select_split",
			},
			view_options = {
				show_hidden = true,
				-- Configuration for the floating window in oil.open_float
			},
			-- Configuration for the floating window in oil.open_float
			float = {
				-- max_width and max_height can be integers or a float between 0 and 1 (e.g. 0.4 for 40%)
				max_width = 0.4,
				max_height = 0.6,
				border = "rounded",
			},
		})

		-- -- Open parent directory in current window
		-- vim.keymap.set("n", "<space>-", "<CMD>Oil<CR>", { desc = "Open parent directory" })

		-- Open parent directory in floating window
		vim.keymap.set("n", "<space>-", require("oil").toggle_float)
	end,
}
