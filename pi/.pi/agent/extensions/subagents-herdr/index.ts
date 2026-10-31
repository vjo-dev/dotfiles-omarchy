/**
 * subagents-herdr — async subagents for pi, running in herdr panes.
 *
 * A ground-up rebuild of amosblomqvist/pi-interactive-subagents (MIT) that
 * replaces tmux with herdr (https://herdr.dev) as the terminal multiplexer
 * and event source. herdr's own `pi` lifecycle integration (see
 * `herdr integration install pi`) reports working/idle status over its
 * socket API; this extension additionally watches `pane.agent_status_changed`
 * / `pane.agent_detected` (released) / `pane.closed` events per subagent
 * pane instead of screen-scraping a sentinel string. No Claude Code support
 * in this build — pi-only.
 *
 * Local, personal extension: no upstream git remote, `pi install`, or
 * package registration. See README.md for provenance.
 */
import { Type, type Static } from "typebox";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import {
  isHerdrAvailable,
  herdrSetupHint,
  sanitizeHerdrName,
  splitPane,
  startAgent,
  promptAgent,
  readPane,
  closePane,
  notify,
  listAgentNames,
  getAgent,
  confirmAgentAlive,
} from "./herdr.ts";
import { watchPaneLifecycle, type PaneWatchHandle, type HerdrAgentStatus } from "./herdr-events.ts";
import { renderSubagentWidgetLines, formatElapsed, type WidgetAgentView } from "./widget.ts";
import {
  countSessionEntryLines,
  findLastAssistantMessage,
  getNewEntries,
  getSessionId,
  readNameRegistry,
  readSubagentLoadout,
  registerName,
  resolveNameInRegistry,
  seedSubagentSessionFile,
  summarizeSessionStats,
  writeSubagentLoadout,
  type SessionStats,
  type SubagentLoadout,
} from "./session.ts";
import {
  type SubagentStatusState,
  advanceStatusState,
  createStatusState,
  formatStatusAggregate,
  formatTransitionLine,
  capStatusLines,
  loadStatusConfig,
  observeStatus,
  forceStatusAfterInterrupt,
} from "./status.ts";

// Survive `import.meta.url` weirdness under jiti — resolve relative to this
// module's own directory, not process.cwd().
const SUBAGENTS_DIR = dirname(fileURLToPath(import.meta.url));

// Survive /reload: clear timers and stop pane watchers from the previous
// module load. /reload re-imports this file, giving fresh module-level
// state, but closures from the old module keep running otherwise.
const WIDGET_INTERVAL_KEY = Symbol.for("subagents-herdr/widget-interval");
const STATUS_INTERVAL_KEY = Symbol.for("subagents-herdr/status-interval");
const RUNNING_CHILDREN_COUNT_KEY = Symbol.for("subagents-herdr/running-children-count");
{
  const prevWidget = (globalThis as any)[WIDGET_INTERVAL_KEY];
  if (prevWidget) {
    clearInterval(prevWidget);
    (globalThis as any)[WIDGET_INTERVAL_KEY] = null;
  }
  const prevStatus = (globalThis as any)[STATUS_INTERVAL_KEY];
  if (prevStatus) {
    clearInterval(prevStatus);
    (globalThis as any)[STATUS_INTERVAL_KEY] = null;
  }
}

// ── Agent frontmatter ──

type SubagentSessionMode = "standalone" | "lineage-only" | "fork";

interface AgentDefaults {
  model?: string;
  tools?: string;
  skills?: string;
  thinking?: string;
  subagentAgents?: string[];
  autoExit?: boolean;
  interactive?: boolean;
  systemPromptMode?: "append" | "replace";
  sessionMode?: SubagentSessionMode;
  cwd?: string;
  body?: string;
  disableModelInvocation?: boolean;
}

type AgentSource = "package" | "global" | "project";
interface AgentDefinition extends AgentDefaults {
  name: string;
  description: string;
  source: AgentSource;
}

const SPAWNING_TOOLS = ["subagent", "subagent_message", "subagents_list"] as const;

/** Built-in tools pi provides natively — no extension needs to be loaded. */
const BUILTIN_TOOLS = new Set(["read", "write", "edit", "bash", "grep", "find", "ls"]);

function getAgentConfigDir(): string {
  return process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
}

// ── Runtime tool-extension registration ──
// Maps a non-built-in tool name to the extension file that registers it, so a
// restricted child can be launched with `--no-extensions` + one explicit `-e`
// per whitelisted tool. The web/search tools here come from the pi-web-access
// package installed on this machine; adjust NPM_TOOL_EXTENSIONS if your
// toolset differs.
function findNpmExtensionFile(pkgName: string, entryFile = "index.ts"): string | undefined {
  const candidates = [
    join(getAgentConfigDir(), "npm", "node_modules", pkgName, entryFile),
    join(process.cwd(), ".pi", "npm", "node_modules", pkgName, entryFile),
  ];
  return candidates.find((p) => existsSync(p));
}

const WEB_ACCESS_ENTRY = findNpmExtensionFile("pi-web-access");

// Security enforcement: the permission system must ride along into every
// restricted child. `--no-extensions` strips normal package discovery, so
// without an explicit `-e` a child would run with NO path denies and no
// ask/deny gates — i.e. MORE privilege than the parent session.
const PERMISSION_SYSTEM_ENTRY = findNpmExtensionFile("@gotgenes/pi-permission-system", "src/index.ts");
const BUILTIN_TOOL_EXTENSION_MAP: Record<string, string | undefined> = {
  web_search: WEB_ACCESS_ENTRY,
  fetch_content: WEB_ACCESS_ENTRY,
  get_search_content: WEB_ACCESS_ENTRY,
  source_check: WEB_ACCESS_ENTRY,
  safe_bash: join(SUBAGENTS_DIR, "tools", "safe-bash.ts"),
};

const EXTRA_TOOL_EXTENSIONS = new Map<string, string>();

/** Register (or re-register) a custom tool's backing extension file. */
export function registerToolExtension(name: string, extensionPath: string): void {
  if (BUILTIN_TOOLS.has(name)) {
    throw new Error(`Cannot register custom tool "${name}": shadows a built-in pi tool`);
  }
  if ((SPAWNING_TOOLS as readonly string[]).includes(name)) {
    throw new Error(`Cannot register custom tool "${name}": shadows a spawning tool`);
  }
  EXTRA_TOOL_EXTENSIONS.set(name, extensionPath);
}

(globalThis as any).__subagents_herdr__ = { registerToolExtension };

function getToolExtensionPath(tool: string): string | undefined {
  if (BUILTIN_TOOLS.has(tool)) return undefined;
  const mapped = BUILTIN_TOOL_EXTENSION_MAP[tool];
  if (mapped && existsSync(mapped)) return mapped;
  return EXTRA_TOOL_EXTENSIONS.get(tool);
}

/**
 * When this process was spawned as a restricted subagent, the parent pins the
 * set of agents it may itself spawn via PI_HERD_ALLOWED. `null` means no
 * restriction (top-level session, or an unrestricted child).
 */
const SUBAGENT_ALLOWLIST: Set<string> | null = (() => {
  const raw = process.env.PI_HERD_ALLOWED;
  if (!raw) return null;
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return list.length > 0 ? new Set(list) : null;
})();

function getBundledAgentsDir(): string {
  return join(SUBAGENTS_DIR, "agents");
}

function getFrontmatterValue(frontmatter: string, key: string): string | undefined {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim();
}

