-- SPEC-v2 §8.2 — workflow definitions for the workflow player (<leader>w).
-- This file is the source of truth for the step sequences; edit freely.
--
-- A step is { label, keys?, run? }:
--   keys  : display hint (what you would press by hand)
--   run   : true          → the player presses `keys` for you
--           ":command"    → ex command
--           function()end → custom action
--           nil           → manual step: <CR> just advances
--
-- A workflow is either a real workflow (ordered, numbered steps — the
-- default) or a tuto (unordered reference list, rendered without numbers).
-- Flag a tuto with `tuto = true`:
--
--   ["my-tuto"] = {
--     title = "Some rules of thumb",
--     tuto = true,            -- ← renders as bullets, no "1. 2. 3."
--     steps = { { label = "…" }, { label = "…" } },
--   },

return {
	review = {
		title = "Review agent changes",
		steps = {
			{
				label = "Identify all changes in lazygit",
				keys = "<leader>gg",
				run = true,
			},
			{
				label = "Walk changed files side-by-side — next: ] or previous: [ (f)iles or (c)hunks",
				keys = "<leader>dv",
				run = true,
			},
			{
				label = "In a changed file: toggle the in-file changes",
				keys = "<leader>tg",
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
		title = "Copy line(s) for an agent",
		tuto = true,
		steps = {
			{
				label = "Copy one line only in the clipboard",
				keys = "<leader>yf",
				run = true,
			},
			{
				label = "Copy several lines in the clipboard",
				keys = "v + motion, then <leader>cc",
			},
			{
				label = "Jump to the agent pane and paste",
				keys = "<C-h/j/k/l>",
			},
			{
				label = "Prompt pattern: 'Look at <paste> — explain / fix / refactor …'",
			},
		},
	},

	["config-loop"] = {
		title = "Update my nvim config (spec-driven)",
		steps = {
			{
				label = "Update the SPEC file (add/update/delete step)",
			},
			{
				label = "Tell the agent which step to implement",
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

	["md-preview"] = {
		title = "Preview Markdown & Mermaid",
		tuto = true,
		steps = {
			{
				label = "On .md file: toggle live preview in Brave",
				keys = "<leader>tm",
				run = true,
			},
			{
				label = "Find and preview a doc",
				keys = "<leader>fm",
				run = true,
			},
			{
				label = "Stops the preview server",
				keys = "<leader>tm",
			},
			{
				label = "Preview entire doc of the project (to run in a terminal)",
				keys = "mdocs",
			},
		},
	},

	["skills-small"] = {
		title = "Matt Pocock skill: small request",
		steps = {
			{
				label = "Grill the idea (answer the questions)",
				keys = "/grill-with-docs <idea>",
			},
			{
				label = "Same session — no spec needed, implement",
				keys = "/implement <what we just specced>",
			},
			{
				label = "It drives /tdd + /code-review on a feat/ branch; done when npm run check is green",
			},
			{
				label = "Close the loop: accept/reject suggestions, then squash-merge by hand",
				keys = "/retro",
			},
		},
	},

	["skills-feature"] = {
		title = "Matt Pocock skill: large request(s)",
		steps = {
			{
				label = "Start the session: Grill the feature (answer the questions)",
				keys = "/grill-with-docs <feature + context>",
			},
			{
				label = "Same session: write the spec, then review/edit .scratch/<feature>/spec.md",
				keys = "/to-spec",
			},
			{
				label = "Same session: split into tickets with Blocked by: lines",
				keys = "/to-tickets",
			},
			{
				label = "Now new context — clear BETWEEN tickets, never before",
				keys = "/new",
			},
			{
				label = "Per ticket, blockers-first: implement, green gate, commit, /clear, next ticket",
				keys = "/implement .scratch/<feature>/issues/01-….md",
			},
			{
				label = "After the last ticket",
				keys = "/retro",
			},
			{
				label = "Once routine: whole spec in one command (subagents, one integration branch)",
				keys = "/implement-spec .scratch/<feature>/spec.md",
			},
		},
	},

	["skills-decision"] = {
		title = "Matt Pocock skill: decisions-to-make feature",
		steps = {
			{
				label = "Decisions aren't builds then start research (recorded in a file)",
				keys = "/research <question + files to check>",
			},
			{
				label = "Grill the decision using the research file",
				keys = "/grill-with-docs <question>. Use the research file at <path>",
			},
			{
				label = "Continue as a feature? /to-spec → /to-tickets → /implement",
			},
		},
	},

	["skills-rules"] = {
		title = "Matt Pocock skill: guidelines",
		tuto = true,
		steps = {
			{
				label = "Never /new or /compact between grill → spec → tickets; clear BETWEEN tickets",
			},
			{
				label = "/triage is only for raw incoming bugs/requests — not your own TODO.md items",
			},
			{
				label = "Question you can't settle by talking? /handoff → /prototype in a scratch dir → /handoff back",
			},
			{
				label = "Genuinely broken, resists a first glance → /diagnosing-bugs, then /retro same session",
			},
			{
				label = "Spare moment → /improve-codebase-architecture; chosen opportunity feeds /grill-with-docs",
			},
			{
				label = "Start every repo task with /grill-with-docs — that's what grows GLOSSARY.md and the ADRs",
			},
		},
	},

	diagnostics = {
		title = "Investigate diagnostics",
		tuto = true,
		steps = {
			{
				label = "Cycle between the problems (read the float info)",
				keys = "<A-n> / <A-p>",
			},
			{
				label = "List every diagnostic",
				keys = "<leader>fd",
				run = true,
			},
			{
				label = "Apply a quick-fix on the problem line",
				keys = "<leader>ca",
				run = true,
			},
			{
				label = "Format the buffer",
				keys = "<leader>=",
				run = true,
			},
		},
	},
}
