-- SPEC-v2 §6.1 — vtsls: workspace TypeScript, imports updated on file move
-- (feeds the oil rename flow), short inlay hints.
return {
	settings = {
		typescript = {
			updateImportsOnFileMove = { enabled = "always" },
			inlayHints = {
				parameterNames = { enabled = "literals" },
				variableTypes = { enabled = false },
				functionLikeReturnTypes = { enabled = true },
			},
		},
		javascript = {
			updateImportsOnFileMove = { enabled = "always" },
		},
		vtsls = {
			autoUseWorkspaceTsdk = true,
			enableMoveToFileCodeAction = true,
			experimental = {
				completion = { enableServerSideFuzzyMatch = true },
				maxInlayHintLength = 30,
			},
		},
	},
}
