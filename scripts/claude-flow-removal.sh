#!/bin/bash

# ============================================================
# SURGICAL CLAUDE FLOW REMOVAL SCRIPT v4.0
# ============================================================
# Complete removal of Claude Flow ecosystem components
# Supports: claude-flow, ruv-swarm, flow-nexus
# Features: yarn/pnpm support, database cleanup, PATH cleaning
# ============================================================

set -euo pipefail  # Strict error handling

# ============================================================
# CONFIGURATION
# ============================================================

VERSION="4.0"
DRY_RUN="${DRY_RUN:-false}"
VERBOSE="${VERBOSE:-false}"
FORCE="${FORCE:-false}"

# Package names to remove
PACKAGES=("claude-flow" "ruv-swarm" "flow-nexus")
PACKAGE_PATTERN="claude-flow|ruv-swarm|flow-nexus"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# Statistics
STATS_REMOVED=0
STATS_BACKUPS=0
STATS_ERRORS=0

# ============================================================
# UTILITY FUNCTIONS
# ============================================================

# Logging functions
log_info() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1" >&2; }
log_error() { echo -e "${RED}✗${NC} $1" >&2; ((STATS_ERRORS++)) || true; }
log_debug() { [[ "$VERBOSE" == "true" ]] && echo -e "${BLUE}[DEBUG]${NC} $1" >&2 || true; }
log_step() { echo -e "\n${CYAN}${BOLD}Step $1:${NC} ${2}"; }

# Detect OS
detect_os() {
    case "$(uname -s)" in
        Linux*)  echo "Linux";;
        Darwin*) echo "Mac";;
        *)       echo "UNKNOWN";;
    esac
}

OS=$(detect_os)

