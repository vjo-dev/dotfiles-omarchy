-- SPEC-v2 §6.1 — lua_ls knows the Neovim runtime (0.12-native replacement
-- for the archived neodev, SPEC.md wart #9).
return {
	settings = {
		Lua = {
			runtime = { version = "LuaJIT" },
			workspace = {
				checkThirdParty = false,
				library = {
					vim.env.VIMRUNTIME,
					vim.fn.stdpath("config"),
					"${3rd}/luv/library",
				},
			},
			completion = { callSnippet = "Replace" },
			diagnostics = { globals = { "vim", "MiniIcons", "Snacks" } },
		},
	},
}
