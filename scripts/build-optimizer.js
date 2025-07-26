#!/usr/bin/env node

/**
 * Build Optimizer Script
 *
 * Advanced build optimization utility for production deployments
 */

import { execSync } from 'child_process'
import { existsSync, writeFileSync, mkdirSync } from 'fs'
import { performance } from 'perf_hooks'

const BUILD_TARGETS = {
  vercel: {
    config: 'astro.config.mjs',
    env: {
      BUILDING_FOR_VERCEL: '1',
      NODE_OPTIONS: '--max-old-space-size=4096',
      DISABLE_WEB_FONTS: 'true',
      ASTRO_TELEMETRY_DISABLED: '1',
    },
  },
  production: {
    config: 'astro.config.prod.mjs',
    env: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=4096',
      DISABLE_WEB_FONTS: 'true',
      ASTRO_TELEMETRY_DISABLED: '1',
    },
  },
}

class BuildOptimizer {
  constructor(target = 'vercel') {
    this.target = target
    this.startTime = performance.now()
    this.stats = { phases: {}, errors: [] }

    if (!existsSync('reports')) {
      mkdirSync('reports', { recursive: true })
    }
  }

  log(message, level = 'info') {
    const prefix = { info: '📋', success: '✅', error: '❌' }[level] || '📋'
    console.log(`${prefix} ${message}`)
  }

  async measurePhase(name, fn) {
    this.log(`Starting ${name}...`)
    const start = performance.now()

    try {
      await fn()
      const duration = Math.round(performance.now() - start)
      this.stats.phases[name] = { duration, status: 'success' }
      this.log(`Completed ${name} in ${duration}ms`, 'success')
    } catch (error) {
      const duration = Math.round(performance.now() - start)
      this.stats.phases[name] = {
        duration,
        status: 'failed',
        error: error.message,
      }
      this.log(`Failed ${name}: ${error.message}`, 'error')
      throw error
    }
  }

  execCommand(command) {
    try {
      return execSync(command, { stdio: 'inherit', encoding: 'utf8' })
    } catch (error) {
      throw new Error(`Command failed: ${command}`)
    }
  }

  async setupEnvironment() {
    return this.measurePhase('Environment Setup', async () => {
      const config = BUILD_TARGETS[this.target]
      if (!config) {
        throw new Error(`Unknown target: ${this.target}`)
      }

      Object.entries(config.env).forEach(([key, value]) => {
        process.env[key] = value
      })

      if (!existsSync(config.config)) {
        throw new Error(`Config not found: ${config.config}`)
      }
    })
  }

  async buildApplication() {
    return this.measurePhase('Application Build', async () => {
      const config = BUILD_TARGETS[this.target]
      this.execCommand(`astro build --config ${config.config}`)
    })
  }

  async generateReport() {
    const totalTime = Math.round(performance.now() - this.startTime)
    const report = {
      target: this.target,
      totalTime: `${Math.round(totalTime / 1000)}s`,
      phases: this.stats.phases,
      status: this.stats.errors.length === 0 ? 'SUCCESS' : 'FAILED',
    }

    const reportPath = `reports/build-report-${this.target}-${Date.now()}.json`
    writeFileSync(reportPath, JSON.stringify(report, null, 2))
    this.log(`Report generated: ${reportPath}`, 'success')
  }

  async run() {
    try {
      this.log(`Starting build for ${this.target}`)
      await this.setupEnvironment()
      await this.buildApplication()
      await this.generateReport()
      this.log('Build completed successfully! 🎉', 'success')
    } catch (error) {
      this.stats.errors.push(error.message)
      await this.generateReport()
      this.log(`Build failed: ${error.message}`, 'error')
      process.exit(1)
    }
  }
}

// CLI
const target = process.argv[2] || 'vercel'
const optimizer = new BuildOptimizer(target)
optimizer.run().catch(console.error)
