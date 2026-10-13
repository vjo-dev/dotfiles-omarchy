# Plan Mode Extension

Read-only exploration mode for safe code analysis.

## Features

- **Built-in write tools disabled**: Disables edit/write while preserving other active tools
- **Bash allowlist**: Only read-only bash commands are allowed
- **Plan extraction**: Extracts numbered steps from `Plan:` sections
- **Progress tracking**: Widget shows completion status during execution
- **[DONE:n] markers**: Explicit step completion tracking
- **Session persistence**: State survives session resume
- **Per-mode models**: Automatically switches to a planning model when entering plan mode and to a build model when executing/leaving plan mode

## Model Presets

Configured at the top of `index.ts`:

- `PLAN_MODEL` (default `github-copilot/claude-opus-5`) — used when plan mode is enabled (via `/plan`, `Ctrl+Alt+P`, or a fresh `--plan` start)
- `BUILD_MODEL` (default `github-copilot/claude-sonnet-5`) — used when executing the plan or disabling plan mode
- `PLAN_THINKING` (default `high`) / `BUILD_THINKING` (default `medium`) — thinking level applied on the same transitions (clamped to model capability; non-reasoning models fall back to `off`)

Valid thinking levels: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`.

Models are only switched at mode *transitions*. You can still change the model
at any time with `/model` or `Ctrl+P`; your manual choice stays active until
the next transition. On session resume, pi restores the session's model and
the extension does not override it. Thinking level behaves the same way
(change it manually via `/settings` or the thinking-level keybinding).

## Commands

- `/plan` - Toggle plan mode
- `/todos` - Show current plan progress
- `Ctrl+Alt+P` - Toggle plan mode (shortcut)

## Usage

1. Enable plan mode with `/plan` or `--plan` flag
2. Ask the agent to analyze code and create a plan
3. The agent should output a numbered plan under a `Plan:` header:

```
Plan:
1. First step description
2. Second step description
3. Third step description
```

4. Choose "Execute the plan" when prompted
5. During execution, the agent marks steps complete with `[DONE:n]` tags
6. Progress widget shows completion status

## How It Works

### Plan Mode (Read-Only)
- Built-in edit/write tools disabled
- Other active tools remain available
- Bash commands filtered through allowlist
- Agent creates a plan without making changes

### Execution Mode
- Full tool access restored
- Agent executes steps in order
- `[DONE:n]` markers track completion
- Widget shows progress

### Command Allowlist

Safe commands (allowed):
- File inspection: `cat`, `head`, `tail`, `less`, `more`
- Search: `grep`, `find`, `rg`, `fd`
- Directory: `ls`, `pwd`, `tree`
- Git read: `git status`, `git log`, `git diff`, `git branch`
- Package info: `npm list`, `npm outdated`, `yarn info`
- System info: `uname`, `whoami`, `date`, `uptime`

Blocked commands:
- File modification: `rm`, `mv`, `cp`, `mkdir`, `touch`
- Git write: `git add`, `git commit`, `git push`
- Package install: `npm install`, `yarn add`, `pip install`
- System: `sudo`, `kill`, `reboot`
- Editors: `vim`, `nano`, `code`