function parseAgentDefinition(raw: string, fallbackName: string): AgentDefinition | null {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;
  const [, frontmatter, body] = match;

  const name = getFrontmatterValue(frontmatter, "name") ?? fallbackName;
  const description = getFrontmatterValue(frontmatter, "description") ?? "";
  const model = getFrontmatterValue(frontmatter, "model");
  const tools = getFrontmatterValue(frontmatter, "tools");
  const skills = getFrontmatterValue(frontmatter, "skills");
  const thinking = getFrontmatterValue(frontmatter, "thinking");
  const subagentAgentsRaw = getFrontmatterValue(frontmatter, "subagent_agents");
  const subagentAgents = subagentAgentsRaw
    ? subagentAgentsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;
  const autoExit = getFrontmatterValue(frontmatter, "auto-exit") === "true";
  const interactiveRaw = getFrontmatterValue(frontmatter, "interactive");
  const interactive = interactiveRaw === undefined ? undefined : interactiveRaw === "true";
  const systemPromptMode = getFrontmatterValue(frontmatter, "system-prompt") as
    | "append"
    | "replace"
    | undefined;
  const sessionMode = getFrontmatterValue(frontmatter, "session-mode") as
    | SubagentSessionMode
    | undefined;
  const cwd = getFrontmatterValue(frontmatter, "cwd");
  const disableModelInvocation = getFrontmatterValue(frontmatter, "disable-model-invocation") === "true";

  return {
    name,
    description,
    model,
    tools,
    skills,
    thinking,
    subagentAgents,
    autoExit,
    interactive,
    systemPromptMode,
    sessionMode,
    cwd,
    disableModelInvocation,
    body: body.trim() || undefined,
    source: "package",
  };
}

function loadAgentDefaults(name: string): AgentDefaults | null {
  const all = discoverAgentDefinitions();
  return all.find((a) => a.name === name) ?? null;
}

function discoverAgentDefinitions(): AgentDefinition[] {
  const agents = new Map<string, AgentDefinition>();

  const dirs: Array<{ dir: string; source: AgentSource }> = [
    { dir: getBundledAgentsDir(), source: "package" },
    { dir: join(getAgentConfigDir(), "agents"), source: "global" },
    { dir: join(process.cwd(), ".pi", "agents"), source: "project" },
  ];

  for (const { dir, source } of dirs) {
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((entry) => entry.endsWith(".md"))) {
      const parsed = parseAgentDefinition(readFileSync(join(dir, file), "utf8"), file.replace(/\.md$/, ""));
      if (!parsed) continue;
      agents.set(parsed.name, { ...parsed, source });
    }
  }

  const all = [...agents.values()];
  return SUBAGENT_ALLOWLIST ? all.filter((a) => SUBAGENT_ALLOWLIST.has(a.name)) : all;
}

function resolveSubagentPaths(
  params: Static<typeof SubagentParams>,
  agentDefs: AgentDefaults | null,
): { effectiveCwd: string | null; localAgentDir: string | null; effectiveAgentDir: string } {
  const rawCwd = params.cwd ?? agentDefs?.cwd ?? null;
  const effectiveCwd = rawCwd ? resolve(process.cwd(), rawCwd) : null;
  const localAgentDir = effectiveCwd ? join(effectiveCwd, ".pi", "agent") : null;
  const effectiveAgentDir =
    localAgentDir && existsSync(localAgentDir) ? localAgentDir : getAgentConfigDir();
  return { effectiveCwd, localAgentDir, effectiveAgentDir };
}

function buildSubagentToolAllowlist(
  effectiveTools: string | undefined,
  extraTools: string[] = [],
): {
  toolAllowlist: string | null;
  extensionArgs: string[];
} {
  // `effectiveTools` undefined means the agent has no `tools:` frontmatter —
  // an unrestricted spawn (fork/full-context mode) that keeps pi's default
  // toolset and full extension discovery. There is no `--tools` restriction
  // to build in that case, so `extraTools` (e.g. `ask_question`) would be
  // meaningless: nothing is hidden to begin with.
  if (!effectiveTools) return { toolAllowlist: null, extensionArgs: [] };
  const base = effectiveTools.split(",").map((t) => t.trim()).filter(Boolean);
  // `--tools` allowlists ALL tools, including ones registered by explicitly
  // loaded (`-e`) extensions — not just built-ins. subagent-done.ts is always
  // loaded into every restricted child and registers `ask_question`, but
  // without its name here the tool is loaded yet invisible/uncallable: the
  // model has no way to ask the orchestrator anything. Likewise the spawning
  // trio must be present whenever this agent is granted spawning, or its own
  // `subagent`/`subagent_message`/`subagents_list` calls silently don't exist
  // despite `PI_HERD_ALLOWED` being set. Merge and dedupe rather than blindly
  // append, in case an agent's frontmatter already lists one of these.
  const merged = Array.from(new Set([...base, ...extraTools]));
  // Spawning tools are registered by this very extension file — always include it.
  const extensionArgs: string[] = ["-e", fileURLToPath(import.meta.url)];
  const seen = new Set<string>([fileURLToPath(import.meta.url)]);
  for (const tool of merged) {
    const path = getToolExtensionPath(tool);
    if (path && !seen.has(path)) {
      seen.add(path);
      extensionArgs.push("-e", path);
    }
  }
  return { toolAllowlist: merged.join(","), extensionArgs };
}

/**
 * Mutate a pi command's argv array: model, identity (system prompt), and the
 * default-deny tool/extension restriction. This is the single source of truth
 * for reconstructing a subagent's sandbox, used both by the initial launch
 * and the resume path so the two can never drift.
 *
 * Unlike the upstream tmux version this builds an argv array (execFile-style)
 * — no shell, no quoting, no line-wrap hazards.
 */
function applySandboxToParts(
  parts: string[],
  loadout: SubagentLoadout,
  _opts: { artifactDir: string; name: string },
): void {
  if (loadout.model) {
    const model = loadout.thinking ? `${loadout.model}:${loadout.thinking}` : loadout.model;
    parts.push("--model", model);
  }
  // NOTE: identity/system-prompt text is intentionally NOT passed via
  // `--append-system-prompt`/`--system-prompt` here. herdr's `agent start`
  // rejects any CLI argument containing a newline ("agent arguments cannot
  // be encoded safely for the target shell") and agent identity bodies are
  // always multi-line markdown. Instead the identity block is folded into
  // the task file content in launchSubagent() (see `roleBlock`), which is
  // passed as a single-line `@path` argument. `loadout.identity` /
  // `loadout.systemPromptMode` are kept for informational/resume parity
  // only.
  if (loadout.toolAllowlist !== null) {
    parts.push("--no-extensions", "--tools", loadout.toolAllowlist);
    const { extensionArgs } = buildSubagentToolAllowlist(loadout.toolAllowlist);
    parts.push(...extensionArgs);
    // Fail closed: never spawn a restricted child without the permission
    // system. Without it the child has no path denies (~/.pgpass, *.env,
    // auth.json, ...) and no ask/deny command gates.
    if (!PERMISSION_SYSTEM_ENTRY) {
      throw new Error(
        "subagents-herdr: @gotgenes/pi-permission-system not found under the agent npm dir — " +
          "refusing to spawn an ungated restricted child. Run `pi update --extensions` " +
          "(the package is declared in settings.json `packages`) or adjust PERMISSION_SYSTEM_ENTRY.",
      );
    }
    parts.push("-e", PERMISSION_SYSTEM_ENTRY);
  }
  // Load herdr's own pi lifecycle integration into restricted children so
  // herdr reports authoritative working/idle status for them too. Skipped
  // silently if the integration isn't installed on this machine.
  const herdrIntegrationPath = join(getAgentConfigDir(), "extensions", "herdr-agent-state.ts");
  if (existsSync(herdrIntegrationPath) && loadout.toolAllowlist !== null) {
    parts.push("-e", herdrIntegrationPath);
  }
  // Always load subagent-done.ts so the child gets ask_question + the tools
  // widget, and so the sandbox stays deny-by-default.
  parts.push("-e", join(SUBAGENTS_DIR, "subagent-done.ts"));
  // Suppress the interactive project-trust prompt: the parent already
  // trusted its own working directory, and a fresh role-folder cwd would
  // otherwise block herdr's `agent start` readiness check on a dialog.
  parts.push("--approve");
}

