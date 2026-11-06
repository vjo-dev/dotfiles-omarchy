-- SPEC-v2 §2.1 — Omarchy theme bridge v2 (no lazy.nvim).
--
-- Omarchy writes a lazy.nvim-style spec to
-- ~/.local/state/omarchy/current/theme/neovim.lua on every theme switch.
-- We read that file AS DATA: the first spec names the colorscheme plugin
-- (with opts), the "LazyVim/LazyVim" spec only carries opts.colorscheme.
-- All colorscheme plugins are preinstalled via vim.pack (plugins/init.lua),
-- so applying is: setup(opts) if the plugin has a module, then :colorscheme.
-- A libuv fs_event watch on the state dir hot-reloads on theme switch.

local M = {}

local state_dir = vim.fn.expand("~/.local/state/omarchy/current")
local theme_file = state_dir .. "/theme/neovim.lua"

---Read the Omarchy-generated spec. Returns colorscheme name + plugin spec.
local function read_spec()
	local chunk = loadfile(theme_file)
	if not chunk then
		return nil, nil
	end
	local ok, specs = pcall(chunk)
	if not ok or type(specs) ~= "table" then
		return nil, nil
	end

	local scheme, plugin
	for _, spec in ipairs(specs) do
		if type(spec) == "table" and type(spec[1]) == "string" then
			if spec[1] == "LazyVim/LazyVim" then
				scheme = spec.opts and spec.opts.colorscheme
			else
				plugin = spec
			end
		end
	end
	return scheme, plugin
end

---Lua module candidates for a plugin spec ("bjarneo/aether.nvim" → "aether").
local function module_candidates(plugin)
	local names, seen = {}, {}
	local function push(name)
		if name and name ~= "" and not seen[name] then
			seen[name] = true
			names[#names + 1] = name
		end
	end
	push(plugin.name)
	local base = plugin[1]:match("[^/]+$") or ""
	push(base)
	push(base:gsub("%.nvim$", ""):gsub("%-nvim$", ""):gsub("%-neovim$", ""))
	push((plugin.name or base):gsub("%.nvim$", ""))
	return names
end

---Drop a scheme's modules so a re-setup starts fresh (hot reload).
local function purge_modules(candidates)
	for _, cand in ipairs(candidates) do
		for key in pairs(package.loaded) do
			if key == cand or key:sub(1, #cand + 1) == cand .. "." then
				package.loaded[key] = nil
			end
		end
	end
end

function M.apply()
	local scheme, plugin = read_spec()
	if not scheme then
		vim.notify("Omarchy theme bridge: could not read " .. theme_file, vim.log.levels.WARN)
		pcall(vim.cmd.colorscheme, "default")
		return
	end

	vim.cmd("highlight clear")
	if vim.fn.exists("syntax_on") == 1 then
		vim.cmd("syntax reset")
	end
	vim.o.background = "dark" -- light themes set it back themselves

	if plugin then
		local candidates = module_candidates(plugin)
		purge_modules(candidates)
		if plugin.opts then
			for _, cand in ipairs(candidates) do
				local ok, mod = pcall(require, cand)
				if ok and type(mod) == "table" and type(mod.setup) == "function" then
					pcall(mod.setup, plugin.opts)
					break
				end
			end
		end
	end

	if not pcall(vim.cmd.colorscheme, scheme) then
		vim.notify(("Omarchy theme bridge: colorscheme %q not found"):format(scheme), vim.log.levels.WARN)
		pcall(vim.cmd.colorscheme, "default")
	end
	-- transparency (after/plugin/transparency.lua) re-applies on ColorScheme
end

-- Hot reload: watch the Omarchy state dir (theme symlink swap) and the theme
-- dir itself (file regeneration), debounced since switches touch many files.
local timer
local function on_change()
	if timer then
		timer:stop()
	end
	timer = vim.defer_fn(function()
		M.apply()
	end, 150)
end

local function watch(path)
	local handle = vim.uv.new_fs_event()
	if handle then
		handle:start(path, {}, vim.schedule_wrap(on_change))
	end
end

M.apply()
watch(state_dir)
watch(state_dir .. "/theme")

return M
