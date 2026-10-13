/**
 * herdr surface layer — the only place this extension shells out to `herdr`.
 *
 * Everything the extension does to a pane goes through the small API in this
 * file: split a pane, start/prompt/read/close an agent, sanitize names.
 * Keeping herdr calls isolated here means index.ts stays testable without a
 * running herdr server.
 *
 * Panes are identified by herdr pane ids (e.g. `w1:p2`). Splits always target
 * the parent pi's pane (`$HERDR_PANE_ID`) so they follow the agent rather
 * than the user's focus, matching herdr's own "no-focus" default.
 */
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const HERDR_BIN = process.env.HERDR_BIN_PATH?.trim() || "herdr";

// ── Availability ──

let herdrBinAvailable: boolean | null = null;

function hasHerdrBinary(): boolean {
  if (herdrBinAvailable !== null) return herdrBinAvailable;
  try {
    execFileSync("sh", ["-c", `command -v ${HERDR_BIN}`], { stdio: "ignore" });
    herdrBinAvailable = true;
  } catch {
    herdrBinAvailable = false;
  }
  return herdrBinAvailable;
}

/**
 * True when this process is running inside a herdr-managed pane with the
 * herdr binary reachable. `HERDR_ENV`/`HERDR_PANE_ID`/`HERDR_SOCKET_PATH` are
 * injected by herdr into every process it launches in a managed pane.
 */
export function isHerdrAvailable(): boolean {
  return process.env.HERDR_ENV === "1" && !!process.env.HERDR_PANE_ID && hasHerdrBinary();
}

export function herdrSetupHint(): string {
  return "Run pi inside herdr (`herdr`), then retry. See https://herdr.dev/docs/install/.";
}

function requireHerdr(): void {
  if (!isHerdrAvailable()) {
    throw new Error(`herdr is required for subagents. ${herdrSetupHint()}`);
  }
}

// ── Name sanitization ──

/**
 * herdr agent/pane names must match `[a-z][a-z0-9_-]{0,31}`. Lowercase,
 * strip disallowed characters, guarantee a leading letter, and cap length.
 */
export function sanitizeHerdrName(raw: string): string {
  let s = (raw || "subagent").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  s = s.replace(/^[^a-z]+/, "");
  if (!s) s = "subagent";
  s = s.slice(0, 32);
  if (!/^[a-z]/.test(s)) s = `a${s}`.slice(0, 32);
  return s;
}

// ── JSON exec helper ──

export interface HerdrError {
  code?: string;
  message: string;
}

export type HerdrResult<T> = { ok: true; result: T } | { ok: false; error: HerdrError };

function parseJsonLoose(text: string): any | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // herdr sometimes prints a leading line before the JSON payload; try the
    // last line, which is where the JSON response lives.
    const lastLine = trimmed.split("\n").pop() ?? "";
    try {
      return JSON.parse(lastLine);
    } catch {
      return null;
    }
  }
}

