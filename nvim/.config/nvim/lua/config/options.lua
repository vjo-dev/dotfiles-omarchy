-- Leader keys must be set before lazy.nvim loads any plugin
vim.g.mapleader = " "
vim.g.maplocalleader = "\\"

require("config.remote_clipboard").setup()

vim.opt.relativenumber = false
