-- https://github.com/akinsho/bufferline.nvim

return {
  'akinsho/bufferline.nvim', 
  version = "*", 
  dependencies = 'nvim-tree/nvim-web-devicons',
  config = function()
    require("bufferline").setup()
    vim.keymap.set("n", "<tab>", ":bn<CR>", { desc = "Next buffer" })
    vim.keymap.set("n", "<S-tab>", ":bp<CR>", { desc = "Previous buffer" })
    vim.keymap.set("n", "<leader><tab>", ":bd<CR>", { desc = "Delete buffer" })
  end
}
