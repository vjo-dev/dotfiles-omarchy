/**
 * Subagent status widget rendering — pure, dependency-free (only imports
 * `./text-width.ts` and `./status.ts`, both of which have zero external
 * package dependencies). Kept separate from index.ts specifically so it can
 * be unit-tested with plain `node --test`: index.ts itself pulls in
 * `typebox`/`@earendil-works/pi-coding-agent`, which are only resolvable
 * inside pi's own jiti runtime, not a standalone node process.
 *
 * History: an earlier version of this rendering lived inline in index.ts and
 * crashed pi's TUI renderer ("Rendered line N exceeds terminal width") twice
 * — once from a naive `.slice()` that cut into an embedded ANSI escape
 * sequence, and once from computing padding but never truncating overlong
 * content before concatenating it. `hardClampLine` is the non-negotiable
 * safety net for that failure mode: every line this module returns is
 * guaranteed to be exactly `width` visible columns, full stop.
 */
import { truncateToWidth, visibleWidth } from "./text-width.ts";
import { classifyStatus, type StatusSnapshot, type SubagentStatusState } from "./status.ts";
import type { SessionStats } from "./session.ts";

// ── Colors (raw ANSI, since the widget bypasses pi's theme system) ──
const ICON_GREEN = "\x1b[38;2;126;186;103m";
const ICON_YELLOW = "\x1b[38;2;214;181;94m";
const ICON_RED = "\x1b[38;2;224;108;117m";
const ICON_DIM = "\x1b[38;2;128;128;128m";
export const RST = "\x1b[0m";
export const ACCENT = "\x1b[38;2;97;175;239m";

// ── Formatting ──

export function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function formatUsageSegments(stats: SessionStats): string[] {
  const segs: string[] = [];
  if (stats.inputTokens) segs.push(`↑${formatTokens(stats.inputTokens)}`);
  if (stats.outputTokens) segs.push(`↓${formatTokens(stats.outputTokens)}`);
  if (stats.cacheReadTokens) segs.push(`R${formatTokens(stats.cacheReadTokens)}`);
  if (stats.cacheWriteTokens) segs.push(`W${formatTokens(stats.cacheWriteTokens)}`);
  if (stats.cost) segs.push(`$${stats.cost.toFixed(3)}`);
  return segs;
}

export function widgetIcon(kind: StatusSnapshot["kind"]): string {
  switch (kind) {
    case "working":
      return `${ICON_YELLOW}⟳${RST}`;
    case "blocked":
      return `${ICON_RED}‼${RST}`;
    case "stalled":
      return `${ICON_RED}⟳${RST}`;
    case "idle":
      return `${ICON_GREEN}●${RST}`;
    case "starting":
    default:
      return `${ICON_DIM}○${RST}`;
  }
}

export function formatWidgetRightLabel(snapshot: StatusSnapshot): string {
  if (snapshot.kind === "starting") return " starting… ";
  if (snapshot.kind === "working") {
    const duration = snapshot.activeDurationText ? ` ${snapshot.activeDurationText}` : "";
    return ` working${duration} `;
  }
  if (snapshot.kind === "blocked") {
    const duration = snapshot.activeDurationText ? ` ${snapshot.activeDurationText}` : "";
    return ` blocked${duration} `;
  }
  if (snapshot.kind === "stalled") {
    const duration = snapshot.snapshotProblemText ? ` ${snapshot.snapshotProblemText}` : "";
    return ` stalled${duration} `;
  }
  return " idle ";
}

// ── Width-safe box drawing ──

/**
 * Truncate a (possibly ANSI-colored) string to fit `maxWidth` visible
 * columns, ellipsizing if needed. ANSI-aware — never a naive `.slice()`,
 * which corrupts embedded escape sequences and can make a "truncated"
 * string render *wider* than intended.
 */
export function fitSegment(text: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (visibleWidth(text) <= maxWidth) return text;
  return truncateToWidth(text, maxWidth, "…");
}

/**
 * Final safety net applied to every widget line right before it's handed to
 * pi's renderer: hard-guarantee exactly `width` visible columns, no matter
 * what upstream arithmetic produced. pi's TUI throws (crashing the whole
 * process) on any rendered line wider than the terminal — this must never
 * happen regardless of subagent name length, stats text, or narrow herdr
 * panes.
 */
export function hardClampLine(line: string, width: number): string {
  if (width <= 0) return "";
  const vw = visibleWidth(line);
  if (vw > width) return truncateToWidth(line, width);
  if (vw < width) return line + " ".repeat(width - vw);
  return line;
}

export function borderTop(title: string, info: string, width: number): string {
  if (width <= 2) return hardClampLine(`${ACCENT}${"─".repeat(Math.max(0, width))}${RST}`, width);
  const inner = width - 2;
  const label = fitSegment(` ${title} `, inner);
  const infoPart = fitSegment(` ${info} `, Math.max(0, inner - visibleWidth(label)));
  const fill = Math.max(0, inner - visibleWidth(label) - visibleWidth(infoPart));
  const content = `${label}${"─".repeat(fill)}${infoPart}`;
  return `${ACCENT}╭${content}╮${RST}`;
}

export function borderLine(left: string, right: string, width: number): string {
  if (width <= 2) return hardClampLine(`${ACCENT}│${RST}`, width);
  const inner = width - 2;
  const rightFit = fitSegment(right, inner);
  const leftFit = fitSegment(left, Math.max(0, inner - visibleWidth(rightFit)));
  const fill = Math.max(0, inner - visibleWidth(leftFit) - visibleWidth(rightFit));
  return `${ACCENT}│${RST}${leftFit}${" ".repeat(fill)}${rightFit}${ACCENT}│${RST}`;
}

export function borderBottom(width: number): string {
  if (width <= 0) return "";
  if (width === 1) return `${ACCENT}╰${RST}`;
  const inner = Math.max(0, width - 2);
  return `${ACCENT}╰${"─".repeat(inner)}╯${RST}`;
}

// ── Full widget ──

/** Minimal shape renderSubagentWidgetLines needs — decoupled from index.ts's RunningSubagent. */
export interface WidgetAgentView {
  name: string;
  agent?: string;
  statusState: SubagentStatusState;
  lastStats?: SessionStats | null;
}

export function renderSubagentWidgetLines(
  agents: WidgetAgentView[],
  width: number,
  statusEnabled: boolean,
): string[] {
  const count = agents.length;
  const title = "Subagents";
  const info = `${count} running`;
  const lines: string[] = [borderTop(title, info, width)];
  for (const agent of agents) {
    const now = Date.now();
    const snapshot = classifyStatus(agent.statusState, now);
    const elapsed = snapshot.elapsedText;
    const agentTag = agent.agent ? ` (${agent.agent})` : "";
    const icon = widgetIcon(snapshot.kind);
    const usageSegs = agent.lastStats ? formatUsageSegments(agent.lastStats) : [];
    const usageTag = usageSegs.length > 0 ? ` ${usageSegs.join(" ")}` : "";
    const left = ` ${icon} ${elapsed} ${agent.name}${agentTag}${usageTag} `;
    const right = statusEnabled ? formatWidgetRightLabel(snapshot) : " running… ";
    lines.push(borderLine(left, right, width));
  }
  lines.push(borderBottom(width));
  // Defense in depth: no matter what the arithmetic above produced, never
  // hand pi's renderer a line that isn't exactly `width` visible columns —
  // an overflow here crashes the whole TUI process.
  return lines.map((line) => hardClampLine(line, width));
}
