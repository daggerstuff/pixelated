#!/usr/bin/env bash

# Unified VS Code Shell Integration Fix Script (bash + zsh)
set -euo pipefail

echo "🔧 Applying VS Code shell integration fixes (bash + zsh)"

fix_zsh() {
	local zrc="$HOME/.zshrc"
	if [[ ! -f "$zrc" ]]; then
		echo "ℹ️  ~/.zshrc not found; skipping zsh"
		return 0
	fi

	cp -f "$zrc" "${zrc}.bak.$(date +%s)"

	# Ensure Q_LOG_LEVEL default to avoid noisy precmd errors from other integrations (e.g., fig/amazon q)
	if ! grep -q "^: \${Q_LOG_LEVEL" "$zrc"; then
		printf '\n# Quiet missing Q_LOG_LEVEL for other shell integrations\n: \${Q_LOG_LEVEL:=}\n' >>"$zrc"
	fi

	# Replace brittle code --locate usage with env-first approach, keeping a guarded fallback
	if grep -q "locate-shell-integration-path zsh" "$zrc"; then
		# Comment old line(s) to avoid duplication
		sed -i -E 's/^(.*code --locate-shell-integration-path zsh.*)$/# \1/' "$zrc"
	fi

	# Idempotently add VS Code integration block after oh-my-zsh sourcing
	if ! grep -q "VSCODE_SHELL_INTEGRATION.*source" "$zrc"; then
		awk '
			BEGIN { added=0 }
			{
				print $0
				if (!added && $0 ~ /^source[[:space:]]+\$ZSH\/oh-my-zsh\.sh/) {
					print "\n# VS Code shell integration (env var first, fallback to code --locate)"
					print "if [[ -n \"$VSCODE_SHELL_INTEGRATION\" && -f \"$VSCODE_SHELL_INTEGRATION\" ]]; then"
					print "  source \"$VSCODE_SHELL_INTEGRATION\""
					print "elif command -v code >/dev/null 2>&1; then"
					print "  __vsc_integ_path=\"$(code --locate-shell-integration-path zsh 2>/dev/null)\""
					print "  [[ -n \"$__vsc_integ_path\" && -f \"$__vsc_integ_path\" ]] && source \"$__vsc_integ_path\""
					print "fi\n"
					added=1
				}
			}
			END { if (!added) {
				print "\n# VS Code shell integration (env var first, fallback to code --locate)"
				print "if [[ -n \"$VSCODE_SHELL_INTEGRATION\" && -f \"$VSCODE_SHELL_INTEGRATION\" ]]; then"
				print "  source \"$VSCODE_SHELL_INTEGRATION\""
				print "elif command -v code >/dev/null 2>&1; then"
				print "  __vsc_integ_path=\"$(code --locate-shell-integration-path zsh 2>/dev/null)\""
				print "  [[ -n \"$__vsc_integ_path\" && -f \"$__vsc_integ_path\" ]] && source \"$__vsc_integ_path\""
				print "fi\n"
			}}' "$zrc" >"$zrc.tmp" && mv "$zrc.tmp" "$zrc"
	fi

	echo "✅ zsh integration block ensured in ~/.zshrc (backup saved)"
}

fix_bash() {
	local brc="$HOME/.bashrc"
	if [[ ! -f "$brc" ]]; then
		echo "ℹ️  ~/.bashrc not found; skipping bash"
		return 0
	fi
	cp -f "$brc" "${brc}.bak.$(date +%s)"
	if ! grep -q "VSCODE_SHELL_INTEGRATION" "$brc"; then
		cat >>"$brc" <<'BASH_INTEGRATION'

# VS Code shell integration (env var first, fallback to code --locate)
if [[ -n "$VSCODE_SHELL_INTEGRATION" && -f "$VSCODE_SHELL_INTEGRATION" ]]; then
	source "$VSCODE_SHELL_INTEGRATION"
elif command -v code >/dev/null 2>&1; then
	__vsc_integ_path="$(code --locate-shell-integration-path bash 2>/dev/null)"
	[[ -n "$__vsc_integ_path" && -f "$__vsc_integ_path" ]] && source "$__vsc_integ_path"
fi
BASH_INTEGRATION
	fi
	echo "✅ bash integration block ensured in ~/.bashrc (backup saved)"
}

fix_zsh
fix_bash

echo "\n🧪 Quick verification (current shell):"
echo "SHELL=$SHELL"
if [[ -n "${ZSH_VERSION-}" ]]; then
	set +e
	echo "precmd_functions: $(print -rl -- $precmd_functions | tr '\n' ' ')"
	echo "preexec_functions: $(print -rl -- $preexec_functions | tr '\n' ' ')"
	set -e
fi
echo "\n➡️  Please: Close terminal and open a new one to activate changes."

exit 0
