#!/bin/bash
set -euo pipefail

# Memory-Optimized Build Script
# Implements progressive memory optimization for Astro builds
# Used in CI/CD pipelines to prevent OOM errors during large builds

# Colors for output (optional, fallback to no color if not supported)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() { echo -e "${GREEN}[BUILD]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[BUILD WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[BUILD ERROR]${NC} $1"; }
log_debug() { echo -e "${BLUE}[BUILD DEBUG]${NC} $1"; }

# Configuration
# Progressive memory allocation: start with reasonable limit, increase if needed
INITIAL_MEMORY_MB="${BUILD_MEMORY_MB:-4096}"
MAX_MEMORY_MB="${BUILD_MAX_MEMORY_MB:-8192}"
MEMORY_STEP_MB=1024

# Detect available memory (fallback if unavailable)
detect_available_memory() {
  if command -v free >/dev/null 2>&1; then
    # Linux: get available memory in MB
    AVAILABLE_MB=$(free -m | awk '/^Mem:/{print $7}')
  elif command -v sysctl >/dev/null 2>&1; then
    # macOS: get free memory in MB
    AVAILABLE_MB=$(($(sysctl -n hw.memsize) / 1024 / 1024 - $(vm_stat | awk '/Pages active/ {print $3}' | sed 's/\.//') * 4096 / 1024 / 1024))
  else
    # Fallback: use configured initial memory
    AVAILABLE_MB="$INITIAL_MEMORY_MB"
  fi
  
  echo "$AVAILABLE_MB"
}

# Calculate optimal memory limit based on available system memory
calculate_memory_limit() {
  local available_mb="$1"
  local optimal_mb="$INITIAL_MEMORY_MB"
  
  # Use up to 50% of available memory, but not more than MAX_MEMORY_MB
  if [ "$available_mb" -gt 0 ]; then
    local system_limit=$((available_mb / 2))
    optimal_mb=$((system_limit > optimal_mb ? system_limit : optimal_mb))
    optimal_mb=$((optimal_mb > MAX_MEMORY_MB ? MAX_MEMORY_MB : optimal_mb))
  fi
  
  echo "$optimal_mb"
}

# Verify build prerequisites
verify_prerequisites() {
  log_info "Verifying build prerequisites..."
  
  # Check Node.js
  if ! command -v node >/dev/null 2>&1; then
    log_error "Node.js is not installed or not in PATH"
    exit 1
  fi
  
  local node_version=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$node_version" -lt 24 ]; then
    log_error "Node.js version 24+ is required. Found: $(node --version)"
    exit 1
  fi
  log_debug "Node.js version: $(node --version)"
  
  # Check pnpm
  if ! command -v pnpm >/dev/null 2>&1; then
    log_error "pnpm is not installed or not in PATH"
    exit 1
  fi
  log_debug "pnpm version: $(pnpm --version)"
  
  # Check package.json exists
  if [ ! -f "package.json" ]; then
    log_error "package.json not found. Are you in the project root?"
    exit 1
  fi
  
  # Check node_modules exists (dependencies should be installed before running this script)
  if [ ! -d "node_modules" ]; then
    log_warning "node_modules not found. Dependencies may not be installed."
    log_info "This script assumes dependencies are already installed (e.g., via 'pnpm install')"
  fi
  
  log_info "✅ Prerequisites verified"
}

# Clean build artifacts before starting
clean_build_artifacts() {
  log_info "Cleaning previous build artifacts..."
  
  if [ -d "dist" ]; then
    rm -rf dist
    log_debug "Removed dist directory"
  fi
  
  if [ -d ".astro" ]; then
    rm -rf .astro
    log_debug "Removed .astro cache directory"
  fi
  
  log_info "✅ Build artifacts cleaned"
}

# Run build with memory optimization
run_memory_optimized_build() {
  local memory_mb="$1"
  
  log_info "Starting build with memory limit: ${memory_mb}MB"
  
  # Set Node.js memory options
  export NODE_OPTIONS="--max-old-space-size=${memory_mb} --no-experimental-strip-types"
  
  log_debug "NODE_OPTIONS=${NODE_OPTIONS}"
  log_debug "Node.js memory: $(node -e "console.log(process.memoryUsage().heapTotal / 1024 / 1024 | 0)")MB initial"
  
  # Run the build
  if pnpm build; then
    log_info "✅ Build completed successfully"
    return 0
  else
    local exit_code=$?
    log_error "Build failed with exit code: $exit_code"
    
    # If build failed and we haven't hit max memory, try with more memory
    if [ "$memory_mb" -lt "$MAX_MEMORY_MB" ]; then
      local next_memory=$((memory_mb + MEMORY_STEP_MB))
      log_warning "Retrying build with increased memory: ${next_memory}MB"
      
      if run_memory_optimized_build "$next_memory"; then
        return 0
      fi
    fi
    
    return $exit_code
  fi
}

# Main execution
main() {
  log_info "🏗️  Building application with progressive memory optimization..."
  
  # Verify prerequisites
  verify_prerequisites
  
  # Detect and calculate optimal memory
  local available_mb=$(detect_available_memory)
  log_debug "Available system memory: ${available_mb}MB"
  
  local optimal_mb=$(calculate_memory_limit "$available_mb")
  log_info "Optimal memory limit: ${optimal_mb}MB (initial: ${INITIAL_MEMORY_MB}MB, max: ${MAX_MEMORY_MB}MB)"
  
  # Clean previous build artifacts
  clean_build_artifacts
  
  # Run build with memory optimization
  if run_memory_optimized_build "$optimal_mb"; then
    log_info "✅ Application build completed successfully"
    
    # Verify build output exists
    if [ -d "dist" ] && [ -n "$(ls -A dist 2>/dev/null)" ]; then
      log_info "Build output verified in dist/ directory"
      exit 0
    else
      log_error "Build completed but dist/ directory is empty or missing"
      exit 1
    fi
  else
    log_error "❌ Build failed after all retry attempts"
    exit 1
  fi
}

# Run main function
main "$@"

