# Neovim config spec — v1 (current state)

This spec describes the Neovim setup as it exists today in `~/dotfiles/nvim/.config/nvim`
(symlinked to `~/.config/nvim`), in the style of a plain-English spec: *what* each piece
does and *why* it is there. It is the baseline for the v2 "agentic workflow" retrofit.

Heritage: the config is a grown **kickstart.nvim** fork, managed by **lazy.nvim**, with a
hand-built **Omarchy theme bridge** on top. Neovim is **0.12.6**, but none of the 0.12
built-ins (`vim.pack`, `vim.lsp.enable`, ui2, `:restart`) are used yet.

Items marked ⚠️ are places where the code contradicts its own intent (verified, not
guessed). They are the candidates for the "challenge & cut" phase, summarized in §9.

---

## 0. Prerequisites

| Tool | Why |
|---|---|
| Neovim 0.12.6 | runtime (config itself only requires ~0.10 features) |
| `git` | lazy.nvim clones plugins |
| `make` + C compiler | telescope-fzf-native build, LuaSnip jsregexp build |
| Node.js + npm | Mason installs most language servers |
| `ripgrep` + `fd` | telescope live-grep / file finding |
| `prettier`, `black` | conform formatters, expected on PATH (Mason only ensures `stylua`) |
| `wl-copy` / `wl-paste` | local side of the remote clipboard provider |
| Nerd Font | `vim.g.have_nerd_font = true`; icons in statusline, bufferline, pickers |
| Omarchy | theme state dir `~/.local/state/omarchy/current/theme/` feeds the theme bridge |
| tmux (optional) | vim-tmux-navigator and the clipboard provider detect it |

---

## 1. Foundation

### 1.1 Layout

```
~/.config/nvim/
├── init.lua                  # requires: options → lazy → keymaps → autocmds
├── lazy-lock.json            # committed
├── stylua.toml               # 2-space indent for the config's own Lua
├── lua/config/
│   ├── options.lua           # core options + leader (before lazy)
│   ├── lazy.lua              # lazy.nvim bootstrap + setup + theme apply
│   ├── keymaps.lua           # plugin-free keymaps
│   ├── autocmds.lua          # plugin-free autocmds
│   └── remote_clipboard.lua  # OSC52/wl-copy clipboard provider (module)
├── lua/plugins/              # one file per plugin, auto-imported by lazy.nvim
│   └── theme.lua → ~/.local/state/omarchy/current/theme/neovim.lua  (symlink, not in repo)
└── plugin/after/
    └── transparency.lua      # transparent background enforcement
```

- lazy.nvim: update checker on (silent), change-detection silent, `gzip/tar/zip/tohtml/tutor`
  runtime plugins disabled.
- 60 plugins in the lockfile; ~20 of them are colorschemes for the theme bridge.
- ⚠️ `plugins/ts-tools.lua` returns `{}` — dead file (typescript-tools experiment, commented out).

### 1.2 Leader and basics

- Leader and localleader: **Space**.
- Mouse: **on** (`mouse = "a"`) — kept for split resizing. (The blog setup goes keyboard-only.)
- Clipboard: `unnamedplus`, with a custom transport (§2.3) when remote.
- Indent: **2 spaces** (`tabstop`/`shiftwidth`/`softtabstop` = 2, `expandtab`), `breakindent` on.
- `showmode` off (lualine shows it). `termguicolors` on.

### 1.3 Look of the buffer

- `number` on, **no** `relativenumber`.
- `cursorline` on, `scrolloff` 10, `signcolumn` always on (no text jump on git/diagnostic marks).
- `showtabline = 2`: the bufferline is always visible.
- Whitespace made visible: `list` + listchars `» `, `·`, `␣`.
- `inccommand = "split"`: live preview of `:s` substitutions.
- Diagnostic floats get a `single` border.

### 1.4 Search, undo, timing

- `ignorecase` + `smartcase`; `hlsearch` on, cleared with `<Esc>`.
- Persistent undo (`undofile`).
- Trimmed shada: `'10 <0 s10 h` — only 10 oldfiles, no saved registers.
  *Why:* privacy/speed; consequently telescope `oldfiles` is not mapped.
