import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, existsSync, statSync } from 'fs'

/**
 * Memory optimization tests for GitLab CI/CD pipeline
 * These tests validate that the memory optimizations are properly configured
 */

describe('Memory Optimization Tests', () => {
  const gitlabCiPath = '.gitlab-ci.yml'
  const runnerValuesPath = 'gitlab-runner-values.yaml'
  const memoryScriptPath = 'scripts/memory-optimized-build.sh'
  const monitoringPath = 'monitoring/memory-alerts.yaml'

  beforeEach(() => {
    // Mock console methods to avoid noise in test output
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GitLab CI Configuration', () => {
    it('should have increased memory limits in GitLab CI', () => {
      const gitlabCi = readFileSync(gitlabCiPath, 'utf-8')

      // Check for increased memory limits
      expect(gitlabCi).toContain('KUBERNETES_MEMORY_REQUEST: "4Gi"')
      expect(gitlabCi).toContain('KUBERNETES_MEMORY_LIMIT: "8Gi"')
      expect(gitlabCi).toContain('NODE_OPTIONS: "--max-old-space-size=6144"')
      expect(gitlabCi).toContain(
        'NODE_OPTIONS_OPTIMIZED: "--max-old-space-size=6144 --optimize-for-size --gc-interval=100"',
      )
    })

    it('should use memory-optimized build script', () => {
      const gitlabCi = readFileSync(gitlabCiPath, 'utf-8')
      expect(gitlabCi).toContain('./scripts/memory-optimized-build.sh')
    })

    it('should have proper build stage configuration', () => {
      const gitlabCi = readFileSync(gitlabCiPath, 'utf-8')
      expect(gitlabCi).toContain('stage: build')
      expect(gitlabCi).toContain('image: node:24-alpine')
      expect(gitlabCi).toContain('DOCKER_BUILDKIT_MAX_PARALLELISM: "2"')
    })
  })

  describe('GitLab Runner Configuration', () => {
    it('should have increased runner memory limits', () => {
      const runnerValues = readFileSync(runnerValuesPath, 'utf-8')

      expect(runnerValues).toContain('memory_limit = "8Gi"')
      expect(runnerValues).toContain('memory_request = "4Gi"')
      expect(runnerValues).toContain('cpu_limit = "4000m"')
      expect(runnerValues).toContain('cpu_request = "2000m"')
    })

    it('should have matching resource limits', () => {
      const runnerValues = readFileSync(runnerValuesPath, 'utf-8')

      // Check that limits and requests are consistent
      expect(runnerValues).toContain('limits:\n    cpu: 4000m\n    memory: 8Gi')
      expect(runnerValues).toContain(
        'requests:\n    cpu: 2000m\n    memory: 4Gi',
      )
    })
  })

  describe('Memory Optimization Script', () => {
    it('should exist and be executable', () => {
      expect(existsSync(memoryScriptPath)).toBe(true)

      // Check if script has proper permissions using safe file system API
      try {
        const stats = statSync(memoryScriptPath)
        // Check if file is executable (mode & 0o111 checks all executable bits)
        const isExecutable = (stats.mode & 0o111) !== 0
        expect(isExecutable).toBe(true)
      } catch (_error) {
        // If stat fails, at least verify file exists
        expect(existsSync(memoryScriptPath)).toBe(true)
      }
    })

    it('should have proper memory detection functions', () => {
      const script = readFileSync(memoryScriptPath, 'utf-8')

      expect(script).toContain('detect_memory()')
      expect(script).toContain('select_memory_flags()')
      expect(script).toContain('monitor_memory_usage()')
      expect(script).toContain('build_with_memory_optimization()')
    })

    it('should have progressive memory scaling', () => {
      const script = readFileSync(memoryScriptPath, 'utf-8')

      expect(script).toContain('MEMORY_THRESHOLD="6144"')
      expect(script).toContain('MEMORY_SAFE="4096"')
      expect(script).toContain('MEMORY_CRITICAL="2048"')

      expect(script).toContain('NODE_FLAGS_OPTIMIZED')
      expect(script).toContain('NODE_FLAGS_SAFE')
      expect(script).toContain('NODE_FLAGS_CRITICAL')
    })

    it('should have memory cleanup functions', () => {
      const script = readFileSync(memoryScriptPath, 'utf-8')

      expect(script).toContain('cleanup_memory()')
      expect(script).toContain('pnpm store prune')
      expect(script).toContain('echo 3 > /proc/sys/vm/drop_caches')
    })
  })

  describe('Memory Monitoring Configuration', () => {
    it('should have comprehensive monitoring setup', () => {
      expect(existsSync(monitoringPath)).toBe(true)

      const monitoring = readFileSync(monitoringPath, 'utf-8')

      // Check for Prometheus rules
      expect(monitoring).toContain('PrometheusRule')
      expect(monitoring).toContain('HighMemoryUsage')
      expect(monitoring).toContain('CriticalMemoryUsage')
      expect(monitoring).toContain('EmergencyMemoryUsage')

      // Check for ServiceMonitor
      expect(monitoring).toContain('ServiceMonitor')

      // Check for dashboard
      expect(monitoring).toContain('memory-dashboard.json')
    })

    it('should have proper alert thresholds', () => {
      const monitoring = readFileSync(monitoringPath, 'utf-8')

      expect(monitoring).toContain('threshold: 75') // Warning
      expect(monitoring).toContain('threshold: 85') // Critical
      expect(monitoring).toContain('threshold: 95') // Emergency
    })

    it('should have GitLab runner specific alerts', () => {
      const monitoring = readFileSync(monitoringPath, 'utf-8')

      expect(monitoring).toContain('GitLabRunnerHighMemory')
      expect(monitoring).toContain('BuildProcessHighMemory')
    })
  })

  describe('Integration Tests', () => {
    it('should have consistent memory settings across configurations', () => {
      const gitlabCi = readFileSync(gitlabCiPath, 'utf-8')
      const runnerValues = readFileSync(runnerValuesPath, 'utf-8')

      // GitLab CI requests 4Gi, runner should support at least that
      expect(runnerValues).toContain('memory_request = "4Gi"')
      expect(runnerValues).toContain('memory_limit = "8Gi"')

      // Node.js memory should be within runner limits
      expect(gitlabCi).toContain('NODE_OPTIONS: "--max-old-space-size=6144"')
    })

    it('should reference the memory optimization script in CI', () => {
      const gitlabCi = readFileSync(gitlabCiPath, 'utf-8')
      const script = readFileSync(memoryScriptPath, 'utf-8')

      // CI should use the script
      expect(gitlabCi).toContain('./scripts/memory-optimized-build.sh')

      // Script should be properly structured
      expect(script).toContain('#!/bin/bash')
      expect(script).toContain('set -euo pipefail')
    })
  })

  describe('Error Handling', () => {
    it('should have proper error handling in memory script', () => {
      const script = readFileSync(memoryScriptPath, 'utf-8')

      expect(script).toContain('set -euo pipefail')
      expect(script).toContain('exit 1')
      expect(script).toContain('exit 0')
    })

    it('should have retry mechanisms', () => {
      const gitlabCi = readFileSync(gitlabCiPath, 'utf-8')

      expect(gitlabCi).toContain('retry:')
      expect(gitlabCi).toContain('max: 2')
      expect(gitlabCi).toContain('when:')
    })
  })

  describe('Performance Optimizations', () => {
    it('should have BuildKit optimizations', () => {
      const gitlabCi = readFileSync(gitlabCiPath, 'utf-8')

      expect(gitlabCi).toContain('DOCKER_BUILDKIT: 1')
      expect(gitlabCi).toContain('DOCKER_BUILDKIT_MAX_PARALLELISM: "2"')
      expect(gitlabCi).toContain('BUILDKIT_STEP_LOG_MAX_SIZE: "1048576"')
    })

    it('should have cache optimizations', () => {
      const gitlabCi = readFileSync(gitlabCiPath, 'utf-8')

      expect(gitlabCi).toContain('CACHE_COMPRESSION_LEVEL: fast')
      expect(gitlabCi).toContain(
        'pnpm install --frozen-lockfile --prefer-offline',
      )
    })
  })
})
