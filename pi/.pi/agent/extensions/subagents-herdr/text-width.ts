/**
 * Minimal ANSI-aware text width helpers, dependency-free (no pi-tui import).
 *
 * `@earendil-works/pi-tui`'s `visibleWidth`/`truncateToWidth` are only
 * resolvable inside pi's own jiti-based runtime, which makes any code that
 * imports them untestable with plain `node --test`. The widget-rendering
 * code in index.ts produces exactly the ANSI shapes this extension emits
 * itself (SGR color codes around plain ASCII box-drawing/text) — a full
 * Unicode-wide-char-aware implementation isn't needed here, so this module
 * re-implements just enough (strip/measure/truncate SGR sequences) to be
 * correct for that content and fully unit-testable.
 *
 * If subagent names ever need proper CJK/emoji width handling, swap the
 * body of these two functions for calls into pi-tui's real implementation
 * (only usable at runtime inside pi, not in standalone tests).
 */

const ANSI_SEQUENCE = /^\x1b\[[0-9;]*m/;
const ANSI_GLOBAL = /\x1b\[[0-9;]*m/g;

/** Visible column count of a string, ignoring embedded SGR escape codes. */
export function visibleWidth(s: string): number {
  return s.replace(ANSI_GLOBAL, "").length;
}

/**
 * Truncate `s` to at most `width` visible columns, passing ANSI escape
 * sequences through untouched (they never consume width budget) and
 * appending `ellipsis` (counted against the budget) when truncation
 * actually occurs. Safe to call on strings with no ANSI codes at all.
 */
export function truncateToWidth(s: string, width: number, ellipsis = ""): string {
  if (width <= 0) return "";
  if (visibleWidth(s) <= width) return s;

  const ellipsisWidth = ellipsis.length;
  const targetVisible = Math.max(0, width - ellipsisWidth);

  let result = "";
  let visibleCount = 0;
  let i = 0;
  while (i < s.length) {
    const rest = s.slice(i);
    const match = rest.match(ANSI_SEQUENCE);
    if (match) {
      result += match[0];
      i += match[0].length;
      continue;
    }
    if (visibleCount >= targetVisible) break;
    result += s[i];
    visibleCount++;
    i++;
  }
  return result + ellipsis;
}