// ── Tool parameter schema ──

const SubagentParams = Type.Object({
  agent: Type.String({
    description:
      "Which agent to spawn (e.g. 'worker', 'scout', 'researcher'). This loads the agent's fixed profile — its model, tool loadout, and system prompt. Must be one of the available agents.",
  }),
  task: Type.String({ description: "Task/prompt for the sub-agent" }),
  name: Type.Optional(
    Type.String({
      description:
        "Optional cosmetic label for the subagent's pane and widget row. Defaults to the agent name. Has no effect on which agent runs — use `agent` for that.",
    }),
  ),
  model: Type.Optional(Type.String({ description: "Model override (overrides agent default)" })),
  cwd: Type.Optional(
    Type.String({
      description:
        "Working directory for the sub-agent. The agent starts in this folder and picks up its local .pi/ config, CLAUDE.md, skills, etc.",
    }),
  ),
});

// ── Runtime state ──

interface RunningSubagent {
  id: string;
  name: string;
  /** Sanitized name used with herdr (`agent start`/`agent prompt` target). */
  herdrName: string;
  task: string;
  agent?: string;
  paneId: string;
  startTime: number;
  sessionFile: string;
  abortController: AbortController;
  statusState: SubagentStatusState;
  interactive: boolean;
  watchHandle?: PaneWatchHandle;
  /** Herdr-independent completion poller (see watchExitSidecar). */
  exitSidecarWatch?: { stop(): void };
  /** Resolves the pending watchSubagent() promise once herdr reports exit. */
  resolveExit?: (reason: "released" | "closed" | "cancelled") => void;
  /** Cheap periodic re-parse of the session file for live token/cost display. */
  lastStats?: SessionStats | null;
  /**
   * True if `startAgent`'s readiness wait failed but the process was
   * confirmed alive anyway (see startAgentResilient). Surfaced in the ack
   * text so the orchestrator knows detection was flaky, without treating it
   * as an error.
   */
  startupRecovered?: boolean;
  /**
   * True when the process was presumed alive purely from session-file
   * growth, with herdr's own pane/agent tracking apparently not reporting
   * anything for this pane at all (observed live on long-running tasks).
   * Completion is caught via `exitSidecarWatch` rather than herdr events.
   */
  herdrTrackingUnavailable?: boolean;
}

const runningSubagents = new Map<string, RunningSubagent>();
(globalThis as any)[RUNNING_CHILDREN_COUNT_KEY] = () => runningSubagents.size;

interface SubagentResult {
  name: string;
  task: string;
  summary: string;
  sessionFile?: string;
  sessionId?: string | null;
  reason: "completed" | "error" | "crashed" | "cancelled";
  errorMessage?: string;
  elapsed: number;
  stats?: SessionStats | null;
}

let latestCtx: ExtensionContext | null = null;
let latestPi: ExtensionAPI | null = null;
let shuttingDown = false;

/** Guarded sendMessage: never call into a torn-down session's pi API. */
function safeSendMessage(msg: any, opts?: any): void {
  if (shuttingDown) return;
  try {
    latestPi?.sendMessage(msg, opts);
  } catch {
    // Session may have been replaced/reloaded between the check and the call
    // (newSession/fork/switchSession/reload); never let a steer delivery
    // crash the extension host.
  }
}
let widgetInterval: ReturnType<typeof setInterval> | null = null;
let statusInterval: ReturnType<typeof setInterval> | null = null;

const statusConfig = loadStatusConfig();

function getShellReadyDelayMs(): number {
  // Kept as a no-op knob for parity with the upstream env var name space;
  // herdr's `agent start` deterministically waits for readiness itself, so
  // there is no blind sleep to tune here anymore.
  return 0;
}

function herdrUnavailableResult() {
  return {
    content: [{ type: "text" as const, text: `Subagents require herdr. ${herdrSetupHint()}` }],
    details: { error: "herdr not available" },
  };
}

function getArtifactDir(sessionDir: string, sessionId: string): string {
  return join(sessionDir, "artifacts", sessionId);
}

/**
 * Launch (or resume) a pi process in `pane` via `herdr agent start`,
 * tolerating readiness-detection false negatives instead of treating every
 * `startAgent` failure as fatal.
 *
 * Background: herdr's own wait-for-readiness inside `agent start` was
 * observed, live, to time out even though the launched process was already
 * running and had completed several turns of real work well inside the
 * timeout window. Blindly trusting that failure is dangerous two ways: (1)
 * the pane gets killed out from under a perfectly healthy, working agent
 * (data loss — its eventual result is never delivered), or (2) the caller
 * retries, spawning a SECOND process against the same (possibly
 * non-idempotent) task while the first keeps running unobserved.
 *
 * On failure, this polls `confirmAgentAlive` before giving up. If the pane
 * genuinely has a live `pi` agent, the launch is treated as successful —
 * the herdr target to address it by is the requested name if that resolved
 * server-side, falling back to the pane id (always a valid herdr target)
 * when it didn't. Only closes the pane and reports failure when the agent
 * is genuinely absent.
 */
/**
 * Summarize a subagent's session file (and, as a last resort, its pane
 * screen) into a SubagentResult. Priority: `.exit` sidecar (error path) →
 * last assistant message in the session transcript → live pane screen
 * content (crash fallback). Pure w.r.t. process state — does not close the
 * pane or touch `runningSubagents`; callers decide that.
 */
async function summarizeFinishedSubagent(params: {
  name: string;
  task: string;
  sessionFile: string;
  paneId: string;
  elapsed: number;
}): Promise<SubagentResult> {
  const { name, task, sessionFile, paneId, elapsed } = params;
  let reason: SubagentResult["reason"] = "completed";
  let summary: string | undefined;
  let errorMessage: string | undefined;

  const exitSidecar = `${sessionFile}.exit`;
  if (existsSync(exitSidecar)) {
    try {
      const data = JSON.parse(readFileSync(exitSidecar, "utf8"));
      unlinkSync(exitSidecar);
      if (data?.type === "error") {
        reason = "error";
        errorMessage = typeof data.errorMessage === "string" ? data.errorMessage : "Subagent exited with an error.";
      }
    } catch {
      // ignore malformed sidecar
    }
  }

  if (!errorMessage && existsSync(sessionFile)) {
    const allEntries = getNewEntries(sessionFile, 0);
    summary = findLastAssistantMessage(allEntries) ?? undefined;
  }

  if (!summary && !errorMessage) {
    const screen = await readPane(paneId, { lines: 200 });
    summary = screen.trim() || undefined;
    if (!summary) {
      reason = "crashed";
      summary = "Subagent exited without producing any output.";
    }
  }

  const stats = existsSync(sessionFile) ? summarizeSessionStats(sessionFile) : null;
  const subagentSessionId = existsSync(sessionFile) ? getSessionId(sessionFile) : null;

  return {
    name,
    task,
    summary: errorMessage ? `Subagent error: ${errorMessage}` : summary ?? "Sub-agent exited without output.",
    sessionFile,
    sessionId: subagentSessionId,
    reason: errorMessage ? "error" : reason,
    errorMessage,
    elapsed,
    stats,
  };
}

type StartAgentOutcome =
  | { ok: true; herdrTarget: string; recovered: boolean; herdrTrackingUnavailable?: boolean; alreadyFinished?: false }
  | { ok: true; alreadyFinished: true; result: SubagentResult }
  | { ok: false; error: string };

