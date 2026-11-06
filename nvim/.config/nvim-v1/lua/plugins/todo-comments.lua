-- https://github.com/folke/todo-comments.nvim

return {
	"folke/todo-comments.nvim",
	event = "VimEnter",
	dependencies = { "nvim-lua/plenary.nvim" },
	config = function()
		require("todo-comments").setup()
		vim.keymap.set("n", "<leader>ft", ":TodoTelescope<CR>", { desc = "[F]ind existing [T]ODO-comments" })
	end,
}
