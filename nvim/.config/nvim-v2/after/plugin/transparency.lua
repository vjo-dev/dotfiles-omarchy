-- SPEC-v2 §2.2 — transparent background, ported from v1. Strips the
-- background from UI highlight groups while preserving their other
-- attributes, so the terminal blur shows through.

local function make_transparent(name)
	local ok, hl = pcall(vim.api.nvim_get_hl, 0, { name = name, link = false })
	if ok then
		hl.bg = nil
		vim.api.nvim_set_hl(0, name, hl)
	end
end

local groups = {
	-- core
	"Normal",
	"NormalFloat",
	"FloatBorder",
	"FloatTitle",
	"FloatFooter",
	"Pmenu",
	"Terminal",
	"EndOfBuffer",
	"FoldColumn",
	"Folded",
	"SignColumn",
	"LineNr",
	"CursorLineNr",
	"NormalNC",
	-- tab bar
	"TabLine",
	"TabLineFill",
	"TabLineSel",
	-- floats with their own normal/border groups
	"MasonNormal",
	"TinyCmdlineNormal",
	"TinyCmdlineBorder",
}

-- Prefix-cleared plugin families (bufferline keeps its *Selected groups so
-- the active buffer keeps contrast against the transparent bar).
local prefixes = {
	{ "^BufferLine", exclude = "Selected" },
	{ "^WhichKey" },
	{ "^SnacksNotifier" },
}

local function apply()
	for _, name in ipairs(groups) do
		make_transparent(name)
	end

	for name in pairs(vim.api.nvim_get_hl(0, {})) do
		for _, prefix in ipairs(prefixes) do
			if name:find(prefix[1]) and not (prefix.exclude and name:find(prefix.exclude)) then
				make_transparent(name)
			end
		end
	end
end

apply()

-- Re-apply whenever the colorscheme changes (Omarchy theme bridge hot
-- reload). Scheduled so other ColorScheme handlers rebuild first.
vim.api.nvim_create_autocmd({ "ColorScheme", "UIEnter" }, {
	group = vim.api.nvim_create_augroup("v2-transparency", { clear = true }),
	desc = "Keep UI backgrounds transparent",
	callback = function()
		vim.schedule(apply)
	end,
})
