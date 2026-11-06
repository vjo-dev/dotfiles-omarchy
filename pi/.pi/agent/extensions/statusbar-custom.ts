/**
 * Custom status bar — reuses @yorch/pi-statusbar's segments but renders a
 * fixed order: model+thinking · context(bar+%/total) · dir · git.
 *
 * The yorch package stays installed (we import its modules), but its own
 * footer is disabled via settings.json → statusbar.enabled = false.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";

// Reuse the installed package's internals (stable path, survives version bumps)
import {
	getGitStatus,
	invalidateGitCache,
	onGitUpdate,
} from "../npm/node_modules/@yorch/pi-statusbar/extensions/git-status.ts";
import {
	ASCII,
	hasNerdFonts,
	NERD,
} from "../npm/node_modules/@yorch/pi-statusbar/extensions/icons.ts";
import {
	renderSegments,
	type SegmentContext,
} from "../npm/node_modules/@yorch/pi-statusbar/extensions/segments.ts";

const ORDER = ["model", "context", "path", "git"];
const SEP = " · ";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		apply(ctx);
	});

	pi.on("tool_execution_end", async () => {
		invalidateGitCache();
	});

	pi.on("agent_end", async () => {
		invalidateGitCache();
	});

	function apply(ctx: ExtensionContext) {
		if (ctx.mode !== "tui") return;

		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsubBranch = footerData.onBranchChange(() => tui.requestRender());
			const unsubGit = onGitUpdate(() => tui.requestRender());

			return {
				dispose() {
					unsubBranch();
					unsubGit();
				},
				invalidate() {},
				render(width: number): string[] {
					const c: SegmentContext = {
						ctx,
						theme,
						git: getGitStatus(ctx.cwd),
						pr: null,
						icons: hasNerdFonts() ? NERD : ASCII,
						statuses: [],
						usage: { input: 0, output: 0, cost: 0, cacheRead: 0, cacheWrite: 0 },
						elapsedMs: 0,
						opts: {
							showThinkingLevel: true,
							pathMode: "basename",
							gitDetail: true,
							contextBar: true,
							contextMode: "percent",
						},
					};
					const line = renderSegments(ORDER, c).join(theme.fg("dim", SEP));
					return [truncateToWidth(line, width)];
				},
			};
		});
	}
}
