# Neovim config spec — v2 (agentic rebuild)

The buildable spec for **v2**: a from-scratch Neovim setup oriented to an agent-driven,
review-first workflow, implemented step by step by an agent (one step per prompt), while
v1 keeps running. Describes *what* and *why* — the agent figures out the Lua.

Baseline and audit of the old setup: [SPEC.md](./SPEC.md). Vocabulary: [GLOSSARY.md](../GLOSSARY.md).

**Settled decisions** (from the challenge & cut session):
side-by-side build via `NVIM_APPNAME` · `vim.pack` + 0.12 built-ins · review-first ·
all three Omarchy integrations kept (theme bridge rewritten off lazy.nvim) ·
snacks picker · blink.cmp · lualine + bufferline kept · full git review toolkit ·
no inline AI · live keybindings book on SUPER+SHIFT+K · vtsls.

**Cut from v1** (never port): lazy.nvim, telescope (+fzf-native, ui-select, plenary),
nvim-cmp + LuaSnip + cmp sources, neodev, prettier.nvim, vim-devicons, nvim-web-devicons,
headlines, nvim-autopairs, ts-tools.lua, the Vue wiring, the LazyVim stub, the arrow-key
nag, the swapped `<C-w>s`/`<C-w>v`.

## Implementation workflow

1. Implement **only the step named in the prompt**, nothing beyond it.
2. Light self-check only: `NVIM_APPNAME=nvim-v2 nvim --headless +qa` starts clean;
   new keymaps exist (`:verbose map <key>`). No test projects, no driving the UI.
3. The human reloads with `ZR` (`:restart`), checks behavior, reviews the diff, commits.
4. Every keymap sets `desc=` — the keybindings book (step 9) reads them live.

---

## 0. Prerequisites

### 0.1 Runtime

- Neovim **0.12+** (installed: 0.12.6). The config relies on `vim.pack`,
  `vim.lsp.enable` + `after/lsp/`, `:restart`, and the ui2 message UI.
- **Live since the cutover** at `~/dotfiles/nvim/.config/nvim` (stowed to
  `~/.config/nvim`). v1 remains a runnable backup at `nvim/.config/nvim-v1`:
  `NVIM_APPNAME=nvim-v1 nvim`.

### 0.2 CLI tools

| Tool | Why | Status |
|---|---|---|
| `git` | vim.pack clones plugins | ✓ |
| `tree-sitter` CLI + C compiler | nvim-treesitter main builds parsers | ✓ |
| `curl`, `tar` | parser & blink.cmp binary downloads | ✓ |
| Node.js + npm | Mason installs servers | ✓ |
| `ripgrep`, `fd` | picker search | ✓ |
| `lazygit` | git UI | ✓ |
| **`git-delta`** | lazygit diff rendering | **✗ — installed by `scripts/install-lazygit.sh` on next deploy; pager line in lazygit config stays commented until then** |
| **`pwsh`** | hosts PowerShell Editor Services | **✗ install (AUR: `powershell-bin`) — ps1 editing works, LSP needs it** |
| `wl-copy`/`wl-paste` | remote clipboard provider | ✓ |
| `prettier`, `black`, `stylua` | conform formatters | ✓ (stylua via Mason) |

### 0.3 Font & environment

- Nerd Font already active (Omarchy terminal).
- Omarchy provides `~/.local/state/omarchy/current/theme/neovim.lua` (theme bridge input).

---

## 1. Foundation

### 1.1 Layout

```
nvim-v2/
├── init.lua              # vim.loader.enable(); requires in order:
│                         #   config.options → config.keymaps → config.autocmds
│                         #   → config.clipboard → plugins
├── lua/config/
│   ├── options.lua       # leader first, then options; ui2 at the end
│   ├── keymaps.lua       # plugin-free keymaps only
│   ├── autocmds.lua
│   └── clipboard.lua     # remote clipboard provider (ported from v1 verbatim)
├── lua/plugins/
│   ├── init.lua          # ONE vim.pack.add() for everything, then requires group files
│   ├── theme.lua         # Omarchy theme bridge v2 (§2)
│   ├── ui.lua, nav.lua, syntax.lua, lsp.lua, git.lua, lang.lua
│   └── keymaps.lua       # every plugin-dependent keymap, required last
├── after/plugin/
│   └── transparency.lua  # §2.2, auto-sourced after plugins
├── after/lsp/<name>.lua  # per-server settings (0.12 merges automatically)
└── stylua.toml           # tabs, stylua defaults
```

