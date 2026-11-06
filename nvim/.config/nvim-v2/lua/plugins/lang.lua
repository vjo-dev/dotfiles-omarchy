-- SPEC-v2 §6.5 — work tools: PowerShell and SQL.

-- PowerShell Editor Services via Mason; shell is pwsh on Linux (fixes
-- SPEC.md wart #4 — v1 pointed at the Windows binary name).
-- NOTE: requires the `pwsh` binary (AUR: powershell-bin) to actually run.
require("powershell").setup({
	bundle_path = vim.fn.stdpath("data") .. "/mason/packages/powershell-editor-services",
	shell = "pwsh",
	settings = {
		enableProfileLoading = false,
		scriptAnalysis = { enable = true },
	},
})

-- SQL: vim-dadbod trio, genuinely lazy (fixes SPEC.md wart #13). The specs
-- are not in plugins/init.lua: the first :DBUI installs/loads them on demand.
vim.api.nvim_create_user_command("DBUI", function()
	vim.api.nvim_del_user_command("DBUI")
	vim.pack.add({
		"https://github.com/tpope/vim-dadbod",
		"https://github.com/kristijanhusak/vim-dadbod-ui",
		"https://github.com/kristijanhusak/vim-dadbod-completion",
	}, { confirm = false })
	vim.schedule(function()
		vim.cmd("DBUI")
	end)
end, { desc = "Load vim-dadbod and open the SQL UI" })
