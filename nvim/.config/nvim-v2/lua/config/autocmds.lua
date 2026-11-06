-- SPEC-v2 §1.7 — plugin-free autocmds.

local function augroup(name)
	return vim.api.nvim_create_augroup("v2-" .. name, { clear = true })
end

-- Yanked text flashes briefly
vim.api.nvim_create_autocmd("TextYankPost", {
	group = augroup("highlight-yank"),
	desc = "Flash yanked text",
	callback = function()
		vim.hl.on_yank()
	end,
})

-- Reopening a file restores the last cursor position
vim.api.nvim_create_autocmd("BufReadPost", {
	group = augroup("restore-position"),
	desc = "Restore last cursor position",
	callback = function(ev)
		local mark = vim.api.nvim_buf_get_mark(ev.buf, '"')
		if mark[1] > 0 and mark[1] <= vim.api.nvim_buf_line_count(ev.buf) then
			pcall(vim.api.nvim_win_set_cursor, 0, mark)
		end
	end,
})

-- Strip trailing whitespace on save — except markdown, where trailing
-- two-space hard breaks are meaningful (SPEC.md wart #15).
vim.api.nvim_create_autocmd("BufWritePre", {
	group = augroup("strip-whitespace"),
	desc = "Strip trailing whitespace (except markdown)",
	callback = function(ev)
		if vim.bo[ev.buf].filetype == "markdown" then
			return
		end
		local view = vim.fn.winsaveview()
		vim.cmd([[keeppatterns %s/\s\+$//e]])
		vim.fn.winrestview(view)
	end,
})
