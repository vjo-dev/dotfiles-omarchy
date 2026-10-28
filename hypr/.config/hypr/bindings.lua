-- Keep only your personal keybinding overrides here. Add new bindings or
-- unbind defaults before replacing them.

-- See current bindings and descriptions:
--   omarchy menu keybindings --print

-- To disable every Omarchy default binding, set this in
-- ~/.config/hypr/hyprland.lua before require("default.hypr.omarchy"), then add
-- only the bindings you want below:
--   omarchy_default_bindings = false

-- To disable all preinstalled app/webapp bindings, set:
--   omarchy_preinstalled_bindings = false

-- Add a new binding.
-- o.bind("SUPER + SHIFT + R", "SSH", "alacritty -e ssh your-server")

-- Change an existing binding by unbinding it first, then binding the key again.
-- This example changes SUPER+SPACE from the launcher to the Omarchy root menu.
-- hl.unbind("SUPER + SPACE")
-- o.bind("SUPER + SPACE", "Omarchy menu", "omarchy-menu toggle root")

-- Disable a default binding without replacing it.
-- hl.unbind("SUPER + SHIFT + B")

-- Logitech MX Keys examples:
-- o.bind("SUPER + SHIFT + S", nil, "omarchy-capture-screenshot")
-- o.bind("SUPER + H", nil, "voxtype record toggle")
-- o.bind("SUPER + PERIOD", nil, "omarchy-shell shell toggle omarchy.emojis")

-- Remap F-cluster / add quick launchers (2026-02 rotation):
--   SUPER+F:        Full screen      -> File manager
--   SUPER+SHIFT+F:  File manager     -> File manager @ ~/mnt/104145v
--   SUPER+ALT+F:    Full width       -> (unbound)
--   SUPER+Z:        (unbound)        -> Full width
--   SUPER+ALT+Z:    (unbound)        -> Full screen
--   SUPER+B:        (unbound)        -> Browser
-- Drop duplicate browser defaults (browser now lives on SUPER+B):
--   SUPER+SHIFT+B, SUPER+SHIFT+RETURN
hl.unbind("SUPER + F")          -- was: Full screen
hl.unbind("SUPER + SHIFT + F")  -- was: File manager
hl.unbind("SUPER + ALT + F")    -- was: Full width
hl.unbind("SUPER + SHIFT + B")      -- was: Browser (duplicate)
hl.unbind("SUPER + SHIFT + RETURN") -- was: Browser (duplicate)

local mnt_104145v = (os.getenv("HOME") or "") .. "/mnt/104145v"

o.bind("SUPER + F", "File manager", { omarchy = "nautilus" })
o.bind("SUPER + SHIFT + F", "File manager (104145v)", { launch = "nautilus --new-window " .. o.shell_quote(mnt_104145v) })
o.bind("SUPER + ALT + Z", "Full screen", hl.dsp.window.fullscreen({ mode = "fullscreen" }))
o.bind("SUPER + Z", "Full width", hl.dsp.window.fullscreen({ mode = "maximized" }))
o.bind("SUPER + B", "Browser", { omarchy = "browser" })

-- Agent Chat plugin (robson.agent-chat): fullscreen chat with the default
-- coding agent. Plain SUPER+A was unbound (Agent terminal is SUPER+SHIFT+CTRL+A).
o.bind("SUPER + A", "Agent chat", "omarchy-shell shell toggle robson.agent-chat")

-- Scroll Up / Down using ydotool.
-- Note: SUPER+ALT+UP/DOWN were bound to "move window to group on top/bottom".
-- Unbind SUPER+ALT+wheel (was: next/previous window in group — still available
-- via SUPER+ALT+TAB), otherwise Hyprland intercepts the injected wheel events
-- while SUPER+ALT are held and the scroll never reaches the app.
hl.unbind("SUPER + ALT + mouse_down")
hl.unbind("SUPER + ALT + mouse_up")
hl.unbind("SUPER + ALT + UP")
hl.unbind("SUPER + ALT + DOWN")

-- Absolute path: ydotool-scroll lives in ~/.local/bin, which is on an
-- interactive shell's PATH but not guaranteed to be on the one Hyprland hands
-- to keybind dispatchers. The wrapper turns a dead ydotoold into a
-- notification, since a failing exec bind fails silently.
local scroll_helper = (os.getenv("HOME") or "") .. "/.local/bin/ydotool-scroll"

-- Note: `repeating = true` arms Hyprland's key repeat, but it can never fire
-- for these binds: the injected wheel event itself reaches
-- CKeybindManager::onAxisEvent, which clears all active repeating binds
-- (verified in Hyprland 0.56.2 source). Hold-to-scroll is therefore not
-- achievable this way; compensate with a larger increment per press.
local scroll_step = 5

o.bind("SUPER + ALT + UP", "Scroll Up", o.shell_quote(scroll_helper) .. " 0 " .. scroll_step, { repeating = true })
o.bind("SUPER + ALT + DOWN", "Scroll Down", o.shell_quote(scroll_helper) .. " 0 -" .. scroll_step, { repeating = true })