# Safe path expansion (avoids eval)
expand_path() {
    local path="$1"
    # Replace ~ with HOME
    path="${path/#\~/$HOME}"
    # Replace relative paths
    if [[ "$path" != /* ]]; then
        path="$(pwd)/$path"
    fi
    echo "$path"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Backup file with timestamp
backup_file() {
    local file="$1"
    [[ "$file" != /* ]] && file="$(expand_path "$file")"
    
    if [[ ! -f "$file" ]]; then
        log_debug "File does not exist: $file"
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would backup: $file"
        return 0
    fi
    
    local backup="${file}.backup.$(date +%Y%m%d_%H%M%S)"
    if cp "$file" "$backup" 2>/dev/null; then
        log_info "Backed up: $(basename "$file") → $(basename "$backup")"
        ((STATS_BACKUPS++)) || true
        return 0
    else
        log_error "Failed to backup: $file"
        return 1
    fi
}

# Remove lines containing patterns (cross-platform sed)
remove_lines() {
    local file="$1"
    shift
    local patterns=("$@")
    
    [[ "$file" != /* ]] && file="$(expand_path "$file")"
    
    if [[ ! -f "$file" ]]; then
        log_debug "File does not exist: $file"
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would remove patterns from: $file"
        return 0
    fi
    
    backup_file "$file" || true
    
    local sed_args=()
    if [[ "$OS" == "Mac" ]]; then
        sed_args=("-i" "")
    else
        sed_args=("-i")
    fi
    
    for pattern in "${patterns[@]}"; do
        sed "${sed_args[@]}" "/${pattern}/d" "$file" 2>/dev/null || {
            log_warn "Failed to remove pattern '$pattern' from $file"
        }
    done
    
    ((STATS_REMOVED++)) || true
}

# Safe directory removal
safe_remove_dir() {
    local dir="$1"
    dir="$(expand_path "$dir")"
    
    if [[ ! -d "$dir" ]]; then
        log_debug "Directory does not exist: $dir"
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would remove directory: $dir"
        return 0
    fi
    
    if rm -rf "$dir" 2>/dev/null; then
        log_info "Removed directory: $dir"
        ((STATS_REMOVED++)) || true
        return 0
    else
        log_error "Failed to remove directory: $dir"
        return 1
    fi
}

# Safe file removal
safe_remove_file() {
    local file="$1"
    file="$(expand_path "$file")"
    
    if [[ ! -f "$file" && ! -L "$file" ]]; then
        log_debug "File does not exist: $file"
        return 0
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would remove file: $file"
        return 0
    fi
    
    if rm -f "$file" 2>/dev/null; then
        log_info "Removed file: $file"
        ((STATS_REMOVED++)) || true
        return 0
    else
        log_error "Failed to remove file: $file"
        return 1
    fi
}

# ============================================================
# REMOVAL FUNCTIONS
# ============================================================

# Kill processes
kill_processes() {
    log_step "1" "Killing Claude Flow/Swarm/Nexus processes..."
    
    local pids
    if command_exists pgrep; then
        pids=$(pgrep -f "$PACKAGE_PATTERN" 2>/dev/null || true)
    else
        pids=$(ps aux | grep -E "$PACKAGE_PATTERN" | grep -v grep | awk '{print $2}' || true)
    fi
    
    if [[ -z "$pids" ]]; then
        log_info "No processes found"
        return 0
    fi
    
    local count=0
    while IFS= read -r pid; do
        [[ -z "$pid" ]] && continue
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "[DRY RUN] Would kill process: $pid"
        else
            if kill -9 "$pid" 2>/dev/null; then
                log_debug "Killed process: $pid"
                ((count++)) || true
            else
                log_warn "Failed to kill process: $pid (may not exist)"
            fi
        fi
    done <<< "$pids"
    
    if [[ "$DRY_RUN" != "true" && $count -gt 0 ]]; then
        log_info "Killed $count process(es)"
    fi
}

# Remove packages from package manager
remove_packages_from_pm() {
    local pm="$1"
    local cmd="$2"
    local uninstall_cmd="$3"
    
    if ! command_exists "$cmd"; then
        log_debug "$pm not installed"
        return 0
    fi
    
    log_debug "Removing packages via $pm..."
    
    local removed=0
    for package in "${PACKAGES[@]}"; do
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "[DRY RUN] Would uninstall: $package (via $pm)"
        else
            if eval "$uninstall_cmd" "$package" >/dev/null 2>&1; then
                log_debug "Removed $package via $pm"
                ((removed++)) || true
            fi
        fi
    done
    
    if [[ $removed -gt 0 || "$DRY_RUN" == "true" ]]; then
        log_info "$pm packages removed"
    fi
}

# Clean package manager caches
clean_pm_cache() {
    log_step "2" "Removing Claude Flow packages and cleaning caches..."
    
    # NPM
    remove_packages_from_pm "NPM" "npm" "npm uninstall -g"
    
    # Yarn
    remove_packages_from_pm "Yarn" "yarn" "yarn global remove"
    
    # PNPM
    remove_packages_from_pm "PNPM" "pnpm" "pnpm uninstall -g"
    
    # Clean NPX cache
    if [[ "$DRY_RUN" != "true" ]]; then
        find "$HOME/.npm/_npx" -maxdepth 1 -type d -name "*claude-flow*" -o -name "*ruv-swarm*" -o -name "*flow-nexus*" 2>/dev/null | while read -r dir; do
            safe_remove_dir "$dir"
        done
        
        find "$HOME/.npm/_cacache" -maxdepth 1 -type d -name "*claude-flow*" -o -name "*ruv-swarm*" -o -name "*flow-nexus*" 2>/dev/null | while read -r dir; do
            safe_remove_dir "$dir"
        done
    fi
    
    # Clean npm cache
    if command_exists npm && [[ "$DRY_RUN" != "true" ]]; then
        local npm_cache
        npm_cache=$(npm config get cache 2>/dev/null || echo "")
        if [[ -n "$npm_cache" && -d "$npm_cache" ]]; then
            find "$npm_cache" -type d -name "*claude-flow*" -o -name "*ruv-swarm*" -o -name "*flow-nexus*" 2>/dev/null | while read -r dir; do
                safe_remove_dir "$dir"
            done
        fi
    fi
    
    # Clean yarn cache
    if command_exists yarn && [[ "$DRY_RUN" != "true" ]]; then
        local yarn_cache
        yarn_cache=$(yarn cache dir 2>/dev/null || echo "")
        if [[ -n "$yarn_cache" && -d "$yarn_cache" ]]; then
            find "$yarn_cache" -type d -name "*claude-flow*" -o -name "*ruv-swarm*" -o -name "*flow-nexus*" 2>/dev/null | while read -r dir; do
                safe_remove_dir "$dir"
            done
        fi
    fi
    
    # Clean pnpm store
    if command_exists pnpm && [[ "$DRY_RUN" != "true" ]]; then
        local pnpm_store
        pnpm_store=$(pnpm store path 2>/dev/null || echo "")
        if [[ -n "$pnpm_store" && -d "$pnpm_store" ]]; then
            find "$pnpm_store" -type d -name "*claude-flow*" -o -name "*ruv-swarm*" -o -name "*flow-nexus*" 2>/dev/null | while read -r dir; do
                safe_remove_dir "$dir"
            done
        fi
    fi
    
    # Remove global node_modules
    if command_exists npm && [[ "$DRY_RUN" != "true" ]]; then
        local npm_prefix
        npm_prefix=$(npm config get prefix 2>/dev/null || echo "")
        if [[ -n "$npm_prefix" ]]; then
            local global_modules="${npm_prefix}/lib/node_modules"
            local global_bin="${npm_prefix}/bin"
            
            for package in "${PACKAGES[@]}"; do
                safe_remove_dir "${global_modules}/${package}"
                safe_remove_file "${global_bin}/${package}"
            done
        fi
    fi
    
    log_info "Package manager cleanup complete"
}

# Remove directories
remove_directories() {
    log_step "3" "Removing Claude Flow directories..."
    
    local dirs=(
        ".swarm"
        ".claude-flow"
        ".hive-mind"
        ".claude"
        "$HOME/.swarm"
        "$HOME/.claude-flow"
        "$HOME/.hive-mind"
        "/tmp/.swarm"
        "/tmp/.claude-flow"
        "/tmp/.hive-mind"
        "$HOME/.config/claude-flow"
        "$HOME/.config/ruv-swarm"
        "$HOME/.config/flow-nexus"
        "$HOME/.local/share/claude-flow"
        "$HOME/.local/share/ruv-swarm"
        "$HOME/.local/share/flow-nexus"
    )
    
    # Add macOS-specific paths
    if [[ "$OS" == "Mac" ]]; then
        dirs+=(
            "$HOME/Library/Application Support/claude-flow"
            "$HOME/Library/Application Support/ruv-swarm"
            "$HOME/Library/Application Support/flow-nexus"
            "$HOME/Library/Caches/claude-flow"
            "$HOME/Library/Caches/ruv-swarm"
            "$HOME/Library/Caches/flow-nexus"
        )
    fi
    
    for dir in "${dirs[@]}"; do
        safe_remove_dir "$dir"
    done
    
    # Remove database files
    log_debug "Removing database files..."
    local db_files=(
        ".swarm/memory.db"
        ".hive-mind/hive.db"
        "$HOME/.swarm/memory.db"
        "$HOME/.hive-mind/hive.db"
        ".claude-flow/token-usage.json"
        "$HOME/.claude-flow/token-usage.json"
    )
    
    for db_file in "${db_files[@]}"; do
        safe_remove_file "$db_file"
    done
}

# Clean Claude Code settings
clean_claude_settings() {
    log_step "4" "Surgically cleaning Claude Code settings..."
    
    local claude_settings="$HOME/.claude/settings.json"
    
    if [[ ! -f "$claude_settings" ]]; then
        log_warn "Claude Code settings not found"
        return 0
    fi
    
    if ! grep -qE "$PACKAGE_PATTERN|CLAUDE_FLOW_" "$claude_settings" 2>/dev/null; then
        log_info "No Claude Flow references found in settings"
        return 0
    fi
    
    backup_file "$claude_settings" || true
    
    if command_exists jq; then
        log_debug "Using jq for surgical removal..."
        
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "[DRY RUN] Would clean settings with jq"
            return 0
        fi
        
        # Use jq to surgically remove Claude Flow items
        local tmp_file="${claude_settings}.tmp"
        if jq '
            # Remove CLAUDE_FLOW_ environment variables
            if .env then
              .env |= with_entries(select(.key | startswith("CLAUDE_FLOW_") | not))
            else . end |
            
            # Remove packages from MCP servers
            if .enabledMcpjsonServers then
              .enabledMcpjsonServers |= map(select(. != "claude-flow" and . != "ruv-swarm" and . != "flow-nexus"))
            else . end |
            
            # Remove hooks containing claude-flow
            if .hooks then
              (.hooks | to_entries | map({
                key: .key,
                value: (.value | map(
                  if .hooks then
                    .hooks |= map(select(.command // "" | contains("claude-flow") or contains("ruv-swarm") or contains("flow-nexus") | not))
                  else . end |
                  select(.hooks and (.hooks | length > 0) or (.hooks | not))
                ))
              })) | from_entries
            else . end
        ' "$claude_settings" > "$tmp_file" 2>/dev/null; then
            mv "$tmp_file" "$claude_settings"
            log_info "Cleaned Claude Code settings with jq"
        else
            log_warn "jq failed, falling back to sed"
            rm -f "$tmp_file"
            remove_lines "$claude_settings" "$PACKAGE_PATTERN" "CLAUDE_FLOW_"
        fi
    else
        log_debug "Using sed for removal (jq not available)"
        remove_lines "$claude_settings" "$PACKAGE_PATTERN" "CLAUDE_FLOW_"
    fi
}

# Clean package.json
clean_package_json() {
    log_step "5" "Checking project package.json..."
    
    if [[ ! -f "package.json" ]]; then
        log_debug "package.json not found in current directory"
        return 0
    fi
    
    if grep -qE "$PACKAGE_PATTERN" "package.json" 2>/dev/null; then
        remove_lines "package.json" "$PACKAGE_PATTERN"
        log_info "Removed Claude Flow from package.json"
    else
        log_info "No Claude Flow found in package.json"
    fi
}

# Clean Claude Desktop config
clean_claude_desktop_config() {
    log_step "6" "Cleaning Claude Desktop config..."
    
    local claude_config
    if [[ "$OS" == "Mac" ]]; then
        claude_config="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
    else
        claude_config="$HOME/.config/Claude/claude_desktop_config.json"
    fi
    
    if [[ ! -f "$claude_config" ]]; then
        log_warn "Claude Desktop config not found"
        return 0
    fi
    
    if ! grep -qE "$PACKAGE_PATTERN" "$claude_config" 2>/dev/null; then
        log_info "No Claude Flow found in Claude Desktop config"
        return 0
    fi
    
    backup_file "$claude_config" || true
    
    if command_exists jq && [[ "$DRY_RUN" != "true" ]]; then
        local tmp_file="${claude_config}.tmp"
        if jq "del(.mcpServers.\"claude-flow\") | del(.mcpServers.\"ruv-swarm\") | del(.mcpServers.\"flow-nexus\")" "$claude_config" > "$tmp_file" 2>/dev/null; then
            mv "$tmp_file" "$claude_config"
            log_info "Removed Claude Flow from Claude Desktop config"
        else
            log_warn "jq failed, using sed fallback"
            remove_lines "$claude_config" "$PACKAGE_PATTERN"
        fi
    else
        if [[ "$DRY_RUN" == "true" ]]; then
            log_info "[DRY RUN] Would clean Claude Desktop config"
        else
            remove_lines "$claude_config" "$PACKAGE_PATTERN"
        fi
    fi
}

# Clean shell configs
clean_shell_configs() {
    log_step "7" "Cleaning shell configuration files..."
    
    local shell_files=(
        "$HOME/.bashrc"
        "$HOME/.zshrc"
        "$HOME/.profile"
        "$HOME/.bash_profile"
        "$HOME/.zprofile"
        "$HOME/.zshenv"
        "$HOME/.config/fish/config.fish"
    )
    
    for shell_file in "${shell_files[@]}"; do
        if [[ -f "$shell_file" ]]; then
            if grep -qE "$PACKAGE_PATTERN|CLAUDE_FLOW_" "$shell_file" 2>/dev/null; then
                remove_lines "$shell_file" "$PACKAGE_PATTERN" "CLAUDE_FLOW_"
                log_info "Cleaned: $(basename "$shell_file")"
            fi
        fi
    done
}

# Remove binaries from PATH
remove_path_binaries() {
    log_step "8" "Checking common PATH locations for binaries..."
    
    local path_locations=(
        "/usr/local/bin"
        "/usr/bin"
        "$HOME/.local/bin"
        "$HOME/bin"
    )
    
    for path_dir in "${path_locations[@]}"; do
        if [[ -d "$path_dir" ]]; then
            for package in "${PACKAGES[@]}"; do
                if [[ -f "$path_dir/$package" ]] || [[ -L "$path_dir/$package" ]]; then
                    safe_remove_file "$path_dir/$package"
                fi
            done
        fi
    done
    
    log_info "PATH locations checked"
}

# Clear environment variables
clear_env_vars() {
    log_step "9" "Clearing Claude Flow environment variables..."
    
    local env_vars=(
        "CLAUDE_FLOW_AUTO_COMMIT"
        "CLAUDE_FLOW_AUTO_PUSH"
        "CLAUDE_FLOW_HOOKS_ENABLED"
        "CLAUDE_FLOW_TELEMETRY_ENABLED"
        "CLAUDE_FLOW_REMOTE_EXECUTION"
        "CLAUDE_FLOW_CHECKPOINTS_ENABLED"
    )
    
    for var in "${env_vars[@]}"; do
        if [[ "$DRY_RUN" == "true" ]]; then
            log_debug "[DRY RUN] Would unset: $var"
        else
            unset "$var" 2>/dev/null || true
        fi
    done
    
    log_info "Environment variables cleared"
}

# Verification
verify_removal() {
    log_step "10" "Verification..."
    
    local issues=0
    
    # Check processes
    if pgrep -f "$PACKAGE_PATTERN" >/dev/null 2>&1 || ps aux | grep -E "$PACKAGE_PATTERN" | grep -v grep >/dev/null 2>&1; then
        log_warn "Processes still running!"
        ((issues++)) || true
    else
        log_info "No Claude Flow processes running"
    fi
    
    # Check packages
    local packages_found=0
    if command_exists npm && npm list -g 2>/dev/null | grep -qE "$PACKAGE_PATTERN"; then
        log_warn "NPM packages still installed!"
        ((packages_found++)) || true
    fi
    if command_exists yarn && yarn global list 2>/dev/null | grep -qE "$PACKAGE_PATTERN"; then
        log_warn "Yarn packages still installed!"
        ((packages_found++)) || true
    fi
    if command_exists pnpm && pnpm list -g 2>/dev/null | grep -qE "$PACKAGE_PATTERN"; then
        log_warn "PNPM packages still installed!"
        ((packages_found++)) || true
    fi
    if [[ $packages_found -eq 0 ]]; then
        log_info "All packages removed from package managers"
    else
        ((issues++)) || true
    fi
    
    # Check settings
    local claude_settings="$HOME/.claude/settings.json"
    if [[ -f "$claude_settings" ]] && grep -qE "$PACKAGE_PATTERN" "$claude_settings" 2>/dev/null; then
        log_warn "Some Claude Flow references may remain in settings"
        log_debug "Check: $claude_settings"
        ((issues++)) || true
    else
        log_info "Settings cleaned"
    fi
    
    if [[ $issues -eq 0 ]]; then
        log_info "Verification passed - all cleanup completed successfully"
        return 0
    else
        log_warn "Verification found $issues issue(s) - review above warnings"
        return 1
    fi
}

# ============================================================
# MAIN EXECUTION
# ============================================================

main() {
    # Banner
    echo -e "${RED}╔════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║   SURGICAL CLAUDE FLOW REMOVAL SCRIPT      ║${NC}"
    echo -e "${RED}║              Version ${VERSION}                   ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Detected OS: ${OS}${NC}"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}${BOLD}DRY RUN MODE - No changes will be made${NC}"
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}Verbose mode enabled${NC}"
    fi
    
    echo -e "${YELLOW}This will surgically remove Claude Flow ecosystem!${NC}"
    echo ""
    
    if [[ "$DRY_RUN" != "true" && "$FORCE" != "true" ]]; then
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Aborted."
            exit 0
        fi
    fi
    
    # Execute removal steps
    kill_processes
    clean_pm_cache
    remove_directories
    clean_claude_settings
    clean_package_json
    clean_claude_desktop_config
    clean_shell_configs
    remove_path_binaries
    clear_env_vars
    verify_removal
    
    # Summary
    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}         SURGICAL CLEANUP COMPLETE!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════${NC}"
    echo ""
    
    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}This was a DRY RUN - no changes were made${NC}"
    else
        echo "✅ SAFELY removed:"
        echo "  • Claude Flow/Swarm/Nexus processes"
        echo "  • All ecosystem packages (${PACKAGES[*]})"
        echo "  • Project directories (.claude, .swarm, .hive-mind, .claude-flow)"
        echo "  • Database files (memory.db, hive.db, token-usage.json)"
        echo "  • Claude Flow hooks (preserving other hooks)"
        echo "  • Claude Flow environment variables"
        echo "  • All MCP server references"
        echo "  • Binaries from all PATH locations"
        echo "  • Cache from NPM/Yarn/PNPM package managers"
        echo ""
        echo "✅ PRESERVED:"
        echo "  • All other Claude Code hooks"
        echo "  • All other MCP servers"
        echo "  • All other environment variables"
        echo "  • All other packages"
        echo ""
        echo "📊 Statistics:"
        echo "  • Items removed: $STATS_REMOVED"
        echo "  • Files backed up: $STATS_BACKUPS"
        echo "  • Errors: $STATS_ERRORS"
    fi
    
    echo ""
    echo -e "${YELLOW}NEXT STEPS:${NC}"
    echo "1. Restart terminal"
    echo "2. Restart Claude Desktop (if applicable)"
    echo "3. Test Claude Code - hooks error should be gone!"
    echo ""
    
    if [[ $STATS_BACKUPS -gt 0 ]]; then
        echo -e "${CYAN}If you need to restore settings:${NC}"
        echo "All files were backed up with timestamps"
        echo "Look for files with .backup.* extension"
    fi
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --verbose|-v)
            VERBOSE="true"
            shift
            ;;
        --force|-f)
            FORCE="true"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --dry-run    Run without making changes"
            echo "  --verbose    Enable verbose output"
            echo "  --force      Skip confirmation prompt"
            echo "  --help       Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Interactive removal"
            echo "  $0 --dry-run          # Preview changes"
            echo "  $0 --force            # Skip confirmation"
            echo "  $0 --verbose --dry-run # Verbose dry run"
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Run main function
main "$@"