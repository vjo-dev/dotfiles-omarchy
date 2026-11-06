-- SPEC-v2 §1.8 — plugin-free keymaps. Every mapping carries desc=:
-- the keybindings book (SPEC-v2 §9) reads them live.

local map = vim.keymap.set

map("n", "<Esc>", "<cmd>nohlsearch<CR>", { desc = "Clear search highlight" })

map({ "i", "n", "x", "s" }, "<C-s>", "<cmd>w<CR><Esc>", { desc = "Save file" })

map("n", "<C-a>", "gg<S-v>G", { desc = "Select all" })

-- <C-a> is taken by select-all, so increment/decrement live on +/-
map("n", "+", "<C-a>", { desc = "Increment number" })
map("n", "-", "<C-x>", { desc = "Decrement number" })

map("n", "<leader>o", "o<Esc>", { desc = "Empty line below" })
map("n", "<leader>O", "O<Esc>", { desc = "Empty line above" })

map("n", "<A-j>", "<cmd>m .+1<CR>==", { desc = "Move line down" })
map("n", "<A-k>", "<cmd>m .-2<CR>==", { desc = "Move line up" })
map("i", "<A-j>", "<Esc><cmd>m .+1<CR>==gi", { desc = "Move line down" })
map("i", "<A-k>", "<Esc><cmd>m .-2<CR>==gi", { desc = "Move line up" })
map("v", "<A-j>", ":m '>+1<CR>gv=gv", { desc = "Move selection down" })
map("v", "<A-k>", ":m '<-2<CR>gv=gv", { desc = "Move selection up" })

map("v", "<", "<gv", { desc = "Indent left, keep selection" })
map("v", ">", ">gv", { desc = "Indent right, keep selection" })

-- Diagnostic nav: Alt chords — bracket keys are AltGr gymnastics on the
-- dk/eu layouts (kb_layout = "us,dk,eu"). Wraps around, opens the float.
map("n", "<A-n>", function()
	vim.diagnostic.jump({ count = 1, float = true })
end, { desc = "Next diagnostic (cycles)" })
map("n", "<A-p>", function()
	vim.diagnostic.jump({ count = -1, float = true })
end, { desc = "Previous diagnostic (cycles)" })
map("n", "<leader>e", vim.diagnostic.open_float, { desc = "Diagnostic float" })
map("n", "<leader>q", vim.diagnostic.setloclist, { desc = "Diagnostic loclist" })

-- The agent-iteration loop (SPEC-v2 §1.8): :wa first — unsaved buffers block it.
map("n", "ZR", "<cmd>restart<CR>", { desc = "Restart Neovim, restore session" })

-- SPEC-v2 §8.2 — workflow player: cheatsheet + tutorial (run-and-resume)
map("n", "<leader>w", function()
	require("config.workflow_player").open()
end, { desc = "Workflow player (toggle)" })

-- ── SPEC-v2 §8 — agent helpers: feed context to agents in other panes.
--    The remote clipboard provider carries these anywhere (tmux/SSH/herdr).
local function yank_path(expand_arg)
	local text = ("%s#L%d"):format(vim.fn.expand(expand_arg), vim.fn.line("."))
	vim.fn.setreg("+", text)
	vim.notify("Copied: " .. text)
end
map("n", "<leader>yf", function()
	yank_path("%:.")
end, { desc = "Copy path#line (relative)" })
map("n", "<leader>yp", function()
	yank_path("%:p")
end, { desc = "Copy path#line (absolute)" })

-- Copy the visual selection as a fenced code block with filename/line attrs
map("x", "<leader>cc", function()
	local langs = {
		typescriptreact = "tsx",
		javascriptreact = "jsx",
		typescript = "ts",
		javascript = "js",
		markdown = "md",
	}
	local from, to = vim.fn.getpos("v"), vim.fn.getpos(".")
	local lnum = math.min(from[2], to[2])
	local lines = vim.fn.getregion(from, to, { type = "V" })
	local rel = vim.fn.expand("%:.")
	local block = ("```%s filename=%q line=%d\n%s\n```"):format(
		langs[vim.bo.filetype] or vim.bo.filetype,
		rel,
		lnum,
		table.concat(lines, "\n")
	)
	vim.fn.setreg("+", block)
	vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<Esc>", true, false, true), "n", false)
	vim.notify(("Copied code block: %s#L%d (%d lines)"):format(rel, lnum, #lines))
end, { desc = "Copy selection as code block" })

-- Kept command-line abbreviations (v1 habits)
vim.cmd([[
	cnoreabbrev <expr> W ((getcmdtype() == ':' && getcmdline() == 'W') ? 'w' : 'W')
	cnoreabbrev <expr> k ((getcmdtype() == ':' && getcmdline() == 'k') ? 'WhichKey' : 'k')
]])
