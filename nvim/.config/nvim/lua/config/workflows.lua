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

	["md-preview"] = {
		title = "Preview Markdown & Mermaid",
		steps = {
			{
				label = "In a .md buffer: toggle live preview in Brave",
				keys = "<leader>tm",
				run = true,
			},
			{
				label = "Type away — ```mermaid blocks and KaTeX render live, even unsaved",
			},
			{
				label = "Preview a different repo doc: fuzzy-pick any .md",
				keys = "<leader>fm",
				run = true,
			},
			{
				label = "Done? Same key stops the preview server",
				keys = "<leader>tm",
			},
			{
				label = "Whole repo as a browsable site (nav tree + Mermaid): run in a shell pane",
				keys = "mdocs",
			},
			{
				label = "Stop mdocs with Ctrl+C in that pane when finished",
			},
		},
	},

	["skills-small"] = {
		title = "Skills: small single-session item (Lesson 1)",
		steps = {
			{
				label = "At the pi prompt: grill the idea (answer its questions; may grow GLOSSARY.md)",
				keys = "/grill-with-docs <item + context from TODO.md>",
			},
			{
				label = "Same window — no spec needed for a single-session item",
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
		title = "Skills: multi-session feature (Lesson 2)",
		steps = {
			{
				label = "One unbroken session for the thinking — never /clear between grill → spec → tickets",
			},
			{
				label = "Grill the feature (expect questions on fields, ranking, edge cases)",
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
				label = "Now clear context — clear BETWEEN tickets, never before",
				keys = "/clear",
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
		title = "Skills: decisions-to-make item (Lesson 3)",
		steps = {
			{
				label = "Decisions aren't builds — research first, primary sources only",
				keys = "/research <question + files to check>",
			},
			{
				label = "Keep working; a background agent leaves a cited markdown file in the repo",
			},
			{
				label = "Grill the decision using the research file; it records an ADR in docs/adr/",
				keys = "/grill-with-docs <question>. Use the research file at <path>",
			},
			{
				label = "If the answer is 'yes': continue as a feature — /to-spec → /to-tickets → /implement",
			},
		},
	},

	["skills-rules"] = {
		title = "Skills: rules of thumb",
		steps = {
			{
				label = "Never /clear or /compact between grill → spec → tickets; clear BETWEEN tickets",
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