async function startAgentResilient(options: {
  requestedName: string;
  pane: string;
  argv: string[];
  timeoutMs: number;
  /** Needed only for the liveness/completion fallbacks below. */
  name: string;
  task: string;
  sessionFile: string;
  startTime: number;
  /**
   * Entry-count cursor: only entries appended AFTER this line count as
   * evidence for this attempt. Required for resume: `sessionFile` already
   * has prior turns from before this attempt, so counting from 0 would
   * treat a resume that never even started as already alive/finished using
   * stale content. Fresh launches use a brand-new file, so 0 (the default)
   * is correct there.
   */
  afterLine?: number;
}): Promise<StartAgentOutcome> {
  const startResult = await startAgent({
    name: options.requestedName,
    pane: options.pane,
    argv: options.argv,
    timeoutMs: options.timeoutMs,
  });
  if (startResult.ok) {
    return { ok: true, herdrTarget: options.requestedName, recovered: false };
  }

  const confirmed = await confirmAgentAlive(options.pane, { attempts: 6, intervalMs: 1500 });
  if (confirmed) {
    // Alive despite the reported failure: the requested --name may or may
    // not have been attached server-side before the wait gave up. Verify
    // before trusting it; fall back to the pane id, which always addresses
    // this agent.
    const byName = await getAgent(options.requestedName);
    const herdrTarget = byName && byName.pane_id === options.pane ? options.requestedName : options.pane;
    return { ok: true, herdrTarget, recovered: true };
  }

  // herdr itself may have lost track of this pane entirely after its own
  // readiness wait gave up — observed live: `agent get <pane>` returned
  // nothing for a pane that demonstrably had a working, multi-turn pi
  // process inside it (its session file kept growing with real turns for
  // minutes after herdr had already "forgotten" it). Never trust herdr's
  // silence here as proof of death: check the session file directly, which
  // pi writes itself and is therefore authoritative regardless of whether
  // herdr is still tracking the pane.
  const afterLine = options.afterLine ?? 0;
  const exitSidecarPath = `${options.sessionFile}.exit`;

  // Case 1: the task already fully finished within this window (fast task,
  // exactly like a toy "say X and stop" spawn) — `subagent-done.ts` writes
  // this sidecar on EVERY clean/error exit, so its presence is a definitive,
  // herdr-independent "the child's turn loop has ended" signal. Resolve and
  // deliver the real result immediately instead of reporting a false
  // failure.
  if (existsSync(exitSidecarPath)) {
    const elapsed = Math.floor((Date.now() - options.startTime) / 1000);
    const result = await summarizeFinishedSubagent({
      name: options.name,
      task: options.task,
      sessionFile: options.sessionFile,
      paneId: options.pane,
      elapsed,
    });
    await closePane(options.pane);
    return { ok: true, alreadyFinished: true, result };
  }

  // Case 2: no completion signal yet, but give a slow-to-appear session file
  // a little extra grace before concluding pi never started at all. Normal
  // startup (per repeated control tests) reaches this point in low
  // single-digit seconds, so this is a safety margin, not the primary
  // detection path.
  for (let i = 0; i < 5 && countSessionEntryLines(options.sessionFile) <= afterLine; i++) {
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Case 3: the session file has grown past this attempt's starting point —
  // real proof pi launched and is doing something, however long it takes.
  // A long or multi-turn task can run for minutes without ever reporting
  // "idle" to herdr (an autonomous tool-calling loop has no reason to pause
  // at idle between turns), so "herdr never confirmed readiness" is NOT
  // evidence of failure here. Do NOT kill the pane merely because we
  // couldn't quickly confirm success: register it as running and let the
  // (herdr-event OR sidecar-file) watcher determine the real, eventual
  // outcome whenever it actually happens. `herdrTrackingUnavailable` flags
  // that herdr's own status/lifecycle reporting may stay silent for this
  // pane — completion will still be caught via the sidecar-file poller.
  if (countSessionEntryLines(options.sessionFile) > afterLine) {
    return { ok: true, herdrTarget: options.pane, recovered: true, herdrTrackingUnavailable: true };
  }

  // Case 4: no session-file evidence at all that pi ever got underway (bad
  // model id, permission failure, crash before writing its session header,
  // etc.). This is the only case where closing the pane is safe — there is
  // nothing running in it to strand or duplicate.
  await closePane(options.pane);
  return { ok: false, error: `herdr pane ${options.pane}: ${startResult.error.message}` };
}

/**
 * Poll for a subagent's `.exit` sidecar file appearing on disk — an
 * always-on, herdr-independent completion signal written by
 * `subagent-done.ts` from inside the child process itself on every clean
 * or error exit. Runs alongside (not instead of) `watchPaneLifecycle`'s
 * herdr-event-based watch; whichever signal arrives first wins. This is the
 * fix for herdr's own pane/agent tracking going silent for a pane after its
 * `agent start` readiness wait times out: even if herdr never emits another
 * event for that pane, the sidecar file still appears the moment the child
 * actually finishes, because writing it doesn't depend on herdr at all.
 */
function watchExitSidecar(sessionFile: string, onDone: () => void, intervalMs = 1000): { stop(): void } {
  let stopped = false;
  const sidecarPath = `${sessionFile}.exit`;
  const timer = setInterval(() => {
    if (stopped) return;
    if (existsSync(sidecarPath)) {
      stopped = true;
      clearInterval(timer);
      onDone();
    }
  }, intervalMs);
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
    },
  };
}

function updateWidget() {
  if (shuttingDown) return;
  try {
    if (!latestCtx?.hasUI) return;
    if (runningSubagents.size === 0) {
      latestCtx.ui.setWidget("subagent-status", undefined);
      if (widgetInterval) {
        clearInterval(widgetInterval);
        widgetInterval = null;
        (globalThis as any)[WIDGET_INTERVAL_KEY] = null;
      }
      return;
    }
    latestCtx.ui.setWidget(
      "subagent-status",
      (_tui: any, _theme: any) => ({
        invalidate() {},
        render(width: number) {
          return renderSubagentWidgetLines(Array.from(runningSubagents.values()), width, statusConfig.enabled);
        },
      }),
      { placement: "aboveEditor" },
    );
  } catch {
    // The session may have been replaced/reloaded/shut down between the
    // `shuttingDown` check and this call (ctx.newSession/fork/switchSession/
    // reload, or a race in -p/print-mode teardown). A stale ExtensionContext
    // throws on property access (e.g. `.hasUI`), not just on missing-null —
    // never let a background widget refresh crash the whole process over it.
  }
}

function startWidgetRefresh() {
  if (widgetInterval) return;
  updateWidget();
  widgetInterval = setInterval(updateWidget, 1000);
  (globalThis as any)[WIDGET_INTERVAL_KEY] = widgetInterval;
}

// ── Naming ──

function reservedNames(): Set<string> {
  return new Set(Array.from(runningSubagents.values()).map((r) => r.name));
}

async function uniqueHerdrName(base: string): Promise<string> {
  const sanitizedBase = sanitizeHerdrName(base);
  const liveNames = await listAgentNames();
  const reserved = reservedNames();
  let candidate = sanitizedBase;
  let suffix = 2;
  while (liveNames.has(candidate) || reserved.has(candidate)) {
    const suffixStr = `-${suffix}`;
    candidate = `${sanitizedBase.slice(0, 32 - suffixStr.length)}${suffixStr}`;
    suffix++;
  }
  return candidate;
}

// ── Session mode / launch behavior resolution (mux-agnostic) ──

function resolveEffectiveSessionMode(agentDefs: AgentDefaults | null): SubagentSessionMode {
  return agentDefs?.sessionMode ?? "standalone";
}

