local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not (vim.uv or vim.loop).fs_stat(lazypath) then
  local lazyrepo = "https://github.com/folke/lazy.nvim.git"
  local out = vim.fn.system({ "git", "clone", "--filter=blob:none", "--branch=stable", lazyrepo, lazypath })
  if vim.v.shell_error ~= 0 then
    vim.api.nvim_echo({
      { "Failed to clone lazy.nvim:\n", "ErrorMsg" },
      { out, "WarningMsg" },
      { "\nPress any key to exit..." },
    }, true, {})
    vim.fn.getchar()
    os.exit(1)
  end
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  spec = {
    -- import your plugins (includes the Omarchy-managed theme.lua symlink)
    { import = "plugins" },
    -- Omarchy's generated theme.lua references "LazyVim/LazyVim" to carry
    -- opts.colorscheme; this virtual stub absorbs that spec so lazy.nvim
    -- never installs LazyVim.
    { "LazyVim/LazyVim", virtual = true, config = function() end },
  },
  install = { colorscheme = { "tokyonight", "habamax" } },
  checker = {
    enabled = true, -- check for plugin updates periodically
    notify = false, -- notify on update
  },
  performance = {
    rtp = {
      -- disable some rtp plugins
      disabled_plugins = {
        "gzip",
        -- "matchit",
        -- "matchparen",
        -- "netrwPlugin",
        "tarPlugin",
        "tohtml",
        "tutor",
        "zipPlugin",
      },
    },
  },
})

-- Apply the Omarchy theme colorscheme (previously done by LazyVim via
-- opts.colorscheme in the generated theme spec).
local ok, theme = pcall(require, "plugins.theme")
if ok then
  for _, spec in ipairs(theme) do
    if spec[1] == "LazyVim/LazyVim" and spec.opts and spec.opts.colorscheme then
      pcall(vim.cmd.colorscheme, spec.opts.colorscheme)
      break
    end
  end
end
