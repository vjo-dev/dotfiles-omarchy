-- SPEC-v2 — every plugin-dependent keymap, required last so every plugin is
-- already set up. All mappings carry desc= for the keybindings book (§9).

local map = vim.keymap.set

-- ── §4.1 Picker (snacks) — v1 <leader>f* muscle memory preserved ──────────
map("n", "<leader>ff", function()
	Snacks.picker.files({ hidden = true })
end, { desc = "Find files" })
map("n", "<leader>fg", function()
	Snacks.picker.grep({ hidden = true })
end, { desc = "Live grep" })
map("n", "<leader>fw", function()
	Snacks.picker.grep_word()
end, { desc = "Grep word under cursor" })
map("n", "<leader>fb", function()
	Snacks.picker.buffers()
end, { desc = "Buffers" })
map("n", "<leader>fd", function()
	Snacks.picker.diagnostics()
end, { desc = "Diagnostics" })
map("n", "<leader>fh", function()
	Snacks.picker.help()
end, { desc = "Help tags" })
map("n", "<leader>fk", function()
	Snacks.picker.keymaps()
end, { desc = "Keymaps" })
map("n", "<leader>fn", function()
	Snacks.picker.files({ cwd = vim.fn.stdpath("config") })
end, { desc = "Find nvim config files" })
map("n", "<leader>ft", function()
	Snacks.picker.todo_comments()
end, { desc = "TODO comments" })
map("n", "<leader>f.", function()
	Snacks.picker.resume()
end, { desc = "Resume last picker" })

-- ── §4.2 File explorer ────────────────────────────────────────────────────
map("n", "<leader>-", function()
	require("oil").toggle_float()
end, { desc = "File explorer (float)" })

-- ── §4.4 Buffers as tabs (bufferline) ─────────────────────────────────────
map("n", "<Tab>", "<cmd>BufferLineCycleNext<CR>", { desc = "Next buffer" })
map("n", "<S-Tab>", "<cmd>BufferLineCyclePrev<CR>", { desc = "Previous buffer" })
map("n", "<leader><Tab>", "<cmd>bdelete<CR>", { desc = "Delete buffer" })

-- ── §6.2 LSP (global so the keybindings book sees them; no-ops without a
--    client, and K falls back to keywordprg) ───────────────────────────────
map("n", "gd", function()
	Snacks.picker.lsp_definitions()
end, { desc = "Goto definition" })
map("n", "gD", vim.lsp.buf.declaration, { desc = "Goto declaration" })
map("n", "gr", function()
	Snacks.picker.lsp_references()
end, { nowait = true, desc = "References" })
map("n", "gI", function()
	Snacks.picker.lsp_implementations()
end, { desc = "Goto implementation" })
map("n", "gy", function()
	Snacks.picker.lsp_type_definitions()
end, { desc = "Goto type definition" })
map("n", "K", function()
	if #vim.lsp.get_clients({ bufnr = 0, method = "textDocument/hover" }) > 0 then
		vim.lsp.buf.hover()
	else
		vim.cmd.normal({ "K", bang = true })
	end
end, { desc = "Hover docs" })
map("n", "<leader>rn", vim.lsp.buf.rename, { desc = "Rename symbol" })
map({ "n", "x" }, "<leader>ca", vim.lsp.buf.code_action, { desc = "Code action" })
map("n", "<leader>th", function()
	local enabled = vim.lsp.inlay_hint.is_enabled({ bufnr = 0 })
	vim.lsp.inlay_hint.enable(not enabled, { bufnr = 0 })
end, { desc = "Toggle inlay hints" })

-- ── §6.4 Formatting ───────────────────────────────────────────────────────
map({ "n", "x" }, "<leader>=", function()
	require("conform").format({ async = true, lsp_format = "fallback" })
end, { desc = "Format buffer" })

-- ── §7 Git review deck ────────────────────────────────────────────────────
local gs = require("gitsigns")
map("n", "]c", function()
	if vim.wo.diff then
		vim.cmd.normal({ "]c", bang = true })
	else
		gs.nav_hunk("next")
	end
end, { desc = "Next git hunk" })
map("n", "[c", function()
	if vim.wo.diff then
		vim.cmd.normal({ "[c", bang = true })
	else
		gs.nav_hunk("prev")
	end
end, { desc = "Previous git hunk" })
map("n", "<leader>gh", gs.stage_hunk, { desc = "Stage/unstage hunk" })
map("v", "<leader>gh", function()
	gs.stage_hunk({ vim.fn.line("."), vim.fn.line("v") })
end, { desc = "Stage selected lines" })
map("n", "<leader>gr", gs.reset_hunk, { desc = "Reset hunk" })
map("n", "<leader>gs", gs.stage_buffer, { desc = "Stage buffer" })
map("n", "<leader>gb", function()
	gs.blame_line({ full = false })
end, { desc = "Blame line" })
map("n", "<leader>gB", gs.blame, { desc = "Blame buffer" })
map("n", "<leader>gd", function()
	require("mini.diff").toggle_overlay(0)
end, { desc = "Toggle diff overlay" })
map("n", "<leader>gg", function()
	Snacks.lazygit()
end, { desc = "Lazygit" })
map("n", "<leader>dv", "<cmd>CodeDiff<CR>", { desc = "Diff view (working tree)" })
map("n", "<leader>dh", "<cmd>CodeDiff history %<CR>", { desc = "File history (diff)" })
map("n", "<leader>dH", "<cmd>CodeDiff history<CR>", { desc = "Repo history (diff)" })
