/**
 * herdr socket event client — one dedicated connection per watched pane.
 *
 * Each running subagent gets its own subscription to `pane.agent_status_changed`,
 * `pane.agent_detected`, and `pane.closed` for its own pane id. This is the
 * event-driven replacement for tmux's screen-scraped `__SUBAGENT_DONE__`
 * sentinel: herdr tells us directly when the child's lifecycle status
 * changes and when the agent process is released (exited).
 *
 * If the socket connection cannot be established or drops, callers fall back
 * to polling `herdr agent get` on an interval — never silently stop watching.
 */
import net from "node:net";
import { getAgent, type AgentRecord } from "./herdr.ts";

export type HerdrAgentStatus = "working" | "blocked" | "idle" | "unknown";

export interface PaneWatchHandlers {
  /** Called whenever herdr reports a new lifecycle status for the pane's agent. */
  onStatus?: (status: HerdrAgentStatus) => void;
  /** Called when herdr reports the agent process was released (exited). */
  onReleased?: (finalStatus: HerdrAgentStatus | null) => void;
  /** Called when the pane itself was closed. */
  onClosed?: () => void;
  /** Called on transient socket errors (informational only). */
  onSocketError?: (err: Error) => void;
}

export interface PaneWatchHandle {
  stop(): void;
}

function normalizeEventName(raw: string): string {
  return raw.replace(/\./g, "_");
}

const RECONNECT_DELAYS_MS = [250, 500, 1000, 2000, 4000, 8000];

/**
 * Watch one pane's agent lifecycle over herdr's socket API. Falls back to
 * polling `herdr agent get` every `pollIntervalMs` if the socket cannot be
 * used at all (e.g. `HERDR_SOCKET_PATH` unset).
 */
export function watchPaneLifecycle(
  paneId: string,
  handlers: PaneWatchHandlers,
  options?: { pollIntervalMs?: number },
): PaneWatchHandle {
  const socketPath = process.env.HERDR_SOCKET_PATH;
  let stopped = false;
  let socket: net.Socket | null = null;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let lastKnownStatus: HerdrAgentStatus | null = null;

  function startPolling() {
    if (pollTimer) return;
    const interval = options?.pollIntervalMs ?? 1500;
    pollTimer = setInterval(async () => {
      if (stopped) return;
      const agent = await getAgent(paneId);
      if (!agent) {
        // Agent no longer present in the pane: treat as released.
        stopPolling();
        handlers.onReleased?.(lastKnownStatus);
        return;
      }
      const status = normalizeStatus(agent.agent_status);
      if (status !== lastKnownStatus) {
        lastKnownStatus = status;
        handlers.onStatus?.(status);
      }
    }, interval);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function normalizeStatus(raw: unknown): HerdrAgentStatus {
    return raw === "working" || raw === "blocked" || raw === "idle" ? raw : "unknown";
  }

  function connect() {
    if (stopped || !socketPath) {
      startPolling();
      return;
    }

    let buffer = "";
    socket = net.createConnection(socketPath);

    socket.on("connect", () => {
      reconnectAttempt = 0;
      stopPolling();
      const sub = {
        id: `subagents-herdr:${paneId}:${Date.now()}`,
        method: "events.subscribe",
        params: {
          subscriptions: [
            { type: "pane.agent_status_changed", pane_id: paneId },
            { type: "pane.agent_detected", pane_id: paneId },
            { type: "pane.closed", pane_id: paneId },
          ],
        },
      };
      socket!.write(JSON.stringify(sub) + "\n");
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (!line.trim()) continue;
        handleLine(line);
      }
    });

    socket.on("error", (err) => {
      handlers.onSocketError?.(err);
    });

    socket.on("close", () => {
      if (stopped) return;
      scheduleReconnect();
    });
  }

  function handleLine(line: string) {
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.error) return; // subscription setup error; keep connection, herdr may still push data
    const eventName = normalizeEventName(String(msg.event ?? msg.data?.type ?? ""));
    const data = msg.data ?? {};

    if (eventName === "pane_agent_status_changed") {
      const status = normalizeStatus(data.agent_status);
      lastKnownStatus = status;
      handlers.onStatus?.(status);
      return;
    }
    if (eventName === "pane_agent_detected") {
      if (data.released === true) {
        handlers.onReleased?.(normalizeStatus(data.final_status));
      }
      return;
    }
    if (eventName === "pane_closed") {
      handlers.onClosed?.();
      return;
    }
  }

  function scheduleReconnect() {
    if (stopped) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    reconnectAttempt++;
    // After a few failed attempts, keep the state visible via polling while
    // we keep trying to reconnect the socket in the background.
    if (reconnectAttempt >= 3) startPolling();
    reconnectTimer = setTimeout(connect, delay);
  }

  connect();

  return {
    stop() {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopPolling();
      try {
        socket?.destroy();
      } catch {
        // ignore
      }
    },
  };
}

export type { AgentRecord };
