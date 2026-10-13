/**
 * Status classification for running subagents — herdr-native replacement for
 * upstream's file-based `activity.ts`. herdr's own `pi` lifecycle integration
 * (installed via `herdr integration install pi`, loaded into every child via
 * `-e <herdr-agent-state.ts>`) reports `working`/`idle` authoritatively; a
 * `pane.agent_status_changed` event (or, degraded, a poll) updates
 * `SubagentStatusState.lastStatus` here. This module turns that into a
 * display kind, detects "stalled" (no update for too long while not idle),
 * and formats the widget rows + stalled/recovered steer messages.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SNAPSHOT_STALLED_AFTER_MS = 60_000;
export const DEFAULT_STATUS_LINE_LIMIT = 4;
export const MAX_STATUS_NAME_LENGTH = 72;
export const MAX_STATUS_LINE_LENGTH = 120;

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), ".");
const DEFAULT_STATUS_CONFIG_PATH = join(PACKAGE_ROOT, "config.json");
const STATUS_CONFIG_EXAMPLE_PATH = join(PACKAGE_ROOT, "config.json.example");

export type HerdrAgentStatus = "working" | "blocked" | "idle" | "unknown";
export type SubagentStatusKind = "starting" | "working" | "blocked" | "idle" | "stalled";
export type SubagentStatusTransition = "stalled" | "recovered" | "blocked" | "unblocked" | null;

export interface SubagentStatusState {
  /** Last status herdr reported (or null before the first event/poll lands). */
  lastStatus: HerdrAgentStatus | null;
  /** Timestamp of the last status update received. */
  lastUpdateMs: number;
  /** Timestamp the subagent was launched. */
  startTimeMs: number;
  /** Set once the first non-null status has been observed. */
  hasSeenActivity: boolean;
  /** Whether the last classification was "stalled" (for edge detection). */
  wasStalled: boolean;
  /** Whether the last classification was "blocked" (for edge detection). */
  wasBlocked: boolean;
}

export function createStatusState(opts: { startTimeMs: number }): SubagentStatusState {
  return {
    lastStatus: null,
    lastUpdateMs: opts.startTimeMs,
    startTimeMs: opts.startTimeMs,
    hasSeenActivity: false,
    wasStalled: false,
    wasBlocked: false,
  };
}

/** Feed a new herdr-reported status into the state. */
export function observeStatus(
  state: SubagentStatusState,
  status: HerdrAgentStatus,
  nowMs: number,
): SubagentStatusState {
  return {
    ...state,
    lastStatus: status,
    lastUpdateMs: nowMs,
    hasSeenActivity: true,
  };
}

export interface StatusSnapshot {
  kind: SubagentStatusKind;
  elapsedText: string;
  activeDurationText?: string;
  statusLabel?: string;
  snapshotProblemText?: string;
}

function formatElapsedShort(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Classify current display kind from the raw status state. */
export function classifyStatus(state: SubagentStatusState, nowMs: number): StatusSnapshot {
  const elapsedText = formatElapsedShort(nowMs - state.startTimeMs);

  if (!state.hasSeenActivity || state.lastStatus === null) {
    return { kind: "starting", elapsedText };
  }

  const sinceUpdate = nowMs - state.lastUpdateMs;
  const stalled = state.lastStatus !== "idle" && sinceUpdate > SNAPSHOT_STALLED_AFTER_MS;

  if (stalled) {
    return {
      kind: "stalled",
      elapsedText,
      snapshotProblemText: `${Math.floor(sinceUpdate / 1000)}s`,
    };
  }

  if (state.lastStatus === "blocked") {
    return { kind: "blocked", elapsedText, activeDurationText: formatElapsedShort(sinceUpdate) };
  }
  if (state.lastStatus === "working") {
    return { kind: "working", elapsedText, activeDurationText: formatElapsedShort(sinceUpdate) };
  }
  return { kind: "idle", elapsedText };
}

/**
 * Advance state + detect a transition worth waking the parent for:
 *  - "blocked": the child just started needing attention (approval, ask_question, etc.)
 *  - "unblocked": it recovered from blocked back to working/idle
 *  - "stalled": no status update for too long while not idle
 *  - "recovered": a stalled subagent produced a fresh update
 */
export function advanceStatusState(
  state: SubagentStatusState,
  nowMs: number,
): { nextState: SubagentStatusState; snapshot: StatusSnapshot; transition: SubagentStatusTransition } {
  const snapshot = classifyStatus(state, nowMs);
  const isStalled = snapshot.kind === "stalled";
  const isBlocked = snapshot.kind === "blocked";

  let transition: SubagentStatusTransition = null;
  if (isStalled && !state.wasStalled) transition = "stalled";
  else if (!isStalled && state.wasStalled) transition = "recovered";
  else if (isBlocked && !state.wasBlocked) transition = "blocked";
  else if (!isBlocked && state.wasBlocked) transition = "unblocked";

  return {
    nextState: { ...state, wasStalled: isStalled, wasBlocked: isBlocked },
    snapshot,
    transition,
  };
}

/** Force a snapshot re-classification after a manual steer (mirrors upstream). */
export function forceStatusAfterInterrupt(
  state: SubagentStatusState,
  nowMs: number,
): SubagentStatusState {
  return { ...state, lastUpdateMs: nowMs };
}

// ── Config ──

export interface StatusConfig {
  enabled: boolean;
  lineLimit: number;
}

export function loadStatusConfig(): StatusConfig {
  const defaults: StatusConfig = { enabled: true, lineLimit: DEFAULT_STATUS_LINE_LIMIT };
  try {
    const raw = readFileSync(DEFAULT_STATUS_CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed?.status?.enabled ?? defaults.enabled,
      lineLimit:
        typeof parsed?.status?.lineLimit === "number" ? parsed.status.lineLimit : defaults.lineLimit,
    };
  } catch {
    return defaults;
  }
}

export function statusConfigExamplePath(): string {
  return STATUS_CONFIG_EXAMPLE_PATH;
}

// ── Formatting ──

function truncateName(name: string): string {
  return name.length > MAX_STATUS_NAME_LENGTH ? `${name.slice(0, MAX_STATUS_NAME_LENGTH - 1)}…` : name;
}

export function formatTransitionLine(
  name: string,
  snapshot: StatusSnapshot,
  transition: SubagentStatusTransition,
): string {
  const label = truncateName(name);
  let line: string;
  switch (transition) {
    case "blocked":
      line = `"${label}" needs attention (blocked)`;
      break;
    case "unblocked":
      line = `"${label}" is unblocked, back to work`;
      break;
    case "stalled":
      line = `"${label}" appears stalled (no update for ${snapshot.snapshotProblemText ?? "a while"})`;
      break;
    case "recovered":
      line = `"${label}" resumed after a stall`;
      break;
    default:
      line = `"${label}" status changed`;
  }
  return line.length > MAX_STATUS_LINE_LENGTH ? `${line.slice(0, MAX_STATUS_LINE_LENGTH - 1)}…` : line;
}

export function capStatusLines(
  lines: string[],
  limit: number,
): { visibleLines: string[]; overflow: number } {
  if (lines.length <= limit) return { visibleLines: lines, overflow: 0 };
  return { visibleLines: lines.slice(0, limit), overflow: lines.length - limit };
}

export function formatStatusAggregate(lines: string[], limit: number): string {
  const { visibleLines, overflow } = capStatusLines(lines, limit);
  const body = visibleLines.map((l) => `- ${l}`).join("\n");
  return overflow > 0 ? `${body}\n- …and ${overflow} more` : body;
}
