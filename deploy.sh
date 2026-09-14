#!/usr/bin/env sh

echo -e "\nInstalling stow..."
yay -S --noconfirm --needed stow
echo "stow installed."

echo "Deploying my config..."
. ./scripts/install-ghostty.sh
. ./scripts/install-nvim.sh
