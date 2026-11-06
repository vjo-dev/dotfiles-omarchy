-- SPEC-v2 §8.2 — the workflow player: cheatsheet + tutorial in one.
--
-- Run-and-resume model: a modal float lists the steps of a workflow; <CR>
-- executes the current step (closing the float so the action gets the whole
-- screen) and remembers where you are; re-triggering <leader>w resumes at the
-- next step. Manual steps (no `run`) just advance in place.

local M = {}

local state = { name = nil, idx = 1, win = nil }
local ns = vim.api.nvim_create_namespace("v2-workflow-player")

local function workflows()
	return require("config.workflows")
end

local function pretty_keys(keys)
	return (keys or ""):gsub("<leader>", "SPC ")
end

local function feed(keys)
	vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes(keys, true, false, true), "m", false)
end

local function run_step(step)
	if type(step.run) == "function" then
		step.run()
	elseif type(step.run) == "string" then
		vim.cmd((step.run:gsub("^:", "")))
	elseif step.run == true and step.keys then
		feed(step.keys)
	end
end

local function close(win)
	if win and vim.api.nvim_win_is_valid(win) then
		vim.api.nvim_win_close(win, true)
	end
	if state.win == win then
		state.win = nil
	end
end

local function render(buf, wf)
	local total = #wf.steps
	local lines = { "" }
	for i, step in ipairs(wf.steps) do
		-- Tutos have no notion of "done": no ✓, only the current-line pointer.
		local marker
		if wf.tuto then
			marker = (i == state.idx and "▶") or "·"
		else
			marker = (i < state.idx and "✓") or (i == state.idx and "▶") or "·"
		end
		local keys = step.keys and ("  [" .. pretty_keys(step.keys) .. "]") or ""
		-- Tutos are unordered reference lists: plain bullets, no step numbers.
		local bullet = wf.tuto and "" or ("%d. "):format(i)
		lines[#lines + 1] = ("  %s %s%s%s"):format(marker, bullet, step.label, keys)
	end
	vim.list_extend(lines, {
		"",
		"  ⏎ run step    j/k move    r restart",
		"  s switch workflow    q close",
	})

	vim.bo[buf].modifiable = true
	vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
	vim.bo[buf].modifiable = false

	vim.api.nvim_buf_clear_namespace(buf, ns, 0, -1)
	for i, step in ipairs(wf.steps) do
		local row = i -- line 1 is the leading blank
		local hl = (i == state.idx and "Visual") or (not wf.tuto and i < state.idx and "Comment") or nil
		if hl then
			vim.api.nvim_buf_set_extmark(buf, ns, row, 0, { line_hl_group = hl })
		end
		if step.keys then
			local line = vim.api.nvim_buf_get_lines(buf, row, row + 1, false)[1]
			local s = line:find("%[", 1)
			if s then
				vim.api.nvim_buf_set_extmark(buf, ns, row, s - 1, {
					end_col = #line,
					hl_group = "Special",
				})
			end
		end
	end
	for _, row in ipairs({ #lines - 2, #lines - 1 }) do
		vim.api.nvim_buf_set_extmark(buf, ns, row, 0, { line_hl_group = "Comment" })
	end

	return total
end

local function notify_progress(wf)
	local total = #wf.steps
	if state.idx > total then
		vim.notify(("Workflow “%s” complete 🎉"):format(wf.title))
		state.name, state.idx = nil, 1
	elseif wf.tuto then
		vim.notify(("%s · resume with SPC w"):format(wf.title))
	else
		vim.notify(("%s — step %d/%d · resume with SPC w"):format(wf.title, state.idx, total))
	end
end

local function show(name)
	local wf = workflows()[name]
	if not wf then
		vim.notify(("Unknown workflow %q"):format(name), vim.log.levels.WARN)
		return
	end
	state.name = name
	if state.idx > #wf.steps then
		state.idx = 1
	end

	local buf = vim.api.nvim_create_buf(false, true)
	vim.bo[buf].bufhidden = "wipe"

	local width = 0
	render(buf, wf)
	for _, l in ipairs(vim.api.nvim_buf_get_lines(buf, 0, -1, false)) do
		width = math.max(width, vim.fn.strdisplaywidth(l))
	end
	width = math.min(width + 2, vim.o.columns - 4)
	local height = vim.api.nvim_buf_line_count(buf)

	local win = vim.api.nvim_open_win(buf, true, {
		relative = "editor",
		width = width,
		height = height,
		col = math.floor((vim.o.columns - width) / 2),
		row = math.max(1, math.floor((vim.o.lines - height) / 2) - 1),
		style = "minimal",
		border = "rounded",
		title = (" Workflow: %s "):format(wf.title),
		title_pos = "center",
	})
	state.win = win
	vim.wo[win].cursorline = false

	local function bufmap(lhs, fn, desc)
		vim.keymap.set("n", lhs, fn, { buffer = buf, nowait = true, desc = desc })
	end

	bufmap("q", function()
		close(win)
	end, "Close workflow player")
	bufmap("<Esc>", function()
		close(win)
	end, "Close workflow player")
	bufmap("j", function()
		state.idx = math.min(state.idx + 1, #wf.steps)
		render(buf, wf)
	end, "Next step (move)")
	bufmap("k", function()
		state.idx = math.max(state.idx - 1, 1)
		render(buf, wf)
	end, "Previous step (move)")
	bufmap("r", function()
		state.idx = 1
		render(buf, wf)
	end, "Restart workflow")
	bufmap("s", function()
		close(win)
		state.name, state.idx = nil, 1
		vim.schedule(M.pick)
	end, "Switch workflow")
	bufmap("<CR>", function()
		local step = wf.steps[state.idx]
		if not step then
			return
		end
		state.idx = state.idx + 1
		if step.run then
			close(win)
			notify_progress(wf)
			vim.schedule(function()
				run_step(step)
			end)
		else
			if state.idx > #wf.steps then
				close(win)
				notify_progress(wf)
			else
				render(buf, wf)
			end
		end
	end, "Run/advance step")
end

function M.pick()
	local data = workflows()
	local names, titles = {}, {}
	for name, wf in pairs(data) do
		names[#names + 1] = name
		titles[name] = wf.title
	end
	table.sort(names, function(a, b)
		return titles[a] < titles[b]
	end)
	vim.ui.select(names, {
		prompt = "Workflow",
		format_item = function(name)
			return titles[name]
		end,
	}, function(choice)
		if choice then
			state.idx = 1
			show(choice)
		end
	end)
end

---Toggle the player: close it when open; otherwise resume the active
---workflow or pick one.
---@param name string|nil jump straight to a workflow (used by tests)
function M.open(name)
	if state.win and vim.api.nvim_win_is_valid(state.win) then
		close(state.win)
		return
	end
	if name then
		state.idx = (state.name == name) and state.idx or 1
		show(name)
	elseif state.name then
		show(state.name)
	else
		M.pick()
	end
end

return M
