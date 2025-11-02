#!/bin/bash
# Memory-optimized build script for Pixelated Empathy
# This script implements progressive memory management and build optimization

set -euo pipefail

# Memory configuration
MEMORY_THRESHOLD="6144"  # 6GB threshold
MEMORY_SAFE="4096"       # 4GB safe mode
MEMORY_CRITICAL="2048"   # 2GB critical mode

# Build optimization flags
NODE_FLAGS_OPTIMIZED="--max-old-space-size=${MEMORY_THRESHOLD}"
NODE_FLAGS_SAFE="--max-old-space-size=${MEMORY_SAFE}"
NODE_FLAGS_CRITICAL="--max-old-space-size=${MEMORY_CRITICAL}"

# Function to detect available memory
detect_memory() {
    local available_memory
    if command -v free >/dev/null 2>&1; then
        available_memory=$(free -m | awk '/^Mem:/{print $7}')
    elif [ -f /proc/meminfo ]; then
        available_memory=$(awk '/MemAvailable:/ {print int($2/1024)}' /proc/meminfo)
    else
        available_memory="4096"  # Default to 4GB if detection fails
    fi
    echo "${available_memory}"
}

# Function to select appropriate memory flags
select_memory_flags() {
    local available_memory="$1"
    
    if [ "${available_memory}" -ge "${MEMORY_THRESHOLD}" ]; then
        echo "${NODE_FLAGS_OPTIMIZED}"
    elif [ "${available_memory}" -ge "${MEMORY_SAFE}" ]; then
        echo "${NODE_FLAGS_SAFE}"
    else
        echo "${NODE_FLAGS_CRITICAL}"
    fi
}

# Function to monitor memory usage during build
monitor_memory_usage() {
    local pid="$1"
    local max_memory=0
    
    while kill -0 "${pid}" 2>/dev/null; do
        if [ -f "/proc/${pid}/status" ]; then
            current_memory=$(awk '/VmRSS:/ {print $2}' "/proc/${pid}/status" 2>/dev/null || echo "0")
            if [ "${current_memory}" -gt "${max_memory}" ]; then
                max_memory="${current_memory}"
            fi
        fi
        sleep 5
    done
    
    echo "Max memory usage: ${max_memory} KB"
}

# Function to build with memory optimization
build_with_memory_optimization() {
    echo "🔍 Detecting available system memory..."
    local available_memory
    available_memory=$(detect_memory)
    echo "📊 Available memory: ${available_memory} MB"
    
    local node_flags
    node_flags=$(select_memory_flags "${available_memory}")
    echo "🚀 Using Node.js flags: ${node_flags}"
    
    # Set memory flags
    export NODE_OPTIONS="${node_flags}"
    
    echo "🏗️ Starting optimized build process..."
    
    # Start build in background and monitor memory
    local build_pid
    (
        pnpm build
    ) &
    build_pid=$!
    
    # Monitor memory usage
    monitor_memory_usage "${build_pid}"
    
    # Wait for build to complete
    if wait "${build_pid}"; then
        echo "✅ Build completed successfully"
        return 0
    else
        echo "❌ Build failed"
        return 1
    fi
}

# Function to cleanup memory-intensive processes
cleanup_memory() {
    echo "🧹 Cleaning up memory-intensive processes..."
    
    # Clear Node.js cache
    if command -v pnpm >/dev/null 2>&1; then
        pnpm store prune || true
    fi
    
    # Clear system caches (skip if not running as root)
    if [ "$(id -u)" -eq 0 ]; then
        sync
        echo 3 > /proc/sys/vm/drop_caches 2>/dev/null
    fi
    
    echo "✅ Memory cleanup completed"
}

# Main execution
main() {
    echo "🚀 Starting memory-optimized build for Pixelated Empathy"

    # Pre-build cleanup
    cleanup_memory

    # Install dependencies before build
    echo "📦 Installing dependencies..."
    if pnpm install --frozen-lockfile --prefer-offline; then
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        exit 1
    fi

    # Build with memory optimization
    if build_with_memory_optimization; then
        echo "✅ Memory-optimized build completed successfully"
        exit 0
    else
        echo "❌ Memory-optimized build failed"
        exit 1
    fi
}

# Run main function
main "$@"