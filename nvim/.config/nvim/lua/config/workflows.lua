-- SPEC-v2 §8.2 — workflow definitions for the workflow player (<leader>w).
-- This file is the source of truth for the step sequences; edit freely.
--
-- A step is { label, keys?, run? }:
--   keys  : display hint (what you would press by hand)
--   run   : true          → the player presses `keys` for you
--           ":command"    → ex command
--           function()end → custom action
--           nil           → manual step: <CR> just advances

return {
	review = {
		title = "Review agent changes",
		steps = {
			{
				label = "Skim the whole changeset in lazygit (q quits)",
				keys = "<leader>gg",
				run = true,
			},
			{
				label = "Walk changed files side-by-side — ]f/[f files, ]c/[c hunks",
				keys = "<leader>dv",
				run = true,
			},
			{
				label = "In a changed file: toggle the in-file overlay",
				keys = "<leader>gd",
				run = true,
			},
			{
				label = "Hop hunk to hunk in the buffer",
				keys = "]c / [c",
			},
			{
				label = "Stage good hunks, reject bad ones",
				keys = "<leader>gh / <leader>gr",
			},
			{
				label = "Blame anything suspicious",
				keys = "<leader>gb",
				run = true,
			},
			{
				label = "Buffer clean? Stage it whole",
				keys = "<leader>gs",
				run = true,
			},
		},
	},

	feed = {
		title = "Feed context to the agent",
		steps = {
			{
				label = "Cursor on the relevant line: copy path#L to clipboard",
				keys = "<leader>yf",
				run = true,
			},
			{
				label = "Or select code first, copy as fenced block",
				keys = "v + motion, then <leader>cc",
			},
			{
				label = "Jump to the agent pane (herdr/tmux) and paste",
				keys = "<C-h/j/k/l>",
			},
			{
				label = "Prompt pattern: 'Look at <paste> — explain / fix / refactor …'",
			},
		},
	},

	["config-loop"] = {
		title = "Config-iteration loop (spec-driven)",
		steps = {
			{
				label = "Tell the agent which SPEC-v2.md step to implement",
			},
			{
				label = "Review its diff",
				keys = "<leader>dv",
				run = true,
			},
			{
				label = "Save everything (unsaved buffers block the restart)",
				keys = ":wa",
				run = ":wa",
			},
			{
				label = "Restart nvim with the new config (player resets)",
				keys = "ZR",
				run = true,
			},
			{
				label = "Behavior OK? Commit from lazygit",
				keys = "<leader>gg",
				run = true,
			},
		},
	},

	diagnostics = {
		title = "Fix diagnostics sweep",
		steps = {
			{
				label = "Jump to the next problem (cycles, float explains)",
				keys = "<A-n>",
				run = true,
			},
			{
				label = "Need the full picture? List every diagnostic",
				keys = "<leader>fd",
				run = true,
			},
			{
				label = "Apply a quick-fix on the problem line",
				keys = "<leader>ca",
				run = true,
			},
			{
				label = "Repeat <A-n> → <leader>ca until the gutter is clean",
			},
			{
				label = "Format the buffer",
				keys = "<leader>=",
				run = true,
			},
			{
				label = "Save",
				keys = "<C-s>",
				run = true,
			},
		},
	},
}