- `updatetime` 250, `timeoutlen` 300 (which-key pops up fast).

### 1.5 Splits

- New splits open below / to the right.
- `<C-w>s` and `<C-w>v` are **swapped** — the author finds Vim's default
  horizontal/vertical naming backwards.

### 1.6 Autocmds

- Yanked text flashes briefly.
- Reopening a file restores the last cursor position.
- **Every** save strips trailing whitespace (`%s/\s\+$//e`, all filetypes).
  ⚠️ This also destroys Markdown's trailing-two-space line breaks.

### 1.7 Core keymaps (plugin-free)

| Mode | Keys | Action | Notes |
|---|---|---|---|
| n | `<Esc>` | Clear search highlight | |
| n | `[d` / `]d` | Prev / next diagnostic | |
| n | `<leader>e` | Diagnostic float | |
| n | `<leader>q` | Diagnostic loclist | |
| n | arrows | Nag: "Use h/j/k/l!!" | training wheels |
| i n x s | `<C-s>` | Save file | |
| n | `<C-a>` | Select all | shadows the increment default; `+` replaces it |
| n | `+` / `-` | Increment / decrement number | |
| n | `<leader>o` / `<leader>O` | Empty line below / above | stays in normal mode |
| n i v | `<A-j>` / `<A-k>` | Move line/selection down / up | |
| v | `<` / `>` | Re-indent, keep selection | |
| c | `W` → `w` | Typo abbrev | |
| c | `k` → `WhichKey` | Abbrev | quirky: `:k` is a real vim command (set mark) |

---

## 2. Omarchy integration (the distinctive part)

This is the machinery that makes Neovim a first-class Omarchy citizen. None of it exists
in the blog setup; it is the part most worth preserving in v2.

### 2.1 Theme bridge

*Goal: Neovim follows the active Omarchy theme, including live switching.*

- `lua/plugins/theme.lua` is a **symlink** into Omarchy state
  (`~/.local/state/omarchy/current/theme/neovim.lua`). Omarchy regenerates that file on
  theme switch; it carries a colorscheme plugin spec plus a `LazyVim/LazyVim` spec whose
  `opts.colorscheme` names the scheme to apply.
- A **virtual LazyVim stub** in `lazy.lua` absorbs that `LazyVim/LazyVim` spec so
  lazy.nvim never actually installs LazyVim; after `setup()`, `lazy.lua` reads the spec
  and applies the colorscheme itself.
- `plugins/all-themes.lua` pre-installs **~20 colorschemes** (aether pinned to the exact
  name/branch Omarchy 4 generates, plus catppuccin, gruvbox, kanagawa, rose-pine,
  tokyonight, …) so any Omarchy theme switch works instantly and offline. Comments
  document Omarchy 3.8 vs 4 compatibility.
- `plugins/omarchy-theme-hotreload.lua` (local pseudo-plugin): on lazy.nvim's
  `LazyReload` event it drops the cached theme module, clears highlights, fully reloads
  the theme plugin, re-applies the colorscheme, re-sources transparency, and re-fires
  `ColorScheme`/`VimEnter` — i.e. **live theme switching without restarting Neovim**.
- ⚠️ The whole bridge is **welded to lazy.nvim internals** (`LazyReload`,
  `lazy.core.config`, `lazy.core.loader`). A v2 on `vim.pack` must re-implement it
  (e.g. file-watch the state symlink instead).

### 2.2 Transparency

- `plugin/after/transparency.lua` strips the background from ~60 highlight groups
  (core UI, floats, telescope, which-key, notify, bufferline except `*Selected`) while
  keeping their other attributes, so the terminal blur shows through.
- Re-applies on `ColorScheme`, `UIEnter`, and `VeryLazy` (lazy-loaded plugins define
  groups late).

### 2.3 Remote clipboard

