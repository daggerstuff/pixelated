// Readiness Aggregator Route
// Aggregates validation lane statuses into a consolidated readiness report

import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

import express, { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'

const router: Router = express.Router()

const readinessLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message:
    'Too many readiness checks from this IP, please try again after a minute',
})

/**
 * Run the readiness aggregator script in a per-request temp directory so
 * concurrent requests never race on a single shared report file.
 */
function runReadiness(
  scriptPath: string,
  projectRoot: string,
  dryRun: boolean,
): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readiness-'))
  const reportPath = path.join(tmpDir, 'readiness-report.json')
  try {
    const args = dryRun
      ? [scriptPath, '--dry-run', '--output', reportPath]
      : [scriptPath, '--output', reportPath]
    const child = spawn('python3', args, {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })
    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })
    return new Promise<string>((resolve, reject) => {
      child.on('close', (exitCode: number) => {
        if (!fs.existsSync(reportPath)) {
          reject(
            new Error(
              JSON.stringify({
                error: 'Readiness report file was not generated',
                exitCode,
                stdout,
                stderr,
                details: 'Report file does not exist',
              }),
            ),
          )
          return
        }
        resolve(fs.readFileSync(reportPath, 'utf8'))
      })
    })
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
}

router.get(
  '/',
  readinessLimiter,
  async (_req: Request, res: Response): Promise<Response> => {
    try {
      const projectRoot = process.cwd()
      const scriptPath = path.join(
        projectRoot,
        'scripts',
        'devops',
        'aggregate-readiness.py',
      )
      if (!fs.existsSync(scriptPath)) {
        return res.status(500).json({
          error: 'Readiness aggregator script not found',
          scriptPath: scriptPath,
          details: 'Script file does not exist',
        })
      }
      const reportContent = await runReadiness(scriptPath, projectRoot, false)
      const report = JSON.parse(reportContent) as {
        readiness?: { status?: string }
      }
      const statusCode =
        report.readiness?.status === 'ready'
          ? 200
          : report.readiness?.status === 'warning'
            ? 200
            : 503
      return res.status(statusCode).json(report)
    } catch (error: unknown) {
      const details = error instanceof Error ? error.message : String(error)
      try {
        return res.status(500).json(JSON.parse(details))
      } catch {
        return res.status(500).json({
          error: 'Failed to generate readiness report',
          details,
        })
      }
    }
  },
)

router.get(
  '/dry-run',
  readinessLimiter,
  async (_req: Request, res: Response): Promise<Response> => {
    try {
      const projectRoot = process.cwd()
      const scriptPath = path.join(
        projectRoot,
        'scripts',
        'devops',
        'aggregate-readiness.py',
      )
      if (!fs.existsSync(scriptPath)) {
        return res.status(500).json({
          error: 'Readiness aggregator script not found',
          scriptPath: scriptPath,
          details: 'Script file does not exist',
        })
      }
      const reportContent = await runReadiness(scriptPath, projectRoot, true)
      const report = JSON.parse(reportContent) as unknown
      return res.status(200).json(report)
    } catch (error: unknown) {
      const details = error instanceof Error ? error.message : String(error)
      try {
        return res.status(500).json(JSON.parse(details))
      } catch {
        return res.status(500).json({
          error: 'Failed to generate dry-run readiness report',
          details,
        })
      }
    }
  },
)

export default router
