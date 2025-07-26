#!/usr/bin/env node

/**
 * Memory monitoring script for AWS builds
 * Logs memory usage and triggers garbage collection when needed
 */

const fs = require('fs')
const os = require('os')

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getMemoryInfo() {
  const memUsage = process.memoryUsage()
  const systemMem = {
    total: os.totalmem(),
    free: os.freemem(),
    used: os.totalmem() - os.freemem(),
  }

  return {
    process: {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
    },
    system: systemMem,
    timestamp: new Date().toISOString(),
  }
}

function logMemoryUsage() {
  const memInfo = getMemoryInfo()
  const heapUsedMB = memInfo.process.heapUsed / 1024 / 1024
  const systemUsedPercent = (memInfo.system.used / memInfo.system.total) * 100

  console.log(`[MEMORY] ${memInfo.timestamp}`)
  console.log(
    `[MEMORY] Process Heap: ${formatBytes(memInfo.process.heapUsed)} / ${formatBytes(memInfo.process.heapTotal)}`,
  )
  console.log(
    `[MEMORY] System: ${formatBytes(memInfo.system.used)} / ${formatBytes(memInfo.system.total)} (${systemUsedPercent.toFixed(1)}%)`,
  )

  // Trigger garbage collection if heap usage is high
  if (heapUsedMB > 3072) {
    // 3GB threshold
    console.log(
      `[MEMORY] ⚠️ High memory usage detected (${heapUsedMB.toFixed(0)}MB), triggering GC...`,
    )
    if (global.gc) {
      global.gc()
      const afterGC = getMemoryInfo()
      const afterGCMB = afterGC.process.heapUsed / 1024 / 1024
      console.log(
        `[MEMORY] ✅ GC completed. Heap: ${afterGCMB.toFixed(0)}MB (reduced by ${(heapUsedMB - afterGCMB).toFixed(0)}MB)`,
      )
    } else {
      console.log(
        `[MEMORY] ❌ GC not available, consider running with --expose-gc`,
      )
    }
  }

  // Log warning if system memory is very high
  if (systemUsedPercent > 85) {
    console.log(
      `[MEMORY] 🚨 Critical system memory usage: ${systemUsedPercent.toFixed(1)}%`,
    )
  } else if (systemUsedPercent > 75) {
    console.log(
      `[MEMORY] ⚠️ High system memory usage: ${systemUsedPercent.toFixed(1)}%`,
    )
  }

  return memInfo
}

function startMonitoring(intervalMs = 10000) {
  console.log(`[MEMORY] Starting memory monitoring (interval: ${intervalMs}ms)`)
  logMemoryUsage()

  const interval = setInterval(() => {
    logMemoryUsage()
  }, intervalMs)

  // Cleanup on exit
  process.on('SIGINT', () => {
    console.log(`[MEMORY] Stopping memory monitoring...`)
    clearInterval(interval)
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log(`[MEMORY] Stopping memory monitoring...`)
    clearInterval(interval)
    process.exit(0)
  })

  return interval
}

// If run directly
if (require.main === module) {
  const intervalMs = parseInt(process.argv[2]) || 10000
  startMonitoring(intervalMs)
}

module.exports = {
  getMemoryInfo,
  logMemoryUsage,
  startMonitoring,
  formatBytes,
}
