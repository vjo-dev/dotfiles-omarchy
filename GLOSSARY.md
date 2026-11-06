# Dotfiles — Neovim agentic retrofit

Vocabulary for the project of rebuilding the Neovim config around an LLM/agent-driven
workflow (spec-first, review-centric), while keeping it a first-class Omarchy citizen.

## Language

**Spec**:
The plain-English description of the Neovim setup — what each piece does and why, never how.
Lives at `nvim/SPEC.md`; agents implement from it, humans review against it.
_Avoid_: README, docs, notes

**v1**:
The kickstart-derived, lazy.nvim-managed Neovim config that preceded the rebuild;
retired at cutover and kept as a runnable backup (`NVIM_APPNAME=nvim-v1`).
_Avoid_: old config, legacy config

**v2**:
The agentic-workflow rebuild of the Neovim config; the live `~/.config/nvim` since
the cutover.
_Avoid_: new config, rewrite

**Theme bridge**:
The machinery that keeps Neovim's colorscheme in sync with the active Omarchy theme,
including live switching without restart.
_Avoid_: theme hack, theme plugin

**Remote clipboard provider**:
The Neovim clipboard transport that makes yanks reach other machines and clients
(tmux, SSH, herdr) while preferring the local Wayland clipboard for pastes.
_Avoid_: OSC52 hack, clipboard fix

**Keybindings book**:
Omarchy's searchable keybindings menu opened with Super+K; extra books exist per tool
(tmux, herdr, neovim) following the same pattern.
_Avoid_: keymaps window, cheatsheet menu

**Workflow**:
A named sequence of steps describing a recurring editor task (e.g. reviewing agent
changes), defined as data in the Neovim config.
_Avoid_: tutorial, runbook, macro

**Workflow player**:
The in-editor float that walks a workflow step by step and can execute each runnable
step; run-and-resume: executing a step closes the player and re-opening resumes.
_Avoid_: cheatsheet window, tutor

**Wart**:
A verified spot where the v1 code contradicts its own intent (broken, redundant, dead,
or inconsistent). Numbered in the spec's §9; the unit of the "challenge & cut" phase.
_Avoid_: bug (warts include non-bugs), issue
