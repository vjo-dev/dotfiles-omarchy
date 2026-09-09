#!/usr/bin/env sh

echo -e "\nInstalling ghostty..."
yay -S --noconfirm --needed ghostty

echo "Setting omarchy by default..."
omarchy default terminal ghostty

echo "Stow my ghostty config file."
# rm -rf ~/.config/ghostty
stow ghostty

echo "ghostty installed."