The nvim stow package also owns `~/.local/bin/omarchy-menu-nvim-keybindings` (§9).

- Group files configure plugins (`require(x).setup{}`); they hold **no keymaps**.
- `.gitignore`: `nvim-pack-lock.json`.

### 1.2 Leader and basics

- Leader + localleader: **Space**.
- Mouse **on** (kept v1 habit: split resizing).
- Clipboard `unnamedplus`; transport via the remote clipboard provider (§2.3).
- Indent 2 spaces (`tabstop`/`shiftwidth`/`softtabstop` 2, `expandtab`, `smartindent`),
  `breakindent`.

### 1.3 Look of the buffer

- **Hybrid** line numbers: `number` + `relativenumber` (counts for review jumps like `d5j`).
- `cursorline`, `scrolloff` 10, `signcolumn` always on, `showtabline` 2 (bufferline),
  `laststatus` 3, `termguicolors`, `title` on.
- **Rounded** borders on every float (`winborder`).
- Whitespace visible: `list` + listchars `» `, `·`, `␣` (kept from v1).
- `inccommand = "split"`.

### 1.4 Search, files, undo, timing

- `ignorecase` + `smartcase`; `<Esc>` clears highlight.
- `swapfile` and `writebackup` **off**; persistent undo **on**.
- Trimmed shada kept from v1: `'10 <0 s10 h` (privacy; no oldfiles picker expected).
- `updatetime` 250, `timeoutlen` 300.

### 1.5 Splits and folds

- New splits below / right. **No** `<C-w>` swapping (cut).
- Folds from **Treesitter** (`foldexpr`), `foldlevel` 99 — everything open, closable by syntax.

### 1.6 Messages (ui2)

- 0.12 **ui2** on (end of options.lua): corner popup for short messages, pager for long
  output; command-line output stays in the cmdline.