function resolveLaunchBehavior(
  params: Static<typeof SubagentParams>,
  agentDefs: AgentDefaults | null,
): {
  autoExit: boolean;
  seededSessionMode: "lineage-only" | "fork" | null;
} {
  const sessionMode = resolveEffectiveSessionMode(agentDefs);
  return {
    autoExit: agentDefs?.autoExit ?? true,
    seededSessionMode: sessionMode === "standalone" ? null : sessionMode,
  };
}

function resolveEffectiveInteractive(agentDefs: AgentDefaults | null, autoExit: boolean): boolean {
  return agentDefs?.interactive ?? !autoExit;
}

function resolveResumeLaunchBehavior(): { autoExit: boolean; interactive: boolean } {
  return { autoExit: true, interactive: false };
}

// ── Launch ──

async function launchSubagent(
  params: Static<typeof SubagentParams>,
  ctx: {
    sessionManager: { getSessionFile(): string | null; getSessionId(): string; getSessionDir(): string };
  },
): Promise<
  | { ok: true; running: RunningSubagent }
  | { ok: true; alreadyFinished: true; result: SubagentResult }
  | { ok: false; error: string }
> {
  const agentDefs = params.agent ? loadAgentDefaults(params.agent) : null;
  const { effectiveCwd, effectiveAgentDir } = resolveSubagentPaths(params, agentDefs);

  const sessionFile = ctx.sessionManager.getSessionFile()!;
  const sessionId = ctx.sessionManager.getSessionId();
  const sessionDir = ctx.sessionManager.getSessionDir();
  const artifactDir = getArtifactDir(sessionDir, sessionId);
  mkdirSync(artifactDir, { recursive: true });

  const timestamp = Date.now().toString(36);
  const uuid = [Math.random().toString(16).slice(2, 10), Math.random().toString(16).slice(2, 6)].join("-");
  const subagentSessionFile = join(artifactDir, `${timestamp}_${uuid}.jsonl`);

  const launchBehavior = resolveLaunchBehavior(params, agentDefs);
  if (launchBehavior.seededSessionMode) {
    seedSubagentSessionFile({
      mode: launchBehavior.seededSessionMode,
      parentSessionFile: sessionFile,
      childSessionFile: subagentSessionFile,
      childCwd: effectiveCwd ?? process.cwd(),
    });
  }

  const grantSpawning = !!(agentDefs?.subagentAgents && agentDefs.subagentAgents.length > 0);
  // Always grant `ask_question` on a restricted spawn (subagent-done.ts is
  // always loaded and registers it) so the model can actually ask the
  // orchestrator something instead of guessing or dead-ending. Grant the
  // spawning trio too when this agent's frontmatter allows it to delegate.
  const extraTools = grantSpawning ? ["ask_question", ...SPAWNING_TOOLS] : ["ask_question"];
  const toolAllowlist = buildSubagentToolAllowlist(agentDefs?.tools, extraTools);
  const interactive = resolveEffectiveInteractive(agentDefs, launchBehavior.autoExit);

  const displayName = (params.name ?? params.agent ?? "subagent").trim() || "subagent";
  const name = displayName; // display name shown in widget/tool calls
  const id = `${timestamp}-${Math.random().toString(16).slice(2, 8)}`;
  const herdrName = await uniqueHerdrName(displayName);

  const loadout: SubagentLoadout = {
    agent: params.agent ?? null,
    toolAllowlist: toolAllowlist.toolAllowlist,
    model: params.model ?? agentDefs?.model ?? null,
    thinking: agentDefs?.thinking ?? null,
    systemPromptMode: agentDefs?.systemPromptMode ?? null,
    identity: agentDefs?.body ?? null,
    spawnable: grantSpawning ? agentDefs!.subagentAgents! : null,
    autoExit: launchBehavior.autoExit,
    cwd: effectiveCwd,
    agentDir: effectiveAgentDir,
  };
  writeSubagentLoadout(subagentSessionFile, loadout);

  const parts: string[] = ["--session", subagentSessionFile];
  applySandboxToParts(parts, loadout, { artifactDir, name });

  // Task prompt: identity/system-prompt text is always folded into the task
  // file (never passed as a raw CLI arg — see the note in
  // applySandboxToParts). Fork mode still inherits parent context directly
  // via the resumed session file; the identity block is prepended regardless
  // of `systemPromptMode` since there is no CLI system-prompt path anymore.
  const roleBlock = loadout.identity ? `\n\n${loadout.identity}` : "";
  const summaryInstruction = launchBehavior.autoExit
    ? "Your FINAL assistant message should summarize what you accomplished."
    : "Your FINAL assistant message (before the user exits) should summarize what you accomplished.";
  const fullTask = `${params.task}${roleBlock}\n\n${summaryInstruction}`;

  const taskFile = join(artifactDir, "subagent-tasks", `${id}.md`);
  mkdirSync(dirname(taskFile), { recursive: true });
  writeFileSync(taskFile, fullTask, "utf8");
  parts.push(`@${taskFile}`);

  const env: Record<string, string> = {
    PI_HERD_NAME: name,
    PI_HERD_SESSION: subagentSessionFile,
    PI_HERD_ID: id,
  };
  if (effectiveAgentDir) env.PI_CODING_AGENT_DIR = effectiveAgentDir;
  if (grantSpawning && agentDefs?.subagentAgents) {
    env.PI_HERD_ALLOWED = agentDefs.subagentAgents.join(",");
  }
  if (params.agent) env.PI_HERD_AGENT = params.agent;
  if (launchBehavior.autoExit) env.PI_HERD_AUTO_EXIT = "1";

  const startTime = Date.now();
  // herdr's `pane split --cwd` silently falls back to a default directory
  // (observed: the caller's home dir) when the requested cwd doesn't exist,
  // rather than erroring — easy to hit here since a common use case (a
  // worker scaffolding a brand-new project directory) has a cwd that
  // doesn't exist yet. Create it first so the subagent actually lands where
  // its task description says it will.
  if (effectiveCwd) {
    try {
      mkdirSync(effectiveCwd, { recursive: true });
    } catch {
      // Best-effort: if this fails, splitPane below will surface its own
      // error (or herdr will fall back, which is at least visible in the
      // pane's actual cwd for debugging).
    }
  }
  const splitResult = await splitPane({ cwd: effectiveCwd ?? undefined, env });
  if (!splitResult.ok) {
    return { ok: false, error: `Failed to create herdr pane: ${splitResult.error.message}` };
  }
  const paneId = splitResult.result.paneId;

  const startTimeoutMs = Number.parseInt(process.env.PI_HERD_START_TIMEOUT_MS ?? "", 10) || 30000;
  const startOutcome = await startAgentResilient({
    requestedName: herdrName,
    pane: paneId,
    argv: ["pi", ...parts],
    timeoutMs: startTimeoutMs,
    name,
    task: params.task,
    sessionFile: subagentSessionFile,
    startTime,
  });
  if (!startOutcome.ok) {
    return { ok: false, error: `Failed to start subagent "${name}" in ${startOutcome.error}` };
  }
  if (startOutcome.alreadyFinished) {
    registerName(artifactDir, name, { sessionFile: subagentSessionFile, sessionId: getSessionId(subagentSessionFile) });
    return { ok: true, alreadyFinished: true, result: startOutcome.result };
  }
  const herdrTarget = startOutcome.herdrTarget;

  registerName(artifactDir, name, { sessionFile: subagentSessionFile, sessionId: getSessionId(subagentSessionFile) });

  const abortController = new AbortController();
  const running: RunningSubagent = {
    id,
    name,
    herdrName: herdrTarget,
    task: params.task,
    agent: params.agent,
    paneId,
    startTime,
    sessionFile: subagentSessionFile,
    abortController,
    interactive,
    statusState: createStatusState({ startTimeMs: startTime }),
    startupRecovered: startOutcome.recovered,
    herdrTrackingUnavailable: startOutcome.herdrTrackingUnavailable,
  };
  runningSubagents.set(id, running);
  startWidgetRefresh();
  startStatusRefresh(latestPi!);

  running.watchHandle = watchPaneLifecycle(paneId, {
    onStatus: (status: HerdrAgentStatus) => {
      running.statusState = observeStatus(running.statusState, status, Date.now());
      updateWidget();
    },
    // If herdr's own tracking already proved unreliable for this pane (see
    // startAgentResilient), don't trust its "released" signal either — that
    // callback can also fire from watchPaneLifecycle's `getAgent`-based poll
    // fallback, the exact call we already know returns nothing for this
    // pane. A false "released" here would re-trigger the original bug
    // (premature closePane on a still-working process). Rely solely on the
    // sidecar-file watch below for completion in that case; a genuine
    // `pane_closed` push event (not poll-derived) is still trusted either
    // way since it never depends on `getAgent`.
    onReleased: startOutcome.herdrTrackingUnavailable
      ? () => {}
      : () => {
          running.resolveExit?.("released");
        },
    onClosed: () => {
      running.resolveExit?.("closed");
    },
  });
  // Redundant, herdr-independent completion signal (see watchExitSidecar):
  // whichever of this or the herdr-event watch above fires first wins.
  running.exitSidecarWatch = watchExitSidecar(subagentSessionFile, () => {
    running.resolveExit?.("released");
  });

  return { ok: true, running };
}