- `config/remote_clipboard.lua`: when inside **tmux, SSH, or herdr** (detected by env
  vars or walking `/proc` ancestry), installs a custom `vim.g.clipboard` provider:
  - **copy** goes to OSC52 (tmux rebroadcasts to every attached client) *and* to
    `wl-copy` when a Wayland display exists;
  - **paste** prefers `wl-paste` (so content copied in other apps works), falling back
    to an OSC52 query.
- On a plain local session it stays out of the way (default provider).

---

## 3. Look & feel

| Plugin | Role / config | Notes |
|---|---|---|
| lualine | global statusline: mode / branch / filename / diagnostics+encoding+filetype / progress / location | ⚠️ theme hardcoded to `"nightfly"` — does **not** follow the Omarchy theme the rest of the UI switches to |
| bufferline | buffer tabs at the top (defaults) | works with `showtabline=2` |
| nvim-web-devicons | icons for telescope/lualine/bufferline | |
| mini.icons | icons for oil | |
| vim-devicons | ⚠️ legacy **Vimscript** icon plugin, third icon source, nothing uses it | |
| fidget | LSP progress spinner bottom-right | |
| mini.cursorword | highlights other occurrences of the word under the cursor | textual, no LSP needed |
| todo-comments | highlights `TODO`/`FIXME`/…; `<leader>ft` lists them in telescope | |
| nvim-highlight-colors | paints hex/rgb/hsl color literals | |
| headlines | background bars for Markdown headings/code blocks | ⚠️ overlaps render-markdown |
| render-markdown | full in-buffer Markdown rendering (ft: markdown, Avante) | Avante ft configured but no Avante plugin installed |

---

## 4. Navigating

### 4.1 Telescope (+ fzf-native, ui-select)

`ui-select` makes code actions etc. use the dropdown. Insert-mode picker mappings:
`<C-j>`/`<C-k>` move selection, `<C-i>` confirm.
⚠️ The normal-mode picker mappings are written as `["<j>"]`/`["<k>"]`/`["<i>"]` —
invalid key notation, they bind nothing.

| Keys | Action |
|---|---|
| `<leader>ff` | Find files |
| `<leader>fg` | Live grep |
| `<leader>fw` | Grep word under cursor |
| `<leader>fb` | Buffers |
| `<leader>fd` | Diagnostics |
| `<leader>fh` | Help tags |
| `<leader>fk` | Keymaps |
| `<leader>fc` | Live grep in open files |
| `<leader>fn` | Find files in nvim config |
| `<leader>ft` | TODO comments (todo-comments) |

### 4.2 File explorer: oil (+ oil-git)

- Directories are editable buffers; `:w` applies renames/moves/deletes.
- `<leader>-` (Space `-`) toggles a **float** (40% × 60%, rounded), hidden files shown.
- In oil: `<M-h>` opens in split (`<C-h>` freed for tmux-navigator).
- oil-git adds git status highlights inside oil.

### 4.3 Window / pane movement

- vim-tmux-navigator: `<C-h/j/k/l>` moves across Neovim splits **and** tmux panes
  seamlessly; `<C-\>` previous pane.

### 4.4 Buffers

| Keys | Action |
|---|---|
| `<Tab>` / `<S-Tab>` | Next / previous buffer |
| `<leader><Tab>` | Delete buffer |

### 4.5 which-key

- Pops up pending keymaps after 300 ms. Groups declared: `[C]ode`, `[D]ocument`,
  `[F]ind`, `[R]ename`, `[T]oggle`, `[W]orkspace`, `Git [H]unk` (v).
- ⚠️ `[D]ocument` and `[W]orkspace` groups are **empty** — the kickstart maps behind
  them (`<leader>ds`, `<leader>ws`, `<leader>D`) are commented out in lspconfig.
  `Git [H]unk` is declared but no gitsigns keymaps exist (§7).

---

## 5. Syntax

### 5.1 Treesitter ⚠️ (broken)

- `nvim-treesitter` is pinned to the **main** branch, but configured with the **master**
  branch API (`ensure_installed`, `auto_install`, `highlight`, `indent` passed to
  `setup()`). The main branch ignores all of these.
