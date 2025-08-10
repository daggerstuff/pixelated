#!/usr/bin/env bash
set -euo pipefail

echo "🔧 Ensuring VS Code uses zsh with proper integration..."

if ! command -v zsh >/dev/null 2>&1; then
    echo "❌ zsh not installed; please install zsh first" >&2
    exit 1
fi

# Don't change the user's default shell automatically; just inform
echo "ℹ️  Current SHELL: ${SHELL:-unknown} (not changing it)"

zrc="$HOME/.zshrc"
if [[ -f "$zrc" ]]; then
    cp -f "$zrc" "${zrc}.bak.$(date +%s)"

    # Quiet noisy integrations expecting Q_LOG_LEVEL
    if ! grep -q "^: \${Q_LOG_LEVEL" "$zrc"; then
        printf '\n# Quiet missing Q_LOG_LEVEL for other shell integrations\n: \${Q_LOG_LEVEL:=}\n' >>"$zrc"
    fi

    # Replace brittle code --locate usage with env-first approach
    if grep -q "locate-shell-integration-path zsh" "$zrc"; then
        sed -i -E 's/^(.*code --locate-shell-integration-path zsh.*)$/# \1/' "$zrc"
    fi

    if ! grep -q "VSCODE_SHELL_INTEGRATION.*source" "$zrc"; then
        cat >>"$zrc" <<'ZRC_BLOCK'

# VS Code shell integration (env var first, fallback to code --locate)
if [[ -n "$VSCODE_SHELL_INTEGRATION" && -f "$VSCODE_SHELL_INTEGRATION" ]]; then
    source "$VSCODE_SHELL_INTEGRATION"
elif command -v code >/dev/null 2>&1; then
    __vsc_integ_path="$(code --locate-shell-integration-path zsh 2>/dev/null)"
    [[ -n "$__vsc_integ_path" && -f "$__vsc_integ_path" ]] && source "$__vsc_integ_path"
fi
ZRC_BLOCK
    fi

    echo "✅ Updated ~/.zshrc (backup saved)"
else
    echo "ℹ️  ~/.zshrc not found; skipping edits"
fi

echo "➡️  Close this terminal and open a new one to apply changes."
