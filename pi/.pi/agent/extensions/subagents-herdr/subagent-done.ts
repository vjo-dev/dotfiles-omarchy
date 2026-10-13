/**
 * Extension loaded into subagent (child) pi processes.
 * - Shows agent identity + available tools as a styled widget above the editor (toggle with Ctrl+Alt+O)
 * - Provides an `ask_question` tool for asking the parent orchestrator a question
 *
 * Subagents do NOT self-terminate via a tool. Auto-exit agents shut down
 * automatically when their agent loop ends (see the `agent_end` handler);
 * interactive agents end when the human exits the pane.
 *
 * `ask_question` keeps the session OPEN: it writes a `${sessionFile}.ask`
 * signal the parent's watcher picks up, parks the session in a "waiting"
 * state (auto-exit is suppressed for that turn via `awaitingAnswer`), and
 * the parent replies with subagent_message — which lands as the subagent's
 * next turn.
 *
 * Unlike the upstream tmux-based extension, this file does NOT report its
 * own activity snapshots: herdr's own `pi` lifecycle integration (installed
 * via `herdr integration install pi`, loaded alongside this file via `-e`)
 * already reports working/idle state over the herdr socket. The parent's
 * status.ts consumes that instead.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { writeFileSync } from "node:fs";

export function shouldMarkUserTookOver(agentStarted: boolean): boolean {
  return agentStarted;
}

/**
 * Number of child subagents this session itself still has in flight.
 *
 * When this extension is loaded inside a subagent that can spawn its own
 * children (e.g. a worker delegating to scout/researcher), `index.ts` runs in
 * the same process and publishes a live count through a shared process-global
 * symbol. A subagent that spawns children and then writes a "waiting for
 * results" message would otherwise auto-exit the instant that turn ends —
 * killing the session before its children report back.
 */
export function runningChildrenCount(): number {
  const fn = (globalThis as any)[Symbol.for("subagents-herdr/running-children-count")];
  if (typeof fn !== "function") return 0;
  try {
    const n = fn();
    return typeof n === "number" && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function shouldAutoExitOnAgentEnd(
  _userTookOver: boolean,
  messages: any[] | undefined,
): boolean {
  if (messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.role === "assistant") {
        return msg.stopReason !== "aborted";
      }
    }
  }
  return true;
}

export interface SubagentErrorInfo {
  errorMessage: string;
  stopReason: "error";
}

export function findLatestAssistantError(messages: any[] | undefined): SubagentErrorInfo | null {
  if (!messages) return null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role !== "assistant") continue;
    if (msg.stopReason !== "error") return null;
    const raw = typeof msg.errorMessage === "string" ? msg.errorMessage.trim() : "";
    return {
      errorMessage: raw || "Subagent agent loop ended with stopReason=error (no errorMessage field).",
      stopReason: "error",
    };
  }
  return null;
}

