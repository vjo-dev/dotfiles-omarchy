# Neovim Markdown browser-preview research

> Location: `docs/research/nvim-markdown-preview.md`. Research is based only on primary sources: official repositories/source, Neovim documentation, and official tool documentation.

## Recommendation

Use **`brianhuster/live-preview.nvim`** for `<leader>m`. It is the best fit here because its HTTP/WebSocket backend is implemented in Lua using Neovim's built-ins, requires no Node/Deno/Python runtime, updates unsaved Markdown as you type, supports synchronized scrolling, KaTeX, Mermaid, syntax highlighting, and can open a configured browser command. It also integrates with `snacks.picker`, which this config already has. [README](https://github.com/brianhuster/live-preview.nvim/blob/main/README.md) [configuration source](https://github.com/brianhuster/live-preview.nvim/blob/main/lua/livepreview/config.lua) [browser launcher source](https://github.com/brianhuster/live-preview.nvim/blob/main/lua/livepreview/utils.lua) [picker source](https://github.com/brianhuster/live-preview.nvim/blob/main/lua/livepreview/picker.lua)

For **whole-repository browsing**, continue using **MkDocs**, but remove the per-project boilerplate by keeping one shared preview config whose `docs_dir` comes from an environment variable. MkDocs requires a config (at minimum `site_name`), accepts an alternate config with `-f` including `-f -` for stdin, allows an absolute `docs_dir`, and—when `nav` is omitted—infers a nested, alphabetically sorted navigation tree from all Markdown under `docs_dir`. [CLI](https://www.mkdocs.org/user-guide/cli/) [configuration](https://www.mkdocs.org/user-guide/configuration/)

If “whole project” only means “quickly select any Markdown file and preview it,” `:LivePreview pick` is even lighter: it recursively lists supported files below Neovim's current working directory and uses Snacks when configured. It is not, however, a browser-side documentation tree like MkDocs. [picker source](https://github.com/brianhuster/live-preview.nvim/blob/main/lua/livepreview/picker.lua) [file-list source](https://github.com/brianhuster/live-preview.nvim/blob/main/lua/livepreview/utils.lua)

## 1. Neovim browser-preview options

### Comparison

| Option | Maintenance status | Runtime/dependencies | Live-preview features | Selecting Brave |
|---|---|---|---|---|
| `live-preview.nvim` | Not archived; actively developed at research time. [GitHub API](https://api.github.com/repos/brianhuster/live-preview.nvim) | Neovim >= 0.10.1 and a modern browser; backend is Lua/Neovim built-ins. A picker is optional, and Snacks is supported. [README](https://github.com/brianhuster/live-preview.nvim/blob/main/README.md) | Unsaved Markdown updates, sync scroll, code highlighting, KaTeX, Mermaid; also HTML, SVG, and AsciiDoc. [README](https://github.com/brianhuster/live-preview.nvim/blob/main/README.md) | `browser` is a terminal command; `default` uses `vim.ui.open()`. Set `browser = "brave"` (or a wrapper command for app mode). [help](https://github.com/brianhuster/live-preview.nvim/blob/main/doc/livepreview.txt) [source](https://github.com/brianhuster/live-preview.nvim/blob/main/lua/livepreview/utils.lua) |
| `peek.nvim` | Not archived, but its default branch's latest commit is from April 2024 and repository push activity is from August 2024; it appears quiet rather than archived. [GitHub API](https://api.github.com/repos/toppair/peek.nvim) [commits](https://github.com/toppair/peek.nvim/commits/master/) | Requires Deno and a `deno task ... build` installation step. [README](https://github.com/toppair/peek.nvim/blob/master/README.md) | Live update, sync scroll, GitHub-like CSS, KaTeX, Mermaid. [README](https://github.com/toppair/peek.nvim/blob/master/README.md) | `app = "browser"` uses the default browser; `app = "brave"` selects Brave; arrays add fixed arguments, e.g. `{ "brave", "--new-window" }`. [README](https://github.com/toppair/peek.nvim/blob/master/README.md) |
| `markdown-preview.nvim` | **Not archived**. It is commonly described as stale, and that is fairer than “archived”: the latest default-branch commit is from October 2023, while GitHub reports repository push activity in July 2024. [GitHub API](https://api.github.com/repos/iamcco/markdown-preview.nvim) [commits](https://github.com/iamcco/markdown-preview.nvim/commits/master/) | Vim >= 8.1 or Neovim. Installation either downloads a prebuilt backend or builds its `app` with Node plus Yarn/npm. [README](https://github.com/iamcco/markdown-preview.nvim/blob/master/README.md) | Mature feature set: async updates, sync scroll, math, Mermaid, PlantUML, charts, TOC, task lists, local images, custom CSS. [README](https://github.com/iamcco/markdown-preview.nvim/blob/master/README.md) | `g:mkdp_browser` chooses a browser. `g:mkdp_browserfunc` supplies a custom URL-opening function and is the flexible route for flags such as `--app=URL`. [README config/FAQ](https://github.com/iamcco/markdown-preview.nvim/blob/master/README.md) |
| Grip | Not archived, but less recently maintained than the Lua plugin. [GitHub API](https://api.github.com/repos/joeyespo/grip) | Python package; online mode uses GitHub's Markdown API, while `--offline` renders locally. [README](https://github.com/joeyespo/grip/blob/master/README.md) | Watches and auto-refreshes a single file or a repository README; can also address explicit Markdown paths under a served directory. [README](https://github.com/joeyespo/grip/blob/master/README.md) | `-b` opens the system browser, not a named browser. Omit `-b`, then run `brave http://localhost:6419/...` yourself. [README](https://github.com/joeyespo/grip/blob/master/README.md) |
| `mkdocs serve` | Actively maintained project. [GitHub API](https://api.github.com/repos/mkdocs/mkdocs) | Python/MkDocs and a minimal YAML config. [getting started](https://www.mkdocs.org/getting-started/) [configuration](https://www.mkdocs.org/user-guide/configuration/) | Whole-site rebuild and browser live reload; inferred navigation across all Markdown. [CLI](https://www.mkdocs.org/user-guide/cli/) [configuration](https://www.mkdocs.org/user-guide/configuration/) | It does not need to own browser opening: start it, then explicitly run `brave --new-window http://127.0.0.1:8000/` or the app wrapper below. |
| Glow | Actively maintained, but it is a terminal reader rather than a browser live-preview server. [GitHub API](https://api.github.com/repos/charmbracelet/glow) | One executable. [README](https://github.com/charmbracelet/glow/blob/main/README.md) | Running `glow` discovers Markdown recursively in the current directory or Git repository; `glow FILE.md` renders one file. No browser live reload. [README](https://github.com/charmbracelet/glow/blob/main/README.md) | Not applicable; it renders in the terminal. |

### Notes on each plugin

#### `live-preview.nvim`

The current public configuration entry point is `require("livepreview.config").set({...})`; `require("livepreview").setup({...})` still exists but is marked deprecated in source. `:LivePreview start` previews the current supported buffer, `:LivePreview close` stops the server, and `:LivePreview pick` selects a supported file from the current working tree. [init source](https://github.com/brianhuster/live-preview.nvim/blob/main/lua/livepreview/init.lua) [command source](https://github.com/brianhuster/live-preview.nvim/blob/main/plugin/livepreview.lua) [help](https://github.com/brianhuster/live-preview.nvim/blob/main/doc/livepreview.txt)

With the default `dynamic_root = false`, the server root is Neovim's current working directory, which allows project-relative image and document links to work when Neovim's cwd is the repository root. Setting `dynamic_root = true` instead makes the current file's parent its root. [help](https://github.com/brianhuster/live-preview.nvim/blob/main/doc/livepreview.txt) [server construction](https://github.com/brianhuster/live-preview.nvim/blob/main/lua/livepreview/init.lua)

One implementation caveat: on Unix, the plugin checks port ownership using `lsof`; this is not advertised as a rendering dependency, but without it the diagnostic port check may fail/noise. [source](https://github.com/brianhuster/live-preview.nvim/blob/main/lua/livepreview/utils.lua)

#### `peek.nvim`

Peek is polished but Deno is a hard requirement, and installation compiles its frontend with `deno task --quiet build:fast`. Its `app` option is better structured than a shell string: it accepts `"browser"`, an executable name, or an executable/argument array. [README](https://github.com/toppair/peek.nvim/blob/master/README.md) [launcher source](https://github.com/toppair/peek.nvim/blob/master/lua/peek/app.lua)

#### `markdown-preview.nvim`

This is not archived according to GitHub, so “archived” would be incorrect. It is nevertheless the least attractive default for a fresh setup here because its default branch has seen little recent code movement and its backend has a prebuilt/download or Node package build step. Its rendering features remain broader than the two newer alternatives. [GitHub API](https://api.github.com/repos/iamcco/markdown-preview.nvim) [README](https://github.com/iamcco/markdown-preview.nvim/blob/master/README.md)

### Non-plugin commands

```sh
# GitHub-like single-file preview with automatic refresh
# Then open the printed URL explicitly in Brave.
grip path/to/file.md
brave http://localhost:6419/

# Terminal-only single file
glow path/to/file.md

# Terminal Markdown browser for the current repo
glow
```

Grip's `-b` flag opens a browser automatically, but its CLI exposes a boolean “open browser” behavior rather than a browser executable option. Glow recursively discovers local Markdown but has no browser/server role. [Grip README](https://github.com/joeyespo/grip/blob/master/README.md) [Glow README](https://github.com/charmbracelet/glow/blob/main/README.md)

## 2. Whole-project preview

### MkDocs: sensible and lowest-friction for this user

`mkdocs serve` does **not** operate as a config-free arbitrary-directory browser: MkDocs looks for `mkdocs.yml` by default, and its configuration must contain at least `site_name`. However, `-f/--config-file` accepts another file or `-` for stdin, `docs_dir` may be absolute, and omitted `nav` is inferred from every Markdown file under `docs_dir`. Therefore one shared config works across repositories. [CLI](https://www.mkdocs.org/user-guide/cli/) [configuration: minimum config, nav, docs_dir, environment variables](https://www.mkdocs.org/user-guide/configuration/)

A reusable config, for example `~/.config/mkdocs/preview.yml`:

```yaml
site_name: Repository preview
docs_dir: !ENV DOCS_DIR
site_dir: !ENV [MKDOCS_SITE_DIR, /tmp/mkdocs-repository-preview]
```

Run it from a repository root:

```sh
DOCS_DIR="$PWD" mkdocs serve -f ~/.config/mkdocs/preview.yml
brave http://127.0.0.1:8000/
```

MkDocs officially supports `!ENV` values and fallback values, and resolves an absolute `docs_dir` directly. Keeping `site_dir` outside the repository avoids generated preview output in the source tree. [environment variables](https://www.mkdocs.org/user-guide/configuration/#environment-variables) [docs_dir](https://www.mkdocs.org/user-guide/configuration/#docs_dir) [site_dir](https://www.mkdocs.org/user-guide/configuration/#site_dir)

A file-free variant is also possible because `-f -` reads YAML from stdin:

```sh
printf 'site_name: Repository preview\ndocs_dir: %s\nsite_dir: /tmp/mkdocs-repository-preview\n' "$PWD" \
  | mkdocs serve -f -
```

The shared file is safer for paths requiring YAML quoting and is easier to extend. The CLI's support for `-f -` is documented officially. [CLI](https://www.mkdocs.org/user-guide/cli/)

### mdBook

mdBook is excellent for an intentionally structured book, but not for arbitrary existing repositories: it expects a `book.toml`, source files normally under `src/`, and a strict `src/SUMMARY.md`; the official documentation states that without `SUMMARY.md` there is no book. `mdbook serve --open` watches, rebuilds, and opens the default browser, but the required book structure makes it heavier than shared-config MkDocs for this use. [creating a book](https://rust-lang.github.io/mdBook/guide/creating.html) [SUMMARY.md](https://rust-lang.github.io/mdBook/format/summary.html) [serve](https://rust-lang.github.io/mdBook/cli/serve.html)

### Docsify

Docsify is “zero build” in the sense that the browser renders Markdown at runtime: a directory needs an `index.html` entry point and usually a `README.md` home page, and can be served by `docsify serve`, `python -m http.server`, or any static server. It does not automatically provide MkDocs-style navigation for every Markdown file; a useful site normally adds links or a `_sidebar.md`. It is attractive for a repository that wants to commit a tiny permanent docs shell, but not lighter than the shared MkDocs config for ad-hoc browsing of arbitrary repositories. [quick start](https://github.com/docsifyjs/docsify/blob/develop/docs/quickstart.md) [sidebar guide](https://github.com/docsifyjs/docsify/blob/develop/docs/adding-pages.md) [configuration](https://github.com/docsifyjs/docsify/blob/develop/docs/configuration.md)

### Practical ranking for “browse all `.md` in this repo in Brave”

1. **MkDocs + one shared config** — best browser-side tree and automatic inferred navigation, especially since MkDocs is already familiar. [MkDocs configuration](https://www.mkdocs.org/user-guide/configuration/)
2. **`:LivePreview pick`** — fewest moving parts and excellent from Neovim, but selection lives in Neovim rather than a browser sidebar. [live-preview picker](https://github.com/brianhuster/live-preview.nvim/blob/main/lua/livepreview/picker.lua)
3. **Docsify** — tiny permanent site shell, but requires `index.html` and authored/generated navigation for a proper tree. [Docsify quick start](https://github.com/docsifyjs/docsify/blob/develop/docs/quickstart.md)
4. **mdBook** — best only when the repository is genuinely a book and maintaining `SUMMARY.md` is desirable. [mdBook format](https://rust-lang.github.io/mdBook/format/summary.html)
5. **Grip/Glow** — useful readers, but not equivalent to a generated project documentation site. [Grip README](https://github.com/joeyespo/grip/blob/master/README.md) [Glow README](https://github.com/charmbracelet/glow/blob/main/README.md)

## 3. Brave on Linux/Wayland

First find the installed executable; package naming varies:

```sh
command -v brave brave-browser brave-browser-stable
```

Brave's official Linux page documents its distro packages. On this machine, the installed executable is `/usr/bin/brave`. [Brave Linux installation](https://brave.com/linux/)

Useful launch forms are:

```sh
# Ordinary Brave tab/window
brave http://127.0.0.1:5500/path/to/file.md
brave --new-window http://127.0.0.1:5500/path/to/file.md

# Minimal browser chrome (“application mode”)
brave --app=http://127.0.0.1:5500/path/to/file.md

# Force native Wayland/Ozone only if the local Brave setup needs it
brave --ozone-platform=wayland --app=http://127.0.0.1:5500/path/to/file.md
```

Chromium defines `--app` as launching the associated URL in application mode and defines the `ozone-platform` switch used to select an Ozone platform implementation. Modern setups may already select Wayland appropriately, so forcing `--ozone-platform=wayland` should be treated as an optional compatibility preference, not a universal requirement. [Chromium switches header](https://chromium.googlesource.com/chromium/src/+/main/chrome/common/chrome_switches.h) [Ozone switches source](https://chromium.googlesource.com/chromium/src/+/main/ui/ozone/public/ozone_switches.cc)

`xdg-open URL` opens the URL in the user's preferred application. It therefore selects Brave only if Brave is the registered default browser; it is not the right mechanism when the requirement is “always Brave.” [xdg-open manual](https://man.archlinux.org/man/xdg-open.1.en)

### Robust `--app=URL` integration

The preview plugins generally append the URL after a configured executable and fixed arguments. Chromium's app form associates the URL as the value of `--app`, so a tiny wrapper is the robust option:

```sh
# ~/.local/bin/brave-app
#!/bin/sh
exec brave --app="$1"
```

Optional forced-Wayland version:

```sh
#!/bin/sh
exec brave --ozone-platform=wayland --app="$1"
```

```sh
chmod +x ~/.local/bin/brave-app
```

Then use `browser = "brave-app"` in `live-preview.nvim`, `app = "brave-app"` in Peek, or call the wrapper from `markdown-preview.nvim`'s `g:mkdp_browserfunc`. The relevant extension points are documented or implemented by each project. [live-preview browser source](https://github.com/brianhuster/live-preview.nvim/blob/main/lua/livepreview/utils.lua) [Peek app option](https://github.com/toppair/peek.nvim/blob/master/README.md) [markdown-preview browser function](https://github.com/iamcco/markdown-preview.nvim/blob/master/README.md)

## 4. Config sketch for this dotfiles tree

The current config installs all plugins in one `vim.pack.add()` call in `nvim/.config/nvim/lua/plugins/init.lua`, configures UI plugins with direct `require(...).setup()`-style calls in `lua/plugins/ui.lua`, and centralizes plugin keymaps in `lua/plugins/keymaps.lua`.

### `nvim/.config/nvim/lua/plugins/init.lua`

Add to the single `vim.pack.add()` list, near the UI/syntax tools:

```lua
gh("brianhuster/live-preview.nvim"),
```

No build hook or runtime dependency is needed. [live-preview README](https://github.com/brianhuster/live-preview.nvim/blob/main/README.md)

### `nvim/.config/nvim/lua/plugins/ui.lua`

```lua
-- Browser preview for Markdown/HTML/AsciiDoc/SVG.
require("livepreview.config").set({
	browser = "brave", -- or "brave-app" for --app=URL
	picker = "snacks.picker",
	dynamic_root = false, -- serve from Neovim cwd/repository root
	sync_scroll = true,
})
```

The plugin's README mentions `setup`, but current source marks it deprecated in favor of `require("livepreview.config").set()`. The exact picker identifier is `snacks.picker`. [config source](https://github.com/brianhuster/live-preview.nvim/blob/main/lua/livepreview/config.lua) [init source](https://github.com/brianhuster/live-preview.nvim/blob/main/lua/livepreview/init.lua)

### `nvim/.config/nvim/lua/plugins/keymaps.lua`

```lua
-- ── Markdown/browser preview ───────────────────────────────────────────────
map("n", "<leader>m", "<cmd>LivePreview start<CR>", { desc = "Preview Markdown in browser" })
map("n", "<leader>mp", "<cmd>LivePreview pick<CR>", { desc = "Pick file to preview" })
map("n", "<leader>mc", "<cmd>LivePreview close<CR>", { desc = "Close browser preview server" })
```

`start`, `pick`, and `close` are the plugin's official command subcommands. [command source](https://github.com/brianhuster/live-preview.nvim/blob/main/plugin/livepreview.lua) [help](https://github.com/brianhuster/live-preview.nvim/blob/main/doc/livepreview.txt)

### Optional whole-project helper

A shell function keeps project browsing outside Neovim and allows the server to remain useful while navigating Brave:

```sh
mdocs() {
  DOCS_DIR="$PWD" mkdocs serve -f "$HOME/.config/mkdocs/preview.yml" "$@"
}
```

In another shell, or after backgrounding the server:

```sh
brave-app http://127.0.0.1:8000/
```

This division is intentional: `live-preview.nvim` is optimized for the current unsaved buffer and editor scroll synchronization, while MkDocs is optimized for building and navigating a linked documentation tree. [live-preview README](https://github.com/brianhuster/live-preview.nvim/blob/main/README.md) [MkDocs CLI](https://www.mkdocs.org/user-guide/cli/)

## Bottom line

- Install **`live-preview.nvim`**, map `<leader>m` to `:LivePreview start`, and set `browser = "brave"` or `"brave-app"`.
- Keep `dynamic_root = false` and launch Neovim at the repository root so relative links and assets resolve project-wide.
- Use `:LivePreview pick` when an editor-side all-Markdown picker is sufficient.
- Use **MkDocs with one shared `!ENV DOCS_DIR` config** when the goal is a real browser-side whole-project documentation tree.
- Do not choose `markdown-preview.nvim` on the mistaken premise that it is archived—it is not—but its older backend/install path makes it a weaker new default than the pure-Lua option.
