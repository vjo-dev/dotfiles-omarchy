# subagents-herdr

Async pi sub-agents that run in [herdr](https://herdr.dev) panes instead of
tmux. Spawn a sub-agent, keep working in the main session, and get the
result steered back automatically when it finishes.

This is a **personal, local-only extension**. It is a ground-up rebuild of
the ideas in [amosblomqvist/pi-interactive-subagents](https://github.com/amosblomqvist/pi-interactive-subagents)
(MIT-licensed; itself forked from [HazAT/pi-interactive-subagents](https://github.com/HazAT/pi-interactive-subagents)),
rewritten around herdr's socket API/CLI instead of tmux. There is no git
remote pointing at either upstream, it is not published, and it is not
installed via `pi install` — it lives only at
`~/.pi/agent/extensions/subagents-herdr/` on this machine.

## Requirements

- [pi](https://github.com/badlogic/pi-mono) 0.85+
- [herdr](https://herdr.dev) 0.9+, running (`herdr`)
- `herdr integration install pi` — installs herdr's own pi lifecycle hooks
  (`~/.pi/agent/extensions/herdr-agent-state.ts`), which this extension loads
  into every sub-agent so herdr reports authoritative `working`/`idle` state
  for them, not just screen-manifest guesses.

## How it works

`subagent()` returns immediately. The sub-agent runs in its own herdr pane —
a split off the parent pi pane, created with `herdr pane split --no-focus` so
it never steals focus. herdr's `agent start --kind pi` launches pi in that
pane and waits deterministically until herdr detects it's ready (no blind
sleep). A widget above the input tracks every running sub-agent; when one
finishes, its result is steered into the main session as a notification that
triggers a new turn.

Unlike the tmux version, exit detection and live status are **event-driven**:
this extension subscribes to herdr's socket API (`pane.agent_status_changed`,
`pane.agent_detected`, `pane.closed`) for each sub-agent's pane instead of
polling and screen-scraping a sentinel string. If the socket connection is
unavailable, it falls back to polling `herdr agent get`.

```
╭─ Subagents ──────────────────────────── 2 running ─╮
│ ⟳ 00:23  scout      (scout)              working 1m │
│ ‼ 00:45  scout-2     (scout)   blocked (needs input) │
╰──────────────────────────────────────────────────────╯
```

## Tools

| Tool | Description |
|---|---|
| `subagent` | Spawn a sub-agent in a dedicated herdr pane (async) |
| `subagent_message` | Message a sub-agent by name — steers it if running, resumes its session if finished |
| `subagents_list` | List available agent definitions |
| `ask_question` | *(sub-agent sessions only)* Ask the orchestrator a question and wait for the reply |

## Bundled agents

`agents/{scout,researcher,worker}.md`. Same three roles as upstream, retuned
for this machine:

- **scout** — read-only recon (`read`, `grep`, `find`, `ls`), `claude-haiku-4.5`.
- **researcher** — web research (`web_search`, `fetch_content`, `safe_bash`),
  `gpt-5.5`. Note: uses `fetch_content` (from the `pi-web-access` package
  installed here), not `web_fetch` — adjust `BUILTIN_TOOL_EXTENSION_MAP` in
  `index.ts` if your toolset differs.
- **worker** — general implementer (`read`, `write`, `edit`, `bash`,
  `web_search`, `fetch_content`), may spawn `scout`/`researcher`,
  `claude-sonnet-5`.

Custom agents: drop a `.md` file in `.pi/agents/` (project) or
`~/.pi/agent/agents/` (global). Discovery priority: project > global >
bundled. Frontmatter fields match upstream (`name`, `description`, `model`,
`tools`, `thinking`, `subagent_agents`, `session-mode`, `system-prompt`,
`auto-exit`, `interactive`, `cwd`, `disable-model-invocation`).

## Architecture

```
index.ts            orchestrator: tools, launch/resume, sandbox argv, agent registry
herdr.ts             herdr CLI wrapper (split/start/prompt/read/close), name sanitization
herdr-events.ts       herdr socket event client (per-pane lifecycle watch + poll fallback)
session.ts            session file / registry / loadout helpers (no external deps)
status.ts             status classification + transitions (no external deps)
widget.ts             status widget rendering (no external deps besides text-width.ts)
text-width.ts         ANSI-aware width/truncate helpers (zero deps)
subagent-done.ts      loaded INTO child sessions: ask_question tool + tools widget
tools/safe-bash.ts    loaded INTO child sessions when an agent's tools list it
agents/*.md           bundled agent profiles (scout/researcher/worker)
test/test.ts          unit tests (node --test), covers herdr.ts/status.ts/widget.ts
```

`widget.ts`, `status.ts`, `session.ts`, and `text-width.ts` are deliberately
dependency-free (only node builtins + each other) so they're testable with
plain `node --experimental-strip-types --test`. `index.ts` and
`subagent-done.ts` need pi's own jiti runtime (they import `typebox` /
`@earendil-works/pi-coding-agent` / `@earendil-works/pi-tui`) and can only be
exercised by actually running them inside pi.

## Differences from the upstream tmux version

- **herdr, not tmux.** All multiplexer calls live in `herdr.ts` +
  `herdr-events.ts`. No `tmux`/`$TMUX_PANE` dependency anywhere.
- **Event-driven exit/status detection**, not sentinel screen-scraping.
  `blocked` (herdr's approval/question state) is a first-class status the
  tmux version could never see.
- **No shell-ready sleep.** `agent start` deterministically waits for
  readiness; `PI_SUBAGENT_SHELL_READY_DELAY_MS` no longer exists.
- **No shell quoting.** Sub-agent argv is passed straight through
  `agent start -- <args>`; there's no `shellEscape`/`sendLongCommand`/launch
  script file.
- **No Claude Code CLI support in this build.** Upstream's `cli: claude`
  path (Stop-hook plugin, session copying) was intentionally dropped to keep
  this rebuild pi-only. herdr can run Claude Code natively
  (`agent start --kind claude`) if this is ever revisited.
- **`--approve` is always passed** to sub-agent launches so pi's interactive
  project-trust prompt can't silently block `agent start`'s readiness check
  in a fresh role-folder `cwd`. If you use per-agent `cwd:` folders, consider
  running `/trust` in them once from an interactive pi session too.
- **Env vars are renamed** `PI_SUBAGENT_*` → `PI_HERD_*` to avoid any
  confusion with an upstream install (there isn't one, but just in case).
- **No tmux pane-layout rebalancing** (`select-layout even-horizontal`).
  herdr's `pane split --ratio` could replace this later if panes drift.
- **Widget rendering is a separate, dependency-free module (`widget.ts`)**
  with its own unit tests — not incidental; see Known limitations below for
  why.

## Status widget & configuration

`config.json` (copy `config.json.example`; it's gitignored... well, there's
no git repo here, so just don't commit it if you ever add one):

```json
{ "status": { "enabled": true, "lineLimit": 4 } }
```

## Known limitations / things to revisit

- **A second live evaluation
  (`subagents-herdr-startup-timeout-issue.md`, 2026-09-17) found the previous
  "never trust a startup timeout" fix was still insufficient for real,
  long-running tasks — fixed with a herdr-independent completion signal.**
  The earlier fix (`confirmAgentAlive` + "did a completed assistant message
  already appear") assumed a failed spawn is either alive-and-detectable via
  herdr, or already fully finished. Real production tasks broke both
  assumptions at once:
  1. **herdr's own `agent get <pane>` can go completely silent for a pane
     that is demonstrably alive and working** — reproduced live: a scout
     doing a genuine multi-file repo recon (not a toy "say X" task) showed
     `agent_status: "working"` with a growing session file at t+18s, then
     `agent_not_found` from t+28s onward, even though (in another run) the
     session file kept growing well past that point. herdr's pane/agent
     tracking for a given pane can apparently lapse independently of — and
     well before — anything this extension does. `confirmAgentAlive`
     alone is therefore not a reliable safety net on its own.
  2. **A long or multi-turn autonomous task can stay `working` for its
     entire duration and never revisit `idle`.** Toy one-turn tasks
     ("say X and stop") happen to touch `idle` right at the end, which is
     why they were rescued correctly before; a real recon/edit task that
     chains many tool calls has no reason to pause at `idle` until the
     whole thing concludes, possibly minutes later. Neither a 30s
     `agent start` timeout nor a 9s `confirmAgentAlive` poll window can
     ever observe that on a task that legitimately takes longer than both
     combined — this is not a value you can tune your way out of.
  
  Fixed with an **authoritative, herdr-independent completion signal**:
  `subagent-done.ts` now writes the `.exit` sidecar file on *every* clean
  exit (not just errors), from inside the child process itself, entirely
  decoupled from herdr's own pane/agent tracking. `watchExitSidecar()` polls
  for that file directly and races it against the existing herdr-event
  watcher — whichever fires first wins. `startAgentResilient` was rewritten
  around this: on a `startAgent` failure it now checks, in order, (a) is the
  agent still confirmable via herdr (fast path, unchanged), (b) has the
  `.exit` sidecar already appeared (task finished within this window —
  deliver the real result immediately, as before), (c) has the session file
  grown past this attempt's starting point at all (`countSessionEntryLines`,
  with a resume-safe `afterLine` cursor) — if so, the process is presumed
  alive for however long it takes, the pane is **never** closed, and the
  child is registered as running with completion left entirely to the
  sidecar/event race. Only when there is **no** file-system evidence pi ever
  got underway at all (case (d)) is the pane closed and a genuine failure
  reported — the only scenario left where nothing is actually running in
  the pane to strand or duplicate.
  
  One more subtlety this surfaced: `watchPaneLifecycle`'s own poll fallback
  (used when its herdr socket subscription drops) *also* calls
  `getAgent(pane)` — the exact call already proven unreliable for a pane in
  this state. A false "released" from that fallback would have re-triggered
  the original bug (premature close on a still-working process). Fixed by
  suppressing `onReleased` (but keeping `onStatus` for cosmetics and
  `onClosed`, which only ever comes from a genuine push event, never from
  polling) whenever a subagent is flagged `herdrTrackingUnavailable`, so
  completion for that pane is decided solely by the sidecar-file race.
  
  **Verified live**, twice: (1) directly observed herdr's `agent get`
  returning `agent_not_found` for a pane with a genuinely growing,
  multi-turn session file, confirming the failure mode is real and not
  specific to this extension's own timing; (2) a full end-to-end run with a
  real ~45-60s continuously-`working` recon task (a persistent, interactive
  orchestrator — see the note below on `-p` mode) completed with **no**
  false failure, **no** premature pane kill, and the complete, substantive
  result delivered correctly via steer message.
  
  **Test-methodology note, worth recording:** an earlier attempt to
  reproduce this used `pi -p "..."` (one-shot print mode) as the
  orchestrator. That is fundamentally the wrong mode for this tool: `-p`
  exits the whole process after a single turn, which correctly triggers
  `session_shutdown` and aborts any still-running subagents (there is no
  persistent session left to deliver a steer message to). This looked
  identical to a premature-kill bug from the outside (pane vanished, session
  file stopped growing) but was actually `session_shutdown` doing exactly
  what it should. Always test/use this tool from a persistent interactive
  session, not `-p`.

- **A live evaluation (`subagents-herdr-evaluation-report.md`, 2026-09-17)
  surfaced three further bugs, all fixed and re-verified live:**
  1. **Tool allowlist gap: `ask_question` and the spawning trio were loaded
     but invisible/uncallable.** `--tools <list>` allowlists *every* tool,
     including ones registered by an explicitly-loaded (`-e`) extension —
     not just built-ins. `subagent-done.ts` is always loaded and registers
     `ask_question`, and `index.ts` is always loaded and registers the
     spawning trio, but neither name was ever added to the `--tools` string
     built from an agent's frontmatter. A child could never actually call
     `ask_question` (the blocked-question flow was unreachable from any
     stock profile) or, if granted `subagent_agents`, its own `subagent`
     tool. Fixed in `buildSubagentToolAllowlist`: every restricted spawn now
     gets `ask_question` merged into its `--tools` list, plus the spawning
     trio when `subagent_agents` is set. Verified live: a restricted
     `worker` now reports `ask_question`, `subagent`, `subagent_message`,
     `subagents_list` among its available tools.
  2. **`herdr agent start`'s readiness detection can time out even on full,
     clean success** — observed live and reproduced repeatedly: a fresh
     spawn (and, identically, a resume) can run its entire task, respond,
     and auto-exit *before* herdr's own detection ever confirms the process
     is "ready for interactive input," especially for short tasks where the
     brief startup-idle window is easy to miss under load. The old code
     treated any `agent start` failure as fatal: it killed the pane and
     reported an error, which either **silently dropped a successful
     result** (nothing left to steer back) or, worse, **invited the caller
     to retry** — spawning a second process against the same (possibly
     non-idempotent) task while investigating whether the first was still
     running. Fixed with `startAgentResilient()`: on any `startAgent`
     failure, before closing the pane, (a) poll `confirmAgentAlive()` — if
     the process is genuinely still alive, proceed as a normal (if slightly
     late) success; (b) if not alive, check the session file for actual
     assistant output — if the agent already ran to completion and exited
     cleanly, synthesize and deliver its real result immediately instead of
     reporting failure; only if neither check finds evidence of a live or
     completed run is the pane closed and a genuine failure reported. The
     resume path passes an `afterLine` cursor so this check only considers
     entries appended *after* the resume attempt — a resumed session file
     already has prior turns, and without the cursor a resume that never
     even started could be misdiagnosed as "already finished" using stale
     content from before it ran. Verified live end-to-end, including the
     exact spawn-then-resume-with-a-followup-message sequence from the
     evaluation report: both the initial spawn and the resume hit this path
     (herdr's detection did time out on both), and both delivered their
     real, distinct results (`FIRST_TURN_OK`, `SECOND_TURN_OK`) in a single
     tool call each — no false failures, no duplicate runs, no lost steers.
  3. **`pane split --cwd <path>` silently falls back to a default directory
     (observed: the caller's home dir) when `<path>` doesn't exist**, rather
     than erroring — easy to hit for a worker scaffolding a brand-new
     project directory (a common task shape). The subagent would then
     silently run somewhere other than its stated cwd. Fixed by
     `mkdirSync(cwd, { recursive: true })` before every `pane split` call
     (launch and resume), so the subagent's actual working directory always
     matches what its task description says.

  None of these are herdr-specific in spirit: (1) is a "the allowlist gate
  applies to more than you think" lesson, (2) is a "never treat a timeout as
  proof of failure when the side effect (a running or completed process)
  can be checked directly" lesson, and (3) is a "validate preconditions,
  don't trust silent fallbacks" lesson.

- **Two crashes were found and fixed while first testing this extension live**
  (both in the orchestrator's "Subagents" status widget — worth understanding
  if you touch `widget.ts` or `index.ts`'s session lifecycle handling):
  1. *Overflowing widget line crashed the whole pi TUI process.* The original
     `borderLine`/`borderTop` computed padding but never truncated `left`/
     `right` content that didn't fit; adding a live token/cost stats tag to
     the row pushed a line to 65 visible columns in a 49-column herdr pane,
     and pi's renderer throws ("Rendered line N exceeds terminal width") on
     any custom widget line wider than the terminal — which kills the whole
     process, not just the widget. Fixed by moving all width arithmetic into
     `widget.ts`, using ANSI-aware `truncateToWidth`/`visibleWidth`
     (`text-width.ts`) instead of naive `.slice()`/`.length`, and adding a
     non-negotiable `hardClampLine()` safety net applied to every returned
     line. `test/test.ts` reproduces the exact 49-column/long-stats scenario
     plus a width sweep (1–200 cols) as a permanent regression test.
  2. *Stale `ExtensionContext` access after session teardown crashed the
     process a second way.* In print mode (`-p`), pi tears down the session
     (`session_shutdown`) as soon as the single turn ends, but a spawned
     subagent's background watcher (waiting on herdr's exit event) can still
     be pending; its eventual `.then()` continuation called
     `latestPi.sendMessage(...)` / `updateWidget()` read `latestCtx.hasUI` on
     an already-torn-down context, and pi deliberately throws on stale-ctx
     property access rather than silently no-op-ing. Fixed with a
     module-level `shuttingDown` flag set in `session_shutdown` (checked by
     `safeSendMessage()` and at the top of `updateWidget()`), `latestCtx`
     nulled out on shutdown, and both call sites wrapped in `try/catch` as
     defense-in-depth since a stale ctx can throw from property getters, not
     just missing-null checks.
  
  Neither failure mode is specific to herdr — both are general "don't crash
  the host process" lessons for any pi extension that (a) hand-renders raw
  widget lines instead of using `Box`/`Text`, or (b) holds onto `pi`/`ctx`
  across an `await` that can outlive the session.
- `blocked` detection for a plain `pi` child depends on some extension
  emitting `pi.events.emit("herdr:blocked", ...)` (herdr's own integration
  listens for this custom event). Nothing on this machine emits it yet for
  bare pi tool-permission prompts — `ask_question` (file-based, like
  upstream) is still the primary "sub-agent needs you" signal.
- `subagent_message` steering is fire-and-forget (`herdr agent prompt`
  without `--wait`), matching upstream's non-blocking contract. If the
  target is `blocked`, herdr returns `agent_blocked` and steering fails —
  inspect with `herdr agent read <name>` and reply with
  `herdr agent send-keys <name> ...` by hand if that happens.
- A starter automated test suite lives at `test/test.ts` — covers
  `sanitizeHerdrName`, `status.ts`'s classification/transition logic, and
  `widget.ts`'s width invariants (`node --experimental-strip-types --test
  test/test.ts`, 23 tests passing). `applySandboxToParts`/the launch path are
  still validated by manual herdr pane smoke tests, not automated.

## License

MIT, matching the upstream project this was rebuilt from.
