-- SPEC-v2 §1.2–1.6 — options. Leader keys first: everything else depends on them.

vim.g.mapleader = " "
vim.g.maplocalleader = " "

-- §1.2 Basics
vim.o.mouse = "a" -- kept v1 habit: split resizing
vim.o.clipboard = "unnamedplus" -- transport handled by config/clipboard.lua when remote
vim.o.expandtab = true -- 2-space indent
vim.o.tabstop = 2
vim.o.shiftwidth = 2
vim.o.softtabstop = 2
vim.o.smartindent = true
vim.o.breakindent = true

-- §1.3 Look of the buffer
vim.o.number = true
vim.o.relativenumber = true -- hybrid numbers: counts for review jumps like d5j
vim.o.cursorline = true
vim.o.scrolloff = 10
vim.o.signcolumn = "yes" -- no text jump when git/diagnostic marks appear
vim.o.showtabline = 2 -- bufferline arrives in step 3
vim.o.laststatus = 3 -- one global statusline
vim.o.termguicolors = true
vim.o.title = true -- terminal tab shows the file name
vim.o.winborder = "rounded" -- every float
vim.o.list = true -- make stray whitespace visible
vim.opt.listchars = { tab = "» ", trail = "·", nbsp = "␣" }
vim.o.inccommand = "split" -- live :s preview
-- Default shapes per mode, plus blink everywhere (nvim's default is steady;
-- the terminal/herdr only blink when nvim requests it via DECSCUSR).
vim.o.guicursor = "n-v-c-sm:block,i-ci-ve:ver25,r-cr-o:hor20,a:blinkwait700-blinkoff400-blinkon250"

-- §1.4 Search, files, undo, timing
vim.o.ignorecase = true
vim.o.smartcase = true -- case-insensitive until a capital appears
vim.o.swapfile = false
vim.o.writebackup = false
vim.o.undofile = true -- undo survives closing the file
vim.o.shada = "'10,<0,s10,h" -- few oldfiles, no registers: privacy over history
vim.o.updatetime = 250
vim.o.timeoutlen = 300 -- which-key pops up fast (step 4)

-- §1.5 Splits and folds
vim.o.splitright = true
vim.o.splitbelow = true
vim.o.foldmethod = "expr" -- folds from treesitter
vim.o.foldexpr = "v:lua.vim.treesitter.foldexpr()"
vim.o.foldlevel = 99 -- everything starts open; close by syntax (zc/zM)
vim.o.foldlevelstart = 99

-- §1.6 Messages: experimental ui2 (vim._core.ui2 on 0.12.6, formerly vim._extui)
-- Short messages go to an ephemeral floating window, gone after 5 s; long
-- output lands in the pager (g< reopens it). Must come after the options above.
vim.o.cmdheight = 0
local ok, ui2 = pcall(require, "vim._core.ui2")
if not ok then
	ok, ui2 = pcall(require, "vim._extui") -- pre-rename fallback
end
if ok then
	ui2.enable({
		msg = {
			target = "msg", -- ephemeral message window suits cmdheight=0
			msg = { timeout = 5000 },
		},
	})
end