/**
 * Watch a launched subagent until herdr reports its agent process released
 * (or the pane closed / the parent aborted). Extracts the summary from the
 * session file, cleans up the pane + watcher, and removes the runningSubagents entry.
 */
async function watchSubagent(running: RunningSubagent, signal: AbortSignal): Promise<SubagentResult> {
  const { name, task, sessionFile, startTime } = running;

  const exitReason = await new Promise<"released" | "closed" | "cancelled">((resolvePromise) => {
    running.resolveExit = resolvePromise;
    const onAbort = () => resolvePromise("cancelled");
    signal.addEventListener("abort", onAbort, { once: true });
  });

  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  running.watchHandle?.stop();
  running.exitSidecarWatch?.stop();

  try {
    if (exitReason === "cancelled") {
      await closePane(running.paneId);
      runningSubagents.delete(running.id);
      return { name, task, summary: "Subagent cancelled.", reason: "cancelled", elapsed, sessionFile };
    }

    const result = await summarizeFinishedSubagent({ name, task, sessionFile, paneId: running.paneId, elapsed });
    await closePane(running.paneId);
    runningSubagents.delete(running.id);
    return result;
  } catch (err: any) {
    try {
      await closePane(running.paneId);
    } catch {
      // ignore
    }
    runningSubagents.delete(running.id);
    return {
      name,
      task,
      summary: `Subagent error: ${err?.message ?? String(err)}`,
      reason: "error",
      errorMessage: err?.message ?? String(err),
      elapsed: Math.floor((Date.now() - startTime) / 1000),
    };
  }
}

function resolveResultPresentation(
  result: Pick<SubagentResult, "reason" | "elapsed" | "summary" | "sessionFile" | "sessionId" | "errorMessage">,
  name: string,
): string {
  const sessionRef = `\n\nFollow up with subagent_message({ name: "${name}", message: "…" })`;
  if (result.errorMessage) {
    return `Subagent "${name}" failed after ${formatElapsed(result.elapsed)}: ${result.errorMessage}${sessionRef}`;
  }
  if (result.reason === "crashed") {
    return `Subagent "${name}" exited unexpectedly after ${formatElapsed(result.elapsed)} with no output.${sessionRef}`;
  }
  return `Subagent "${name}" finished in ${formatElapsed(result.elapsed)}:\n\n${result.summary}${sessionRef}`;
}

// ── subagent_message: steer running or resume finished ──

function resolveRunningByName(requestedName: string): { running: RunningSubagent } | { error: string } {
  const matches = Array.from(runningSubagents.values()).filter((r) => r.name === requestedName);
  if (matches.length === 0) return { error: `No running subagent named "${requestedName}".` };
  if (matches.length > 1) {
    const candidates = matches.map((running) => `${running.name} [${running.id}]`).join(", ");
    return { error: `Ambiguous subagent name "${requestedName}". Matches: ${candidates}` };
  }
  return { running: matches[0] };
}

async function steerSubagent(running: RunningSubagent, message: string): Promise<{ ok: true } | { error: string }> {
  const flattened = message.replace(/\s*\n\s*/g, " ").trim();
  const res = await promptAgent(running.herdrName, flattened);
  if (!res.ok) {
    return { error: `Failed to deliver message to subagent "${running.name}" via herdr: ${res.error.message}` };
  }
  return { ok: true };
}

async function handleSubagentSteer(params: { name?: string; message?: string }) {
  const message = params.message?.trim();
  if (!message) {
    const err = "`message` is required to steer a running subagent.";
    return { content: [{ type: "text" as const, text: err }], details: { error: err } };
  }
  const resolved = resolveRunningByName(params.name ?? "");
  if ("error" in resolved) {
    return { content: [{ type: "text" as const, text: resolved.error }], details: { error: resolved.error } };
  }
  const running = resolved.running;
  const now = Date.now();
  const steer = await steerSubagent(running, message);
  if ("error" in steer) {
    return {
      content: [{ type: "text" as const, text: steer.error }],
      details: { error: steer.error, id: running.id, name: running.name },
    };
  }
  running.statusState = forceStatusAfterInterrupt(running.statusState, now);
  updateWidget();
  return {
    content: [
      {
        type: "text" as const,
        text: `Message delivered to running subagent "${running.name}". It picks this up at its next turn boundary. If it exits, its result still arrives as a steer message.`,
      },
    ],
    details: { id: running.id, name: running.name, status: "steered" },
  };
}

let statusTick = 0;

function startStatusRefresh(pi: ExtensionAPI) {
  if (!statusConfig.enabled || statusInterval) return;
  statusInterval = setInterval(() => {
    if (runningSubagents.size === 0) {
      if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
        (globalThis as any)[STATUS_INTERVAL_KEY] = null;
      }
      return;
    }
    const transitionLines: string[] = [];
    const now = Date.now();
    let shouldRefreshWidget = false;
    statusTick++;
    const refreshStats = statusTick % 3 === 0; // every ~3s: cheap enough, avoids re-parsing large transcripts every tick

    for (const running of runningSubagents.values()) {
      deliverPendingQuestion(running);
      const { nextState, snapshot, transition } = advanceStatusState(running.statusState, now);
      if (nextState.lastStatus !== running.statusState.lastStatus) shouldRefreshWidget = true;
      running.statusState = nextState;
      if (transition && !running.interactive) {
        transitionLines.push(formatTransitionLine(running.name, snapshot, transition));
      }
      if (refreshStats && existsSync(running.sessionFile)) {
        try {
          running.lastStats = summarizeSessionStats(running.sessionFile);
          shouldRefreshWidget = true;
        } catch {
          // best-effort; keep last known stats
        }
      }
    }

    if (shouldRefreshWidget) updateWidget();
    if (transitionLines.length > 0) {
      const capped = capStatusLines(transitionLines, statusConfig.lineLimit);
      pi.sendMessage(
        {
          customType: "subagent_status",
          content: formatStatusAggregate(transitionLines, statusConfig.lineLimit),
          display: true,
          details: { lines: capped.visibleLines, overflow: capped.overflow },
        },
        { triggerTurn: true, deliverAs: "steer" },
      );
    }
  }, 1000);
  (globalThis as any)[STATUS_INTERVAL_KEY] = statusInterval;
}