- `cmdheight` 0; [tiny-cmdline.nvim](https://github.com/rachartier/tiny-cmdline.nvim)
  floats the `:` line near the top. *Why:* with cmdheight 0 the cmdline needs a home,
  and the eyes are already up there.

### 1.7 Autocmds

- Yank flash.
- Restore last cursor position on reopen (kept from v1).
- Strip trailing whitespace on save **except `markdown`** (two-space hard breaks survive).

### 1.8 Core keymaps (plugin-free; all with `desc=`)

| Mode | Keys | Action |
|---|---|---|
| n | `<Esc>` | Clear search highlight |
| i n x s | `<C-s>` | Save file |
| n | `<C-a>` | Select all |
| n | `+` / `-` | Increment / decrement number |
| n | `<leader>o` / `<leader>O` | Empty line below / above, stay in normal |
| n i v | `<A-j>` / `<A-k>` | Move line / selection down / up |
| v | `<` / `>` | Re-indent, keep selection |
| n | `<A-n>` / `<A-p>` | Diagnostic next/prev — cycles, opens the float (bracket keys are AltGr-hostile on dk/eu layouts; `]d`/`[d` dropped, Nvim's builtins remain) |
| n | `<leader>e` | Diagnostic float |
| n | `<leader>q` | Diagnostic loclist |
| n | `ZR` | `:restart` — the agent-iteration reload loop |
| c | `W`→`w`, `k`→`WhichKey` | Kept abbreviations |

*Workflow note:* run agents in a separate herdr/terminal pane, never in `:terminal` —
`ZR` kills it. `:wa` before `ZR`; unsaved buffers block the restart.

---

## 2. Omarchy integration

### 2.1 Theme bridge v2 (no lazy.nvim)

*Goal unchanged: Neovim follows the active Omarchy theme, live.*

- All **15 colorscheme plugins the installed Omarchy 4 references** (grep of
  `/usr/share/omarchy/themes/*/neovim.lua` + the themed template) are installed through
  the single `vim.pack.add()` call (aether pinned as `name = "aether"`, branch `v3`).
  v1's Omarchy-3.8-only schemes (monokai-pro, ethereal, vantablack, white, miasma) are
  **cut**: unreferenced by Omarchy 4, and monokai-pro's repo no longer exists.
- A loader module reads `~/.local/state/omarchy/current/theme/neovim.lua` **as data**
  (load the chunk, take the returned specs): the colorscheme plugin spec (with `opts`)
  and the `LazyVim/LazyVim` spec that carries `opts.colorscheme`. No LazyVim stub —
  nothing tries to install it anymore.
  - Apply: call the scheme plugin's `setup(opts)` when it has opts, then `:colorscheme <name>`.
- **Hot reload**: `vim.uv` fs_event watch on the theme state directory. On change:
  clear highlights, reset `background`, drop the scheme's Lua modules from
  `package.loaded`, re-apply as above, re-source transparency, fire `ColorScheme`.
- Degrade gracefully: unknown scheme → `:colorscheme default` + one notify, never an error.

### 2.2 Transparency

- Port v1's `transparency.lua`: strip backgrounds from the same group list
  (core UI, floats, notify, bufferline except `*Selected`; replace Telescope groups with
  their snacks equivalents). Re-apply on `ColorScheme` + `UIEnter` (the `VeryLazy` hook
  dies with lazy.nvim).

### 2.3 Remote clipboard provider

- Port v1's `remote_clipboard.lua` **verbatim** as `config/clipboard.lua`:
  OSC52 + `wl-copy` dual copy, `wl-paste`-preferred paste, active only under
  tmux / SSH / herdr. It also serves the agent helpers (§8) — a yanked path reaches
  whatever pane the agent runs in.

---

## 3. Look & feel

- **lualine**: global statusline, **theme `auto`** (follows the theme bridge — fixes v1's
  hardcoded nightfly). Sections as v1: mode / branch / filename+status /
  diagnostics·encoding·filetype / progress / location.
- **bufferline**: kept as v1 (buffers as tabs). Keymaps: `<Tab>` next, `<S-Tab>` prev,
  `<leader><Tab>` delete buffer.
- **mini.icons** as the **single** icon source, mocking nvim-web-devicons for
  lualine/bufferline. (v1's three icon plugins → one.)
- **snacks.nvim**: notifier (`vim.notify`), indent guides, `bigfile`. Smooth scroll off.
  Words module off — **mini.cursorword** kept instead (works without LSP).
- **fidget** kept for LSP progress (small, familiar).
- **todo-comments** (highlights + picker source), **nvim-highlight-colors** (hex/rgb/hsl
  backgrounds) — both kept with defaults.
- **render-markdown** kept (ft markdown only; the dead `Avante` ft goes away).
  headlines cut.

---

## 4. Navigating

### 4.1 Picker: snacks.nvim (keymaps preserved from v1)

| Keys | Action |
|---|---|
| `<leader>ff` | Files (hidden included — dotfiles are real projects) |
| `<leader>fg` | Live grep (hidden included) |
| `<leader>fw` | Grep word under cursor |
| `<leader>fb` | Buffers |
| `<leader>fd` | Diagnostics |
| `<leader>fh` | Help |
| `<leader>fk` | Keymaps |
| `<leader>fn` | Files in the nvim-v2 config |
| `<leader>ft` | TODO comments |
| `<leader>f.` | Resume last picker |

- snacks picker also backs `vim.ui.select` (replaces telescope-ui-select).

### 4.2 File explorer: oil (+ oil-git)

- `<leader>-` toggles the float (40% × 60%, rounded), hidden files shown.
- `<M-h>` opens entry in split (`<C-h>` stays tmux-navigator's).
- Renames ask the LSP to update imports (vtsls `willRename`/`didRename`) and save those edits.

### 4.3 Windows / panes

- **vim-tmux-navigator**: `<C-h/j/k/l>` across splits and tmux panes, `<C-\>` previous.

### 4.4 which-key

- Groups: `[F]ind`, `[G]it`, `[D]iff`, `[C]ode`, `[T]oggle`, `[Y]ank for agent` —
  **only groups that contain real mappings** (fixes v1's ghost groups).

---

## 5. Syntax

### 5.1 Treesitter, main branch, configured for the main branch

- Parsers ensured via `require("nvim-treesitter").install()`:
  bash, css, diff, gitcommit, gitignore, html, javascript, jsdoc, json, lua,
  luadoc, luap, markdown, markdown_inline, powershell, printf, python, query, regex,
  scss, sql, toml, tsx, typescript, vim, vimdoc, xml, yaml.
  (jsonc has no parser of its own on main — json covers it.)
- A `FileType` autocmd runs `vim.treesitter.start()` + treesitter `indentexpr` whenever
  a parser exists (this is what v1 was missing — verified regex fallback, SPEC.md §5.1).
- `:TSUpdate` on the `PackChanged` event keeps parsers in sync with the plugin.

### 5.2 Editing helpers

- **mini.pairs** (insert + cmdline) replaces nvim-autopairs — no cmp wiring needed with blink.
- **nvim-ts-autotag** for html/jsx/tsx.
- **mini.ai** (textobjects), **mini.surround** (`sa`/`sd`/`sr`) kept from v1.

---

## 6. Code smarts

### 6.1 Servers (0.12 style)

- **mason** + **mason-tool-installer** install once, never auto-update, no forced
  `:MasonToolsInstall` at startup (fixes v1 wart #14).
- **nvim-lspconfig** supplies defaults; servers enabled with `vim.lsp.enable`:
  `lua_ls`, `vtsls`, `pyright`, `bashls`, `cssls`, `html`, `jsonls`, `yamlls`,
  `marksman`, `tailwindcss`. (Vue wiring cut. PowerShell via its plugin, §6.5.)
- Per-server settings in `after/lsp/<name>.lua`:
  - **vtsls**: workspace TS version, update imports on file move, inlay hints short.
  - **lua_ls**: knows the Neovim runtime (0.12-native replacement for archived neodev),
    `callSnippet = "Replace"`.
- Every server gets blink.cmp capabilities and file-rename support.

### 6.2 LSP keymaps (via snacks picker where it lists things)

| Keys | Action |
|---|---|
| `gd` / `gD` | Definition / declaration |
| `gr` | References (picker) |
| `gI` | Implementation (picker) |
| `gy` | Type definition (picker) |
| `K` | Hover |
| `<leader>rn` | Rename symbol |
| `<leader>ca` | Code action |
| `<leader>th` | Toggle inlay hints |

- Document-highlight on `CursorHold` kept from v1.

### 6.3 Completion: blink.cmp

- Version `^1`, prebuilt binary. **Enter accepts**; `<C-j>`/`<C-k>` and `<C-n>`/`<C-p>`
  navigate (v1 muscle memory); `<C-Space>` opens docs/menu.
- Sources: lsp, path, snippets (built-in), buffer. Auto-brackets on; docs after 200 ms.
- Ghost text default (no inline AI to clash with).

### 6.4 Formatting: conform (the only pipeline)

- Format-on-save, 500 ms, LSP fallback. `<leader>=` formats manually.
- **markdown is on-demand only** (never reformat notes on save).

| Filetypes | Formatter |
|---|---|
| lua | stylua |
| python | black |
| js / ts / jsx / tsx / json / css / scss / less / yaml | prettier |
| markdown (manual `<leader>=` only) | prettier |

- `:ToggleFormatter` flips format-on-save per buffer, with a notification.

### 6.5 PowerShell & SQL (work tools)

- **powershell.nvim**: ft-gated (`ps1/psm1/psd1`), **`shell = "pwsh"`** (fixes v1 wart #4),
  PowerShell Editor Services via Mason. Needs the `pwsh` binary on the system (§0.2).
- **vim-dadbod + ui + completion**: genuinely lazy — the specs are not in the startup
  `vim.pack.add()`; a stub `:DBUI` command installs/loads them on first use (fixes
  wart #13); connections stay in `~/.local/share/db_ui/connections.json`.

### 6.6 Diagnostics look

- Severity-sorted, not updated in insert mode, underlined.
- **No inline virtual text** — the code stays clean (v1 behavior, user decision).
- Gutter icons per severity in the sign column, left of the line numbers.
- The message shows in a **float**: automatically after `]d` / `[d` jumps, and on
  `<leader>e`.

---

## 7. Git — the review deck (the heart of v2)

### 7.1 gitsigns (now with keymaps)

| Keys | Action |
|---|---|
| `]c` / `[c` | Next / previous hunk |
| `<leader>gh` | Stage/unstage hunk |
| `<leader>gr` | Reset hunk |
| `<leader>gs` | Stage buffer |
| `<leader>gb` | Blame line (float) |
| `<leader>gB` | Blame buffer |

### 7.2 mini.diff — in-file overlay

- `<leader>gd` toggles the overlay (what did the agent change *inside this file*).
- `]c`/`[c` follow hunks when the overlay is active.

### 7.3 codediff.nvim — side-by-side

- `<leader>dv` toggle diff view (tree explorer, per-file +/- stats) — walking a large
  agent changeset file by file.
- `<leader>dh` current file history, `<leader>dH` repo history.

### 7.4 lazygit

- `<leader>gg` opens lazygit in a snacks float, colors synced to the active theme.
- lazygit config is a dotfiles stow package (`lazygit/.config/lazygit/config.yml`):
  mouse off, auto-fetch off; the delta pager line stays commented until git-delta is
  installed (`scripts/install-lazygit.sh` ensures both packages on deploy).

---

## 8. Agentic helpers

*Feed context from the editor to agents running in other panes; the remote clipboard
provider carries it anywhere.*

### 8.1 Copy for the agent

| Keys | Action |
|---|---|
| `<leader>yf` | Copy file path relative to cwd + `#L<line>` (e.g. `lua/config/options.lua#L12`) |
| `<leader>yp` | Copy absolute path the same way |
| `<leader>cc` (visual) | Copy selection as fenced code block with `filename="…"` / `line=…` attrs |

- Each shows the copied text in a notification.

### 8.2 Workflow player

*A cheatsheet that executes: the named step sequences of the daily workflows,
navigable in a float, each runnable step triggered by the player itself.*

- **Data**: `lua/config/workflows.lua` — source of truth. A step is
  `{ label, keys?, run? }`; `run = true` makes the player press `keys` for you,
  strings are ex-commands, functions are custom actions, `nil` marks a manual step.
- **Player**: `lua/config/workflow_player.lua`, toggled with `<leader>w` (press again to
  close). **Run-and-resume** model: `<CR>` executes the current step and closes the
  float so the action (lazygit, codediff…) gets the whole screen; a notification shows
  `step n/N`; `<leader>w` reopens at the next step. Manual steps advance in place.
  Inside: `j`/`k` move, `r` restart, `s` switch workflow, `q`/`Esc` close.
- Picking a workflow goes through `vim.ui.select` (the snacks dropdown).
- **Shipped workflows**: Review agent changes · Feed context to the agent ·
  Config-iteration loop · Fix diagnostics sweep · Skills lessons 1–3 + rules of
  thumb (the pi skills workflow from `~/skills-tuto.md`: grill → spec → tickets
  → implement → retro).
- A Hyprland chord can't reach inside a TUI; if a desktop-level trigger is ever
  wanted, the `sendshortcut`-relay trick (like Omarchy's web-app binds) is the path.

---

## 9. Keybindings book (Omarchy Super+K family)

*Follows the existing tmux/herdr pattern — no patching of `/usr/share/omarchy`.*

- **`omarchy-menu-nvim-keybindings`** lives in the nvim stow package
  (`nvim/.local/bin/`, symlinked onto PATH):
  - Dumps real keymaps **live**: a headless Neovim runs the active config and writes
    every mapping that has a `desc` (builtin `:command`-style descriptions and `<Plug>`
    internals filtered out), formatted `MODE  keys → desc`.
  - Cached under `~/.cache/omarchy/`, keyed on nvim version + config file mtimes;
    `--print` mode supported like its siblings.
  - `--appname` / `OMARCHY_NVIM_KEYBOOK_APPNAME` select the config; default `nvim`
    (flipped at cutover); `--appname nvim-v1` reads the retired backup.
  - Presented with `omarchy-menu-select 'Neovim keybindings'` (informational — nothing
    to dispatch).
- Hyprland bind in `~/.config/hypr/bindings.lua`:
  `SUPER + SHIFT + K → "Neovim keybindings"` — which also makes it appear as an entry
  *inside* the main Super+K book, exactly like the tmux/herdr books do.
- Enforced by workflow rule: every v2 mapping carries `desc=`, so the book is complete
  by construction.

---

## 10. Build order (one prompt per step)

| Step | Contents |
|---|---|
| 1 ✓ | 0.1–1.8 foundation (no plugins yet) |
| 2 ✓ | 2.1–2.3 Omarchy bridge + transparency + clipboard |
| 3 ✓ | §3 look & feel |
| 4 ✓ | §4 picker, oil, tmux-navigator, which-key |
| 5 ✓ | §5 treesitter + editing helpers |
| 6 ✓ | §6 LSP, blink, conform, languages |
| 7 ✓ | §7 git review deck |
| 8 ✓ | §8 agent helpers |
| 9 ✓ | §9 keybindings book + hypr bind |
| 10 ✓ | cutover: v2 → `nvim/.config/nvim`, v1 → `nvim/.config/nvim-v1` (runnable backup), keybook appname → `nvim`, SPEC.md banner |
