#!/bin/bash

# --- For TypeScript, JSON, YAML, HTML, CSS, Bash, Docker ---
# These are all installed via npm (Node.js package manager)
echo "Installing Node.js-based LSPs..."
pnpm install -g \
  typescript-language-server \
  typescript \
  vscode-langservers-extracted \
  bash-language-server \
  dockerfile-language-server-nodejs

# --- For Python ---
# Installs the Ruff LSP via pip
echo "Installing Python LSP..."
uv pip install ruff-lsp

# --- For Go, Nix ---
# These are best installed via Homebrew on macOS or Linux
# If you don't have Homebrew, you can install them with:
# go install golang.org/x/tools/gopls@latest
# and from your native Nix package manager.
echo "Installing Go and Nix LSPs..."
brew install gopls
brew install nil

echo "All LSP installations attempted."
