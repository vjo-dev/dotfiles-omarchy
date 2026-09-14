-- https://github.com/TheLeoP/powershell.nvim

return {
	"TheLeoP/powershell.nvim",
	ft = { "ps1", "psm1", "psd1" }, -- load only for PowerShell files
	build = ":UpdateRemotePlugins", -- required for the plugin to register its RPC
	config = function()
		require("powershell").setup({
			-- You can customize these if you want:
			bundle_path = vim.fn.stdpath("data") .. "/mason/packages/powershell-editor-services",
			shell = "powershell", -- or "powershell" on Windows
			-- shell = "pwsh", -- or "powershell" on Windows
			settings = {
				enableProfileLoading = false,
				scriptAnalysis = { enable = true },
			},
		})
	end,
}