- **Verified:** opening a `.ts` file yields `ts_highlighter_active=false` — highlighting
  falls back to legacy regex `syntax`. Only filetypes Neovim itself defaults to
  treesitter (lua, markdown, vimdoc, …) get real treesitter highlighting.
- 27 parsers are installed on disk (from earlier installs), so only the *activation* is
  missing, not the parsers.
- Treesitter folding is not configured either.

### 5.2 Editing helpers

- nvim-ts-autotag: auto-close/rename HTML/JSX tags.
- nvim-autopairs: bracket pairing, wired into cmp (auto-`(` after confirming a function).
- mini.ai: better `a`/`i` textobjects. mini.surround: `sa`/`sd`/`sr` surroundings.

---

## 6. Code smarts

### 6.1 LSP stack

- mason + mason-lspconfig + mason-tool-installer auto-install and wire up servers;
  fidget shows progress; neodev configures lua_ls for the Neovim runtime.
- ⚠️ neodev is **archived/deprecated** (superseded by lazydev).
- ⚠️ `:MasonToolsInstall` is additionally forced on **every startup**.
- Servers: `bashls`, `cssls`, `jsonls`, `marksman`, `html`, `pyright`, `ts_ls`,
  `tailwindcss`, `lua_ls` (callSnippet = Replace).
- ⚠️ The `ts_ls` Vue block is double-nested (`ts_ls = { { init_options = … } }`), so
  lspconfig never sees it — and its plugin path
  `/usr/local/lib/node_modules/@vue/typescript-plugin` doesn't exist on this machine.
  The Vue wiring is dead weight twice over.

### 6.2 LSP keymaps (on attach)

| Keys | Action |
|---|---|
| `gd` | Go to definition |
| `gD` | Go to declaration |
| `gr` | References (telescope) |
| `K` | Hover docs |
| `<leader>rn` | Rename symbol |
| `<leader>ca` | Code action |
| `<leader>th` | Toggle inlay hints (when supported) |

Plus: document-highlight of the symbol under the cursor on `CursorHold`.
Commented out (kickstart leftovers): `gI`, `<leader>D`, `<leader>ds`, `<leader>ws`.

### 6.3 Completion: nvim-cmp

- Sources: LSP, LuaSnip, path. No snippet collection installed (friendly-snippets
  commented out).
- `completeopt = menu,menuone,noinsert`; docs scroll with `<C-b>/<C-f>`.

| Keys (insert) | Action |
|---|---|
| `<C-n>` / `<C-j>` | Next item |
| `<C-p>` / `<C-k>` | Previous item |
| `<CR>` / `<C-m>` | Confirm (select = true) |
| `<C-Space>` | Trigger completion |
| `<C-l>` / `<C-h>` | Snippet jump forward / back |

### 6.4 Formatting

- **conform**: format-on-save, 500 ms timeout, LSP fallback (disabled for c/cpp).
  `<leader>=` formats manually (async, no LSP fallback).

| Filetypes | Formatter |
|---|---|
| lua | stylua |
| python | black |
| js / ts / jsx / tsx / json / css / scss / less | prettier |

- ⚠️ **prettier.nvim** is installed on top, covering an overlapping filetype list
  (plus graphql/html/markdown/yaml) — a second, redundant formatting pipeline.

---

## 7. Git