async function runHerdr<T = any>(args: string[]): Promise<HerdrResult<T>> {
  requireHerdr();
  try {
    const { stdout } = await execFileAsync(HERDR_BIN, args, {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    const parsed = parseJsonLoose(stdout);
    if (parsed?.error) return { ok: false, error: parsed.error };
    return { ok: true, result: parsed?.result ?? parsed };
  } catch (err: any) {
    const stderr: string = err?.stderr ?? "";
    const stdout: string = err?.stdout ?? "";
    const parsed = parseJsonLoose(stderr) ?? parseJsonLoose(stdout);
    if (parsed?.error) return { ok: false, error: parsed.error };
    return {
      ok: false,
      error: { message: parsed ? JSON.stringify(parsed) : err?.message ?? String(err) },
    };
  }
}

// ── Pane primitives ──

export interface PaneRef {
  paneId: string;
}

/**
 * Split a new pane off the parent pi's pane (or an explicit source pane).
 * Returns the new pane id (e.g. `w1:p7`).
 */
export async function splitPane(options: {
  from?: string;
  direction?: "left" | "right" | "up" | "down";
  cwd?: string;
  env?: Record<string, string>;
}): Promise<HerdrResult<PaneRef>> {
  const from = options.from ?? process.env.HERDR_PANE_ID;
  const args = ["pane", "split"];
  if (from) args.push(from);
  else args.push("--current");
  const direction = options.direction ?? "right";
  // herdr only supports right/down splits.
  args.push("--direction", direction === "left" || direction === "right" ? "right" : "down");
  args.push("--no-focus");
  if (options.cwd) args.push("--cwd", options.cwd);
  for (const [k, v] of Object.entries(options.env ?? {})) {
    args.push("--env", `${k}=${v}`);
  }
  const res = await runHerdr<{ pane: { pane_id: string } }>(args);
  if (!res.ok) return { ok: false, error: res.error };
  const paneId = res.result?.pane?.pane_id;
  if (!paneId) return { ok: false, error: { message: "pane split returned no pane_id" } };
  return { ok: true, result: { paneId } };
}

export interface AgentRecord {
  name?: string;
  pane_id: string;
  agent?: string;
  agent_status?: "working" | "blocked" | "idle" | "unknown" | string;
  interactive_ready?: boolean;
  [key: string]: unknown;
}

/**
 * Start a supported agent (here always `pi`) in an existing available shell
 * pane. Waits (up to `timeoutMs`) until herdr detects the process and marks
 * it ready for interactive input.
 */
export async function startAgent(options: {
  name: string;
  pane: string;
  argv: string[]; // args after `--`, passed to the executable unmodified
  timeoutMs?: number;
}): Promise<HerdrResult<AgentRecord>> {
  const args = [
    "agent",
    "start",
    options.name,
    "--kind",
    "pi",
    "--pane",
    options.pane,
    "--timeout",
    String(options.timeoutMs ?? 30000),
    "--",
    ...options.argv,
  ];
  const res = await runHerdr<{ agent: AgentRecord }>(args);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, result: res.result.agent };
}

/** Resolve an agent by live name or pane id. Returns null if not found. */
export async function getAgent(target: string): Promise<AgentRecord | null> {
  const res = await runHerdr<{ agent: AgentRecord }>(["agent", "get", target]);
  if (!res.ok) return null;
  return res.result.agent;
}

/**
 * `agent start`'s own wait-for-readiness can time out even though the
 * process it launched is genuinely alive and already working — observed
 * live: a freshly spawned child completed several turns of real work well
 * inside a 30s `--timeout` window while the CLI call still reported
 * "timed out waiting for agent startup". Treating that as a hard failure is
 * dangerous: it invites the caller to retry (duplicating non-idempotent
 * work against a second process) while the first keeps running unobserved
 * (its eventual completion is never delivered to anyone).
 *
 * Call this after a `startAgent`/resume failure, before killing the pane:
 * if herdr still reports a live `pi` agent there, the launch actually
 * succeeded and only the readiness *signal* was missed.
 */
export async function confirmAgentAlive(
  pane: string,
  options?: { attempts?: number; intervalMs?: number },
): Promise<AgentRecord | null> {
  const attempts = Math.max(1, options?.attempts ?? 6);
  const intervalMs = options?.intervalMs ?? 1500;
  for (let i = 0; i < attempts; i++) {
    const agent = await getAgent(pane);
    if (agent && agent.agent === "pi") return agent;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

/**
 * Submit a prompt to a running agent. Fire-and-forget by default (no
 * `--wait`) — matches the upstream "steer, don't block" contract.
 */
export async function promptAgent(
  target: string,
  text: string,
  options?: { wait?: boolean; until?: string[]; timeoutMs?: number },
): Promise<HerdrResult<AgentRecord>> {
  const args = ["agent", "prompt", target, text];
  if (options?.wait) {
    args.push("--wait");
    for (const u of options.until ?? []) args.push("--until", u);
    if (options.timeoutMs) args.push("--timeout", String(options.timeoutMs));
  }
  const res = await runHerdr<{ agent: AgentRecord }>(args);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, result: res.result.agent };
}

export async function sendKeys(target: string, keys: string[]): Promise<HerdrResult<void>> {
  const res = await runHerdr(["agent", "send-keys", target, ...keys]);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, result: undefined };
}

export async function readPane(
  pane: string,
  options?: { lines?: number; source?: "visible" | "recent" | "recent-unwrapped" | "detection" },
): Promise<string> {
  requireHerdr();
  const args = [
    "pane",
    "read",
    pane,
    "--source",
    options?.source ?? "recent-unwrapped",
    "--lines",
    String(options?.lines ?? 80),
  ];
  try {
    const { stdout } = await execFileAsync(HERDR_BIN, args, {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return "";
  }
}

export async function closePane(pane: string): Promise<void> {
  try {
    await runHerdr(["pane", "close", pane]);
  } catch {
    // best-effort
  }
}

export async function notify(title: string, body?: string): Promise<void> {
  try {
    const args = ["notification", "show", title];
    if (body) args.push("--body", body);
    await runHerdr(args);
  } catch {
    // best-effort; never break the extension over a missing toast
  }
}

/** Live agent names currently known to the herdr server (for uniqueness checks). */
export async function listAgentNames(): Promise<Set<string>> {
  const res = await runHerdr<{ agents: AgentRecord[] }>(["agent", "list"]);
  if (!res.ok) return new Set();
  return new Set((res.result.agents ?? []).map((a) => a.name).filter(Boolean) as string[]);
}
