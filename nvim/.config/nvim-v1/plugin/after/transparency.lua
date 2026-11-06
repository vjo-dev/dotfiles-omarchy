-- Make highlight groups transparent while preserving their other attributes
local function make_transparent(name)
	local ok, hl = pcall(vim.api.nvim_get_hl, 0, { name = name, link = false })
	if ok then
		hl.bg = nil
		vim.api.nvim_set_hl(0, name, hl)
	end
end

local groups = {
	-- transparent background
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
	"LazyNormal",
	"MasonNormal",
	"WhichKeyFloat",
	"WhichKeyNormal",
	"WhichKeyBorder",
	"TelescopeBorder",
	"TelescopeNormal",
	"TelescopePromptBorder",
	"TelescopePromptTitle",
	-- neotree
	"NeoTreeNormal",
	"NeoTreeNormalNC",
	"NeoTreeVertSplit",
	"NeoTreeWinSeparator",
	"NeoTreeEndOfBuffer",
	-- nvim-tree
	"NvimTreeNormal",
	"NvimTreeVertSplit",
	"NvimTreeEndOfBuffer",
	-- notify
	"NotifyINFOBody",
	"NotifyERRORBody",
	"NotifyWARNBody",
	"NotifyTRACEBody",
	"NotifyDEBUGBody",
	"NotifyINFOTitle",
	"NotifyERRORTitle",
	"NotifyWARNTitle",
	"NotifyTRACETitle",
	"NotifyDEBUGTitle",
	"NotifyINFOBorder",
	"NotifyERRORBorder",
	"NotifyWARNBorder",
	"NotifyTRACEBorder",
	"NotifyDEBUGBorder",
}

local function apply()
	for _, name in ipairs(groups) do
		make_transparent(name)
	end

	-- bufferline generates its own highlight groups with solid backgrounds;
	-- clear them all except the *Selected ones so the active buffer keeps
	-- some contrast against the transparent bar.
	for name in pairs(vim.api.nvim_get_hl(0, {})) do
		if name:find("^BufferLine") and not name:find("Selected") then
			make_transparent(name)
		end
	end
end

apply()

-- Re-apply whenever the colorscheme changes (Omarchy theme hot-reload,
-- bufferline re-deriving its palette, etc.). Scheduled so it runs after
-- other ColorScheme handlers have rebuilt their highlights.
vim.api.nvim_create_autocmd({ "ColorScheme", "UIEnter" }, {
	group = vim.api.nvim_create_augroup("omarchy-transparency", { clear = true }),
	callback = function()
		vim.schedule(apply)
	end,
})

-- Plugins loaded lazily by lazy.nvim (which-key, cmp, ...) may define their
-- groups after startup; re-apply once everything has settled.
vim.api.nvim_create_autocmd("User", {
	group = "omarchy-transparency",
	pattern = "VeryLazy",
	callback = function()
		vim.schedule(apply)
	end,
})
