/**
 * Minimal unit tests for pure/mux-agnostic functions.
 * Run with: node --experimental-strip-types --test test/test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeHerdrName } from "../herdr.ts";
import {
  createStatusState,
  observeStatus,
  classifyStatus,
  advanceStatusState,
  formatTransitionLine,
  capStatusLines,
  SNAPSHOT_STALLED_AFTER_MS,
} from "../status.ts";
import {
  renderSubagentWidgetLines,
  borderTop,
  borderLine,
  borderBottom,
  hardClampLine,
  fitSegment,
  formatUsageSegments,
  type WidgetAgentView,
} from "../widget.ts";
import { visibleWidth } from "../text-width.ts";

test("sanitizeHerdrName lowercases and strips disallowed chars", () => {
  assert.equal(sanitizeHerdrName("Scout One!"), "scout-one-");
  assert.equal(sanitizeHerdrName("worker_2"), "worker_2");
});

test("sanitizeHerdrName guarantees a leading letter", () => {
  assert.match(sanitizeHerdrName("123abc"), /^[a-z]/);
});

test("sanitizeHerdrName caps length at 32", () => {
  const long = "a".repeat(50);
  assert.equal(sanitizeHerdrName(long).length, 32);
});

test("sanitizeHerdrName falls back to 'subagent' for empty/garbage input", () => {
  assert.equal(sanitizeHerdrName(""), "subagent");
  assert.equal(sanitizeHerdrName("---"), "subagent");
});

test("classifyStatus reports 'starting' before any status is observed", () => {
  const state = createStatusState({ startTimeMs: Date.now() });
  const snapshot = classifyStatus(state, Date.now());
  assert.equal(snapshot.kind, "starting");
});

test("classifyStatus reflects the last observed status", () => {
  const now = Date.now();
  let state = createStatusState({ startTimeMs: now });
  state = observeStatus(state, "working", now);
  assert.equal(classifyStatus(state, now + 1000).kind, "working");

  state = observeStatus(state, "blocked", now + 1000);
  assert.equal(classifyStatus(state, now + 1500).kind, "blocked");

  state = observeStatus(state, "idle", now + 2000);
  assert.equal(classifyStatus(state, now + 2500).kind, "idle");
});

test("classifyStatus detects a stall when no update arrives for too long", () => {
  const now = Date.now();
  let state = createStatusState({ startTimeMs: now });
  state = observeStatus(state, "working", now);
  const later = now + SNAPSHOT_STALLED_AFTER_MS + 5000;
  assert.equal(classifyStatus(state, later).kind, "stalled");
});

test("classifyStatus never stalls while idle", () => {
  const now = Date.now();
  let state = createStatusState({ startTimeMs: now });
  state = observeStatus(state, "idle", now);
  const later = now + SNAPSHOT_STALLED_AFTER_MS + 5000;
  assert.equal(classifyStatus(state, later).kind, "idle");
});

test("advanceStatusState detects blocked/unblocked edges", () => {
  const now = Date.now();
  let state = createStatusState({ startTimeMs: now });
  state = observeStatus(state, "working", now);

  let step = advanceStatusState(state, now + 100);
  assert.equal(step.transition, null);
  state = step.nextState;

  state = observeStatus(state, "blocked", now + 200);
  step = advanceStatusState(state, now + 200);
  assert.equal(step.transition, "blocked");
  state = step.nextState;

  state = observeStatus(state, "working", now + 300);
  step = advanceStatusState(state, now + 300);
  assert.equal(step.transition, "unblocked");
});

test("advanceStatusState detects stalled/recovered edges", () => {
  const now = Date.now();
  let state = createStatusState({ startTimeMs: now });
  state = observeStatus(state, "working", now);

  let step = advanceStatusState(state, now + SNAPSHOT_STALLED_AFTER_MS + 5000);
  assert.equal(step.transition, "stalled");
  state = step.nextState;

  state = observeStatus(state, "working", now + SNAPSHOT_STALLED_AFTER_MS + 6000);
  step = advanceStatusState(state, now + SNAPSHOT_STALLED_AFTER_MS + 6000);
  assert.equal(step.transition, "recovered");
});

test("formatTransitionLine produces readable, length-capped lines", () => {
  const now = Date.now();
  const state = observeStatus(createStatusState({ startTimeMs: now }), "blocked", now);
  const snapshot = classifyStatus(state, now);
  const line = formatTransitionLine("a".repeat(200), snapshot, "blocked");
  assert.ok(line.length <= 120);
});

test("capStatusLines caps and reports overflow", () => {
  const lines = ["a", "b", "c", "d", "e"];
  const { visibleLines, overflow } = capStatusLines(lines, 3);
  assert.deepEqual(visibleLines, ["a", "b", "c"]);
  assert.equal(overflow, 2);
});

// ── Widget rendering: regression coverage for the two live crashes found
// while testing this extension in a real (narrow) herdr pane ──
// (1) a naive `.slice()` cut into an embedded ANSI escape sequence and
//     silently shortened a border line instead of truncating it correctly;
// (2) `borderLine` computed padding but never truncated oversized `left`/
//     `right` content before concatenating, so a long stats tag overflowed
//     the box and crashed pi's renderer ("Rendered line N exceeds terminal
//     width"). Every test below asserts the *exact* invariant pi's
//     renderer enforces: every returned line is exactly `width` visible
//     columns, for every width down to pathologically small values.

function makeAgent(overrides: Partial<WidgetAgentView> = {}): WidgetAgentView {
  const now = Date.now();
  return {
    name: "scout",
    agent: "scout",
    statusState: observeStatus(createStatusState({ startTimeMs: now - 7000 }), "idle", now),
    lastStats: null,
    ...overrides,
  };
}

test("borderTop is always exactly `width` visible columns", () => {
  for (const width of [0, 1, 2, 3, 5, 10, 20, 49, 80, 200]) {
    const line = borderTop("Subagents", "3 running", width);
    assert.equal(visibleWidth(line), width, `width=${width}`);
  }
});

test("borderLine is always exactly `width` visible columns, even with oversized content", () => {
  const longLeft = " \x1b[32m\u25cf\x1b[0m 00:07 test-worker (worker) \u21914 \u2193245 R8.0k W8.1k $0.024 ";
  const longRight = " blocked (needs attention) ";
  for (const width of [0, 1, 2, 3, 10, 20, 30, 49, 65, 80, 200]) {
    const line = borderLine(longLeft, longRight, width);
    assert.equal(visibleWidth(line), width, `width=${width}`);
  }
});

test("borderBottom is always exactly `width` visible columns", () => {
  for (const width of [0, 1, 2, 3, 49, 80]) {
    assert.equal(visibleWidth(borderBottom(width)), width, `width=${width}`);
  }
});

test("hardClampLine truncates an overlong line to exactly width", () => {
  const line = "x".repeat(100);
  assert.equal(visibleWidth(hardClampLine(line, 49)), 49);
});

test("hardClampLine pads an underlong line to exactly width", () => {
  assert.equal(visibleWidth(hardClampLine("short", 49)), 49);
});

test("hardClampLine is ANSI-aware (color codes don't count toward width)", () => {
  const colored = "\x1b[38;2;126;186;103m\u25cf\x1b[0m";
  assert.equal(visibleWidth(colored), 1);
  assert.equal(visibleWidth(hardClampLine(colored, 5)), 5);
});

test("fitSegment never returns something wider than maxWidth", () => {
  assert.ok(visibleWidth(fitSegment("a very long subagent name indeed", 10)) <= 10);
  assert.equal(fitSegment("short", 10), "short");
});

test(
  "renderSubagentWidgetLines: exact reproduction of the live crash " +
    "(narrow 49-col herdr pane, subagent with live token/cost stats)",
  () => {
    const agent = makeAgent({
      name: "test-worker",
      agent: "worker",
      statusState: observeStatus(createStatusState({ startTimeMs: Date.now() - 7000 }), "idle", Date.now()),
      lastStats: {
        model: "claude-sonnet-5",
        toolCount: 6,
        inputTokens: 4000,
        outputTokens: 245000,
        cacheReadTokens: 8000,
        cacheWriteTokens: 8100,
        contextTokens: 12000,
        cost: 0.024,
      },
    });
    const lines = renderSubagentWidgetLines([agent], 49, true);
    for (const line of lines) {
      assert.ok(visibleWidth(line) <= 49, `line exceeds width: ${JSON.stringify(line)}`);
      assert.equal(visibleWidth(line), 49, `line is not padded to width: ${JSON.stringify(line)}`);
    }
  },
);

test("renderSubagentWidgetLines holds the width invariant across many widths and agent counts", () => {
  const agents = [
    makeAgent({ name: "scout" }),
    makeAgent({
      name: "a-very-long-subagent-display-name-that-someone-might-actually-type",
      agent: "worker",
      lastStats: {
        model: "m",
        toolCount: 1,
        inputTokens: 1234567,
        outputTokens: 999,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        contextTokens: 0,
        cost: 12.3456,
      },
    }),
  ];
  for (const width of [1, 5, 10, 20, 30, 40, 49, 60, 80, 120]) {
    const lines = renderSubagentWidgetLines(agents, width, true);
    for (const line of lines) {
      assert.equal(visibleWidth(line), width, `width=${width}, line=${JSON.stringify(line)}`);
    }
  }
});

test("renderSubagentWidgetLines handles zero agents", () => {
  const lines = renderSubagentWidgetLines([], 49, true);
  assert.equal(lines.length, 2); // top + bottom border only
  for (const line of lines) assert.equal(visibleWidth(line), 49);
});

test("formatUsageSegments formats tokens/cost compactly and omits zero fields", () => {
  const segs = formatUsageSegments({
    model: null,
    toolCount: 0,
    inputTokens: 4000,
    outputTokens: 245000,
    cacheReadTokens: 0,
    cacheWriteTokens: 8100,
    contextTokens: 0,
    cost: 0.024,
  });
  assert.deepEqual(segs, ["↑4.0k", "↓245.0k", "W8.1k", "$0.024"]);
});