const deliveredAsks = new Set<string>();

function deliverPendingQuestion(running: RunningSubagent) {
  const askFile = `${running.sessionFile}.ask`;
  if (deliveredAsks.has(running.id) || !existsSync(askFile)) return;
  try {
    const payload = JSON.parse(readFileSync(askFile, "utf8"));
    unlinkSync(askFile);
    deliveredAsks.add(running.id);
    const elapsed = Math.floor((Date.now() - running.startTime) / 1000);
    const replyHint = `\n\nReply with subagent_message({ name: "${running.name}", message: "…" }).`;
    void notify(`${running.name} needs input`, payload.question);
    safeSendMessage(
      {
        customType: "subagent_question",
        content: `Sub-agent "${running.name}" asks (${formatElapsed(elapsed)}):\n\n${payload.question}${replyHint}`,
        display: true,
        details: { name: running.name, agent: running.agent, question: payload.question },
      },
      { triggerTurn: true, deliverAs: "steer" },
    );
  } catch {
    // ignore malformed .ask payloads
  }
}

// ── Extension entry point ──

export default function subagentsHerdrExtension(pi: ExtensionAPI) {
  latestPi = pi;
  shuttingDown = false;

  pi.on("session_start", (_event, ctx) => {
    latestCtx = ctx;
    shuttingDown = false;
  });

  pi.on("session_shutdown", () => {
    shuttingDown = true;
    latestCtx = null;
    if (widgetInterval) {
      clearInterval(widgetInterval);
      widgetInterval = null;
      (globalThis as any)[WIDGET_INTERVAL_KEY] = null;
    }
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
      (globalThis as any)[STATUS_INTERVAL_KEY] = null;
    }
    for (const [, agent] of runningSubagents) {
      agent.watchHandle?.stop();
      agent.exitSidecarWatch?.stop();
      agent.abortController.abort();
    }
    runningSubagents.clear();
  });

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      "Spawn a sub-agent in a dedicated herdr pane. This is a fire-and-forget async tool: the call returns immediately with only an acknowledgement. " +
      "When the sub-agent finishes, the harness AUTOMATICALLY delivers its result as a steer message that wakes you up and starts a new turn — you do not need to do anything to receive it. " +
      "DO NOT write polling loops, sleep/wait commands, tail/watch scripts, or repeatedly read session/log files to detect completion. DO NOT call subagents_list or any other tool to 'check' status. " +
      "After spawning, either end your turn immediately, or work on other independent tasks (including spawning more subagents in parallel). The harness will wake you with the result when it is ready.",
    parameters: SubagentParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const currentAgent = process.env.PI_HERD_AGENT;
      if (params.agent && currentAgent && params.agent === currentAgent) {
        return {
          content: [
            {
              type: "text",
              text: `You are the ${currentAgent} agent — do not start another ${currentAgent}. You were spawned to do this work yourself. Complete the task directly.`,
            },
          ],
          details: { error: "self-spawn blocked" },
        };
      }

      const permitted = SUBAGENT_ALLOWLIST;
      if (permitted && !permitted.has(params.agent)) {
        const permittedList = Array.from(permitted).join(", ") || "(none)";
        return {
          content: [
            {
              type: "text",
              text: `Agent "${params.agent}" is not in your permitted set. Available agents: ${permittedList}.`,
            },
          ],
          details: { error: "agent not in allowlist" },
        };
      }
      const allAgents = discoverAgentDefinitions();
      if (!permitted && !allAgents.some((a) => a.name === params.agent)) {
        const availableList = allAgents.map((a) => a.name).join(", ") || "(none)";
        return {
          content: [{ type: "text", text: `Unknown agent "${params.agent}". Available agents: ${availableList}.` }],
          details: { error: "unknown agent" },
        };
      }

      if (!isHerdrAvailable()) return herdrUnavailableResult();
      if (!ctx.sessionManager.getSessionFile()) {
        return {
          content: [{ type: "text", text: "Error: no session file. Start pi with a persistent session to use subagents." }],
          details: { error: "no session file" },
        };
      }

      const launch = await launchSubagent(params, ctx as any);
      if (!launch.ok) {
        return { content: [{ type: "text", text: launch.error }], details: { error: launch.error } };
      }
      if ("alreadyFinished" in launch) {
        // The subagent ran to completion and auto-exited before herdr's
        // readiness detection ever confirmed it was starting up (typical for
        // fast, short tasks) — there is nothing left to watch. Deliver the
        // result immediately instead of reporting a false failure (which
        // would either strand a successful result undelivered or invite a
        // retry that duplicates the same task a second time).
        const text = resolveResultPresentation(launch.result, launch.result.name);
        updateWidget();
        return {
          content: [
            {
              type: "text",
              text: `Subagent "${launch.result.name}" (${params.agent}) already finished before herdr could confirm its startup (it ran quickly and auto-exited) — delivering its result now instead of reporting a false failure.\n\n${text}`,
            },
          ],
          details: launch.result as any,
        };
      }
      const running = launch.running;

      void watchSubagent(running, running.abortController.signal).then((result) => {
        const text = resolveResultPresentation(result, result.name);
        safeSendMessage(
          {
            customType: "subagent_result",
            content: text,
            display: true,
            details: result as any,
          },
          { triggerTurn: true, deliverAs: "steer" },
        );
        updateWidget();
      });

      return {
        content: [
          {
            type: "text",
            text: `Spawned subagent "${running.name}" (${params.agent}) in herdr pane ${running.paneId}.${
              running.herdrTrackingUnavailable
                ? " (herdr's startup detection timed out and its own status tracking for this pane appears unavailable, but the session file shows it is alive and working — monitoring for completion directly; this can happen on longer tasks and the widget's live status may not update until it finishes.)"
                : running.startupRecovered
                  ? " (herdr's startup-readiness check timed out but the process was confirmed alive and running — proceeding normally.)"
                  : ""
            } Its result will arrive as a steer message when it finishes.`,
          },
        ],
        details: {
          id: running.id,
          name: running.name,
          paneId: running.paneId,
          startupRecovered: running.startupRecovered ?? false,
          herdrTrackingUnavailable: running.herdrTrackingUnavailable ?? false,
        },
      };
    },
  });

  pi.registerTool({
    name: "subagent_message",
    label: "Message subagent",
    description:
      "Message a subagent by name — steers it if it's still running, or resumes its session (fire-and-forget, autonomous) if it already finished.",
    parameters: Type.Object({
      name: Type.String({ description: "The subagent's display name (as returned by `subagent`)." }),
      message: Type.String({ description: "The follow-up message." }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const requestedName = params.name?.trim();
      if (!requestedName) {
        const err = "Provide the subagent's `name` to steer (if running) or resume (if finished).";
        return { content: [{ type: "text" as const, text: err }], details: { error: err } };
      }
      if (!isHerdrAvailable()) return herdrUnavailableResult();

      const runningMatch = Array.from(runningSubagents.values()).find((r) => r.name === requestedName);
      if (runningMatch) {
        return handleSubagentSteer({ name: requestedName, message: params.message });
      }

      // ── Resume a finished subagent ──
      const sessionFile = ctx.sessionManager.getSessionFile();
      if (!sessionFile) {
        const err = "No session file for the current session.";
        return { content: [{ type: "text" as const, text: err }], details: { error: err } };
      }
      const sessionId = ctx.sessionManager.getSessionId();
      const sessionDir = ctx.sessionManager.getSessionDir();
      const artifactDir = getArtifactDir(sessionDir, sessionId);
      const entry = resolveNameInRegistry(artifactDir, requestedName);
      if (!entry) {
        const known = Object.keys(readNameRegistry(artifactDir));
        const err = `No subagent named "${requestedName}" found (running or resumable). Known names: ${known.join(", ") || "(none)"}.`;
        return { content: [{ type: "text" as const, text: err }], details: { error: err } };
      }
      const sessionPath = entry.sessionFile;
      if (!existsSync(sessionPath)) {
        const err = `Subagent "${requestedName}"'s session file is missing (${sessionPath}). Cannot resume.`;
        return { content: [{ type: "text" as const, text: err }], details: { error: err } };
      }
      const loadout = readSubagentLoadout(sessionPath);
      if (!loadout) {
        const err = `Subagent "${requestedName}" has no sandbox snapshot to resume from (session predates sandboxed resume).`;
        return { content: [{ type: "text" as const, text: err }], details: { error: err } };
      }

      const { autoExit, interactive } = resolveResumeLaunchBehavior();
      const id = `resume-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`;
      const herdrName = await uniqueHerdrName(requestedName);
      // Cursor for the "did new work actually happen" check in
      // startAgentResilient: the session file already has prior turns from
      // before this resume attempt, so the liveness/completion fallback must
      // only look at entries appended AFTER this point, not the whole file.
      const entryCountBefore = countSessionEntryLines(sessionPath);

      const resumeMsgFile = join(artifactDir, "subagent-tasks", `${id}-resume.md`);
      mkdirSync(dirname(resumeMsgFile), { recursive: true });
      writeFileSync(resumeMsgFile, params.message, "utf8");

      const parts: string[] = ["--session", sessionPath];
      applySandboxToParts(parts, loadout, { artifactDir, name: requestedName });
      parts.push(`@${resumeMsgFile}`);

      const env: Record<string, string> = {
        PI_HERD_NAME: requestedName,
        PI_HERD_SESSION: sessionPath,
        PI_HERD_ID: id,
      };
      const resumeAgentDir = loadout.agentDir ?? process.env.PI_CODING_AGENT_DIR ?? null;
      if (resumeAgentDir) env.PI_CODING_AGENT_DIR = resumeAgentDir;
      if (loadout.spawnable && loadout.spawnable.length > 0) env.PI_HERD_ALLOWED = loadout.spawnable.join(",");
      if (loadout.agent) env.PI_HERD_AGENT = loadout.agent;
      if (autoExit) env.PI_HERD_AUTO_EXIT = "1";

      const startTime = Date.now();
      // See the matching comment in launchSubagent: herdr silently falls back
      // to a default cwd if the requested one doesn't exist. Defensive here
      // too in case the original cwd was removed between spawn and resume.
      if (loadout.cwd) {
        try {
          mkdirSync(loadout.cwd, { recursive: true });
        } catch {
          // best-effort
        }
      }
      const splitResult = await splitPane({ cwd: loadout.cwd ?? undefined, env });
      if (!splitResult.ok) {
        const err = `Failed to create herdr pane to resume "${requestedName}": ${splitResult.error.message}`;
        return { content: [{ type: "text" as const, text: err }], details: { error: err } };
      }
      const paneId = splitResult.result.paneId;

      const startTimeoutMs = Number.parseInt(process.env.PI_HERD_START_TIMEOUT_MS ?? "", 10) || 30000;
      const startOutcome = await startAgentResilient({
        requestedName: herdrName,
        pane: paneId,
        argv: ["pi", ...parts],
        timeoutMs: startTimeoutMs,
        name: requestedName,
        task: params.message,
        sessionFile: sessionPath,
        startTime,
        afterLine: entryCountBefore,
      });
      if (!startOutcome.ok) {
        const err = `Failed to resume "${requestedName}" in ${startOutcome.error}`;
        return { content: [{ type: "text" as const, text: err }], details: { error: err } };
      }
      if (startOutcome.alreadyFinished) {
        const text = resolveResultPresentation(startOutcome.result, startOutcome.result.name);
        updateWidget();
        return {
          content: [
            {
              type: "text",
              text: `Subagent "${requestedName}" already finished before herdr could confirm its resumed startup (it ran quickly and auto-exited) — delivering its result now instead of reporting a false failure.\n\n${text}`,
            },
          ],
          details: startOutcome.result as any,
        };
      }
      const herdrTarget = startOutcome.herdrTarget;

      const abortController = new AbortController();
      const running: RunningSubagent = {
        id,
        name: requestedName,
        herdrName: herdrTarget,
        task: params.message,
        agent: loadout.agent ?? undefined,
        paneId,
        startTime,
        sessionFile: sessionPath,
        abortController,
        interactive,
        statusState: createStatusState({ startTimeMs: startTime }),
        startupRecovered: startOutcome.recovered,
        herdrTrackingUnavailable: startOutcome.herdrTrackingUnavailable,
      };
      runningSubagents.set(id, running);
      startWidgetRefresh();
      startStatusRefresh(pi);
      running.watchHandle = watchPaneLifecycle(paneId, {
        onStatus: (status) => {
          running.statusState = observeStatus(running.statusState, status, Date.now());
          updateWidget();
        },
        // See the matching comment in launchSubagent: don't trust a
        // "released" signal for a pane we already know herdr's own
        // `getAgent`-based tracking is unreliable for — rely on the
        // sidecar-file watch below instead.
        onReleased: startOutcome.herdrTrackingUnavailable ? () => {} : () => running.resolveExit?.("released"),
        onClosed: () => running.resolveExit?.("closed"),
      });
      // Redundant, herdr-independent completion signal (see
      // watchExitSidecar): whichever of this or the herdr-event watch above
      // fires first wins.
      running.exitSidecarWatch = watchExitSidecar(sessionPath, () => running.resolveExit?.("released"));

      void watchSubagent(running, abortController.signal).then((result) => {
        const text = resolveResultPresentation(result, result.name);
        safeSendMessage(
          { customType: "subagent_result", content: text, display: true, details: result as any },
          { triggerTurn: true, deliverAs: "steer" },
        );
        updateWidget();
      });

      return {
        content: [
          {
            type: "text",
            text: `Resumed subagent "${requestedName}" in herdr pane ${paneId}.${
              running.herdrTrackingUnavailable
                ? " (herdr's startup detection timed out and its own status tracking for this pane appears unavailable, but the session file shows it is alive and working — monitoring for completion directly; this can happen on longer tasks and the widget's live status may not update until it finishes.)"
                : running.startupRecovered
                  ? " (herdr's startup-readiness check timed out but the process was confirmed alive and running — proceeding normally.)"
                  : ""
            } Its result will arrive as a steer message when it finishes.`,
          },
        ],
        details: { id, name: requestedName, paneId, startupRecovered: running.startupRecovered ?? false, herdrTrackingUnavailable: running.herdrTrackingUnavailable ?? false },
      };
    },
  });

  pi.registerTool({
    name: "subagents_list",
    label: "List subagents",
    description: "List the subagent profiles you're permitted to spawn (name, description, model).",
    parameters: Type.Object({}),
    async execute() {
      const agents = discoverAgentDefinitions().filter((a) => !a.disableModelInvocation);
      if (agents.length === 0) {
        return { content: [{ type: "text", text: "No subagent profiles available." }], details: { agents: [] } };
      }
      const lines = agents.map((a) => `- ${a.name}: ${a.description || "(no description)"} [model: ${a.model ?? "default"}]`);
      return { content: [{ type: "text", text: lines.join("\n") }], details: { agents } };
    },
  });

  // Test/inspection hooks (not part of the public tool surface).
  (pi as any).__subagentsHerdrInternal = {
    runningSubagents,
    discoverAgentDefinitions,
    loadAgentDefaults,
    buildSubagentToolAllowlist,
    getShellReadyDelayMs,
  };
}