- **gitsigns** with pure defaults: gutter signs only.
- ⚠️ **No keymaps at all**: no hunk navigation, staging, blame, or diff. The which-key
  "Git [H]unk" group points at nothing. For a review-centric agentic workflow (the
  blog's §6 is "the part I use the most"), this is the biggest functional gap.
- No lazygit integration, no diff-view/overlay tooling.

---

## 8. Languages & misc

- **powershell.nvim** (ft `ps1/psm1/psd1`): PowerShell Editor Services via Mason.
  ⚠️ `shell = "powershell"` — on Linux the binary is `pwsh`; as configured the
  integrated shell/eval can't work here.
- **vim-dadbod + dadbod-ui + dadbod-completion**: SQL client
  (connections in `~/.local/share/db_ui/connections.json`).
  ⚠️ Loaded eagerly at startup (no `cmd`/`ft` lazy triggers).
- Markdown: marksman LSP + render-markdown + headlines (§3).

---

## 9. Wart summary (input for the "challenge & cut" phase)

| # | Finding | Severity |
|---|---|---|
| 1 | Treesitter main-branch plugin + master-branch config → **no TS highlighting/indent for most filetypes** (verified) | broken |
| 2 | `ts_ls` Vue block double-nested **and** plugin path missing → dead config | broken |
| 3 | Telescope normal-mode mappings `"<j>"`/`"<k>"`/`"<i>"` → invalid, bind nothing | broken |
| 4 | powershell.nvim `shell = "powershell"` on Linux (should be `pwsh`) | broken |
| 5 | prettier.nvim duplicates conform | redundant |
| 6 | vim-devicons: third icon plugin, unused, Vimscript | redundant |
| 7 | headlines vs render-markdown overlap | redundant |
| 8 | `ts-tools.lua` returns `{}` | dead file |
| 9 | neodev archived (→ lazydev) | deprecated |
| 10 | lualine theme `"nightfly"` ignores the Omarchy theme bridge | inconsistent |
| 11 | which-key groups for keymaps that don't exist (Document, Workspace, Git Hunk) | inconsistent |
| 12 | gitsigns without any keymaps; no review tooling at all | gap |
| 13 | dadbod trio not lazy-loaded | perf |
| 14 | `:MasonToolsInstall` forced on every startup | perf/noise |
| 15 | Trailing-whitespace strip on **all** filetypes (breaks Markdown hard breaks) | footgun |
| 16 | Zero agentic helpers: no copy-path-with-line, no lazygit/diff review, no `:restart` workflow | gap vs. goal |

---

## Appendix A: full keymap inventory

(One row per mapping; source = file that defines it. Mode `n` unless noted.)

| Keys | Mode | Action | Source |
|---|---|---|---|
| `<Esc>` | n | Clear search highlight | config/keymaps.lua |
| `<C-w>s` ↔ `<C-w>v` | n | Swapped split commands | config/keymaps.lua |
| `[d` / `]d` | n | Prev/next diagnostic | config/keymaps.lua |
| `<leader>e` | n | Diagnostic float | config/keymaps.lua |
| `<leader>q` | n | Diagnostic loclist | config/keymaps.lua |
| `<C-s>` | i n x s | Save | config/keymaps.lua |
| `<C-a>` | n | Select all | config/keymaps.lua |
| `+` / `-` | n | Increment/decrement | config/keymaps.lua |
| `<leader>o` / `<leader>O` | n | Empty line below/above | config/keymaps.lua |
| `<A-j>` / `<A-k>` | n i v | Move line down/up | config/keymaps.lua |
| `<` / `>` | v | Indent, keep selection | config/keymaps.lua |
| `<leader>ff/fg/fw/fb/fd/fh/fk/fc/fn` | n | Telescope pickers | plugins/telescope.lua |
| `<leader>ft` | n | TODO picker | plugins/todo-comments.lua |
| `<Tab>` / `<S-Tab>` | n | Next/prev buffer | plugins/bufferline.lua |
| `<leader><Tab>` | n | Delete buffer | plugins/bufferline.lua |
| `<leader>-` | n | Oil float | plugins/oil.lua |
| `<C-h/j/k/l>`, `<C-\>` | n | tmux/split navigation | plugins/vim-tmux-navigator.lua |
| `<leader>=` | all | Format buffer | plugins/conform.lua |
| `gd` `gD` `gr` `K` | n (LSP) | Definition/declaration/references/hover | plugins/lspconfig.lua |
| `<leader>rn` `<leader>ca` `<leader>th` | n (LSP) | Rename / code action / inlay hints | plugins/lspconfig.lua |
| `<C-n>/<C-j>` `<C-p>/<C-k>` `<CR>/<C-m>` `<C-Space>` `<C-l>/<C-h>` | i | cmp navigation/confirm/snippets | plugins/cmp.lua |
| `sa` `sd` `sr` | n v | Surround add/delete/replace | plugins/mini.lua |
