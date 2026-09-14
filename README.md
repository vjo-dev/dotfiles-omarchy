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

`./deploy.sh` installs `stow` (bootstrap), then runs each install script it lists.
Each install script runs as a separate process: if one tool fails, the others
still deploy, and a summary of skipped/failed tools is printed at the end
(exit code 1 only if something actually failed).

### Conflicts with existing config

If stow finds a real (non-symlink) file or directory in the way (e.g. an
existing `~/.config/ghostty`), the install script asks what to do:

- **[a] adopt** — move the existing files *into* the repo package
  (`stow --adopt`), then symlink them back. Your repo version is overwritten
  by the local files: review with `git diff` afterwards and commit or revert.
- **[b] backup** (default) — move the top-level conflicting directory to
  `<path>.bak-<timestamp>` (e.g. `~/.config/ghostty.bak-20250101-120000`),
  then stow the repo package.
- **[s] skip** — leave everything untouched and continue with the next tool.

Backups are done at the top-level unit (the whole `~/.config/<tool>`
directory, or the dotfile itself for loose files), never file by file.

When no terminal is available (CI, piped output), the mode set by
`CONFLICT_MODE` in `deploy.sh` is used; it defaults to `backup`.
Re-running it is idempotent: already-installed tools are skipped and
`stow --restow` only re-links what drifted.

Install scripts can also be run independently, e.g. `./scripts/install-ghostty.sh`.
The list of tools is currently `ghostty` and `nvim`.

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