export function parseDeniedTools(rawValue: string | undefined): string[] {
  return (rawValue ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export default function (pi: ExtensionAPI) {
  let toolNames: string[] = [];
  let denied: string[] = [];
  let expanded = false;

  const subagentName = process.env.PI_HERD_NAME ?? "";
  const subagentAgent = process.env.PI_HERD_AGENT ?? "";
  const deniedToolsValue = process.env.PI_HERD_DENY_TOOLS;
  const autoExit = process.env.PI_HERD_AUTO_EXIT === "1";

  function renderWidget(ctx: { ui: { setWidget: Function } }, _theme: any) {
    ctx.ui.setWidget(
      "subagent-tools",
      (_tui: any, theme: any) => {
        const box = new Box(1, 0, (text: string) => theme.bg("toolSuccessBg", text));

        const label = subagentAgent || subagentName;
        const agentTag = label ? theme.bold(theme.fg("accent", `[${label}]`)) : "";

        if (expanded) {
          const countInfo = theme.fg("dim", ` — ${toolNames.length} available`);
          const hint = theme.fg("muted", "  (Ctrl+Alt+O to collapse)");
          const toolList = toolNames.map((name: string) => theme.fg("dim", name)).join(theme.fg("muted", ", "));

          let deniedLine = "";
          if (denied.length > 0) {
            const deniedList = denied.map((name: string) => theme.fg("error", name)).join(theme.fg("muted", ", "));
            deniedLine = "\n" + theme.fg("muted", "denied: ") + deniedList;
          }

          const content = new Text(`${agentTag}${countInfo}${hint}\n${toolList}${deniedLine}`, 0, 0);
          box.addChild(content);
        } else {
          const countInfo = theme.fg("dim", ` — ${toolNames.length} tools`);
          const deniedInfo =
            denied.length > 0 ? theme.fg("dim", " · ") + theme.fg("error", `${denied.length} denied`) : "";
          const hint = theme.fg("muted", "  (Ctrl+Alt+O to expand)");
          const content = new Text(`${agentTag}${countInfo}${deniedInfo}${hint}`, 0, 0);
          box.addChild(content);
        }

        return box;
      },
      { placement: "aboveEditor" },
    );
  }

  let userTookOver = false;
  let agentStarted = false;
  let awaitingAnswer = false;

  pi.on("session_start", (_event, ctx) => {
    const tools = pi.getAllTools();
    toolNames = tools.map((t) => t.name).sort();
    denied = parseDeniedTools(deniedToolsValue);
    renderWidget(ctx, null);
  });

  pi.on("input", () => {
    awaitingAnswer = false;
    if (!shouldMarkUserTookOver(agentStarted)) return;
    userTookOver = true;
  });

  pi.on("agent_start", () => {
    agentStarted = true;
    awaitingAnswer = false;
  });

  pi.on("agent_end", (event, ctx) => {
    const messages = (event as any).messages as any[] | undefined;
    const hasPendingChildren = runningChildrenCount() > 0;
    const shouldExit =
      !awaitingAnswer && !hasPendingChildren && autoExit && shouldAutoExitOnAgentEnd(userTookOver, messages);

    if (shouldExit) {
      // Write an authoritative, herdr-independent "this child's turn loop has
      // ended" sidecar on EVERY exit (clean or error) — not just errors.
      // herdr's own pane/agent lifecycle tracking has been observed to stop
      // reporting a pane at all after its own `agent start` readiness wait
      // times out, even though the process inside it is alive and working;
      // the parent's watcher needs a completion signal that does not depend
      // on herdr noticing anything about this pane. This file, written from
      // inside the child process itself, is that signal.
      const errorInfo = findLatestAssistantError(messages);
      const sessionFile = process.env.PI_HERD_SESSION;
      if (sessionFile) {
        try {
          writeFileSync(
            `${sessionFile}.exit`,
            JSON.stringify(
              errorInfo
                ? {
                    type: "error",
                    errorMessage: errorInfo.errorMessage,
                    stopReason: errorInfo.stopReason,
                    timestamp: new Date().toISOString(),
                  }
                : { type: "done", timestamp: new Date().toISOString() },
            ),
          );
        } catch {
          // Best effort.
        }
      }
      ctx.shutdown();
      return;
    }

    if (autoExit) {
      userTookOver = false;
    }
  });

  // Toggle expand/collapse with Ctrl+Alt+O
  pi.registerShortcut("ctrl+alt+o", {
    description: "Toggle subagent tools widget",
    handler: (ctx) => {
      expanded = !expanded;
      renderWidget(ctx, null);
    },
  });

  pi.registerTool({
    name: "ask_question",
    label: "ask_question",
    description:
      "Ask the orchestrator (the parent agent that spawned you) a single question and pause until they reply. " +
      "Use this when requirements are ambiguous, a decision would materially affect your work, you're blocked, " +
      "or you need information or confirmation only the orchestrator has. Prefer asking over guessing. " +
      "Your session stays open while you wait — the answer arrives as your next message, then you continue. " +
      "Ask exactly one question per call; make separate calls for unrelated questions.",
    promptSnippet:
      "Use this tool to ask the orchestrator one clarifying, missing-requirement, preference, or decision question before continuing — instead of guessing.",
    promptGuidelines: [
      "Ask exactly one question per tool call.",
      "If you need answers to multiple things, make separate ask_question calls instead of bundling them.",
      "Prefer this tool over guessing when requirements, preferences, or implementation choices are unclear.",
      "Use it when multiple valid paths exist and the right one depends on the orchestrator's intent.",
      "Give enough context in the question that the orchestrator can answer without re-reading your whole task.",
      "After asking, stop and wait — the reply will arrive as your next message.",
    ],
    parameters: Type.Object({
      question: Type.String({
        description: "The single freeform question to ask the orchestrator. Include enough context to answer it directly.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const sessionFile = process.env.PI_HERD_SESSION;
      if (!sessionFile) {
        throw new Error(
          "ask_question is only available in subagent contexts. PI_HERD_SESSION environment variable is not set.",
        );
      }

      awaitingAnswer = true;
      const askData = {
        name: process.env.PI_HERD_NAME ?? "subagent",
        agent: process.env.PI_HERD_AGENT ?? "",
        question: params.question,
      };
      writeFileSync(`${sessionFile}.ask`, JSON.stringify(askData));

      return {
        content: [
          {
            type: "text",
            text:
              "Question sent to the orchestrator. Stop here and wait — do not continue working or " +
              "assume an answer. Their reply will arrive as your next message.",
          },
        ],
        details: { question: params.question },
      };
    },

    renderCall(args, theme) {
      const text = theme.fg("toolTitle", theme.bold("ask_question ")) + theme.fg("muted", String((args as any).question ?? ""));
      return new Text(text, 0, 0);
    },
  });
}
