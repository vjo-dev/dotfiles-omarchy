# Dotfiles

Declarative-ish, idempotent dotfile deployment built on [GNU Stow](https://www.gnu.org/software/stow/).

Each tool is:
- a **stow package** — a directory at the repo root mirroring `$HOME`
  (e.g. `ghostty/.config/ghostty/config` → `~/.config/ghostty/config`), and
- an **install script** — `scripts/install-<tool>.sh` that installs the tool
  via the package manager, configures it (optional), then stows the package.

Shared helpers live in `scripts/lib.sh`.

## Installation

```sh
git clone <this repo> ~/dotfiles
cd ~/dotfiles
./deploy.sh
```

This dotfiles is dedicated to Omarchy, therefore required packages manager `yay` and `pacman` considered already installed. `stow` is installed on demand by `deploy.sh`.

`./deploy.sh` installs `stow` if missing (bootstrap), then runs each install
script it lists. Each install script runs as a separate process: if one tool
fails, the others still deploy, and a summary of failures is printed at the
end (exit code 1).

If stow finds a real (non-symlink) file or directory in the way (e.g. an
existing `~/.config/ghostty`), the tool is reported as failed with stow's
output: move or delete the conflicting path manually, then re-run.
Re-running it is idempotent: already-installed tools are skipped and
`stow --restow` only re-links what drifted.

Install scripts can also be run independently, e.g. `./scripts/install-ghostty.sh`.
The list of tools is currently:
    - `shell`
    - `ghostty`
    - `git`
    - `nvim`
    - `hypr`

Some packages only manage a single file inside a directory otherwise owned by
the system or another tool (e.g. `hypr/.config/hypr/bindings.lua` alongside
omarchy-managed files like `hyprland.lua`). These use `stow_pkg <pkg>
--no-folding` so stow keeps the target a real directory and only symlinks the
file(s) present in the package, instead of folding the whole directory into
a single symlink. If the target file already exists as a real file (not a
symlink), stow will refuse to link it: either delete it manually, or run
`stow --adopt --no-folding --restow <pkg>` once from the repo root to pull
the existing file into the repo (then check `git diff` before committing,
in case it drifted from the repo's version).

## Adding a new tool

1. Create the stow package, e.g. `kitty/.config/kitty/kitty.conf`:

```sh
mv ~/.config/kitty ~/dotfiles/kitty/.config
```

   or create it manually:

```sh
mkdir -p ~/dotfiles/kitty/.config/kitty
nvim ~/dotfiles/kitty/.config/kitty/kitty.conf
```

2. Copy the template `scripts/install-example.sh` to `scripts/install-kitty.sh`,
   replace `example` with `kitty`, and `chmod +x` it.

3. Add `kitty` to the tool list in `deploy.sh` and run `./deploy.sh`.

The helpers available in a tool script are:

| Helper | Purpose |
| --- | --- |
| `ensure_pkg <pkg>` | Install via `yay` unless already present |
| `stow_pkg <pkg>` | `stow --restow` the package |
| `say` / `die` | Messaging and guards |
