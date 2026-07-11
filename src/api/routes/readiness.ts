// Readiness Aggregator Route
// Aggregates validation lane statuses into a consolidated readiness report

import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

import express, { Router, Request, Response } from 'express'

const router: Router = express.Router()

// ============================================================================
// READINESS AGGREGATOR ENDPOINT
// ============================================================================

/**
 * Aggregate validation lane statuses and return readiness report
 * Combines results from lint, typecheck, tests, and format validation lanes
 */
router.get('/', async (_req: Request, res: Response): Promise<Response> => {
  try {
    // Get the project root directory
    const projectRoot = process.cwd()

    // Path to the readiness aggregator script
    const scriptPath = path.join(
      projectRoot,
      'scripts',
      'devops',
      'aggregate-readiness.py',
    )

    // Check if the script exists
    if (!fs.existsSync(scriptPath)) {
      return res.status(500).json({
        error: 'Readiness aggregator script not found',
        scriptPath: scriptPath,
        details: 'Script file does not exist',
      })
    }

    // Execute the readiness aggregator script
    const child = spawn(
      'python3',
      [scriptPath, '--output', '/tmp/readiness-report.json'],
      {
        cwd: projectRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    // Wait for the process to complete
    const exitCode = await new Promise<number>((resolve) => {
      child.on('close', resolve)
    })

    // Check if the output file was created
    if (!fs.existsSync('/tmp/readiness-report.json')) {
      return res.status(500).json({
        error: 'Readiness report file was not generated',
        exitCode: exitCode,
        stdout: stdout,
        stderr: stderr,
        details: 'Report file does not exist',
      })
    }

    // Read the generated report
    const reportContent = fs.readFileSync('/tmp/readiness-report.json', 'utf8')
    const report = JSON.parse(reportContent) as {
      readiness?: { status?: string }
    }

    // Clean up the temporary file
    try {
      fs.unlinkSync('/tmp/readiness-report.json')
    } catch (error) {
      // Ignore cleanup errors
    }

    // Return the report with appropriate status code
    const statusCode =
      report.readiness?.status === 'ready'
        ? 200
        : report.readiness?.status === 'warning'
          ? 200
          : 503

    return res.status(statusCode).json(report)
  } catch (error: unknown) {
    return res.status(500).json({
      error: 'Failed to generate readiness report',
      details: (error as Error).message,
    })
  }
})

// ============================================================================
// DRY RUN ENDPOINT (for testing)
// ============================================================================

/**
 * Generate readiness report in dry-run mode (simulates all checks as passing)
 */
router.get(
  '/dry-run',
  async (_req: Request, res: Response): Promise<Response> => {
    try {
      // Get the project root directory
      const projectRoot = process.cwd()

      // Path to the readiness aggregator script
      const scriptPath = path.join(
        projectRoot,
        'scripts',
        'devops',
        'aggregate-readiness.py',
      )

      // Check if the script exists
      if (!fs.existsSync(scriptPath)) {
        return res.status(500).json({
          error: 'Readiness aggregator script not found',
          scriptPath: scriptPath,
          details: 'Script file does not exist',
        })
      }

      // Execute the readiness aggregator script in dry-run mode
      const child = spawn(
        'python3',
        [scriptPath, '--dry-run', '--output', '/tmp/readiness-report-dry.json'],
        {
          cwd: projectRoot,
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      )

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString()
      })

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString()
      })

      // Wait for the process to complete
      const exitCode = await new Promise<number>((resolve) => {
        child.on('close', resolve)
      })

      // Check if the output file was created
      if (!fs.existsSync('/tmp/readiness-report-dry.json')) {
        return res.status(500).json({
          error: 'Readiness report file was not generated',
          exitCode: exitCode,
          stdout: stdout,
          stderr: stderr,
          details: 'Report file does not exist',
        })
      }

      // Read the generated report
      const reportContent = fs.readFileSync(
        '/tmp/readiness-report-dry.json',
        'utf8',
      )
      const report = JSON.parse(reportContent) as unknown

      // Clean up the temporary file
      try {
        fs.unlinkSync('/tmp/readiness-report-dry.json')
      } catch (error) {
        // Ignore cleanup errors
      }

      return res.status(200).json(report)
    } catch (error: unknown) {
      return res.status(500).json({
        error: 'Failed to generate dry-run readiness report',
        details: (error as Error).message,
      })
    }
  },
)

export default router
