import { exec } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { safeJoin, ALLOWED_DIRECTORIES, validatePath } from '../../utils/path-security'

const execAsync = promisify(exec)

/**
 * Log rotation configuration
 */
export interface LogRotationConfig {
  // Directory where logs are stored
  logDir: string

  // Maximum file size in bytes before rotation (default: 10MB)
  maxSize?: number

  // Maximum number of rotated files to keep (default: 5)
  maxFiles?: number

  // Whether to compress rotated logs (default: true)
  compress?: boolean

  // Rotation frequency - daily, hourly, etc. (default: daily)
  frequency?: 'hourly' | 'daily' | 'weekly'
}

/**
 * Default configuration
 */
const defaultConfig: LogRotationConfig = {
  logDir: safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, 'logs'),
  maxSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  compress: true,
  frequency: 'daily',
}

/**
 * Log rotation service
 */
export class LogRotationService {
  private config: LogRotationConfig

  constructor(config: Partial<LogRotationConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * Ensure log directory exists
   */
  async ensureLogDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.logDir, { recursive: true })
    } catch (error: unknown) {
      console.error('Failed to create log directory:', error)
    }
  }

  /**
   * Get current log filename based on frequency
   */
  getLogFilename(prefix = 'app'): string {
    const date = new Date()
    let dateStr: string

    switch (this.config.frequency) {
      case 'hourly':
        dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${String(date.getHours()).padStart(2, '0')}`
        break
      case 'weekly': {
        const startOfWeek = new Date(date)
        startOfWeek.setDate(date.getDate() - date.getDay())
        dateStr = `${startOfWeek.getFullYear()}-${String(startOfWeek.getMonth() + 1).padStart(2, '0')}-${String(startOfWeek.getDate()).padStart(2, '0')}`
        break
      }
      case 'daily':
      default:
        dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    }

    const filename = `${prefix}-${dateStr}.log`
    return validatePath(filename, this.config.logDir)
  }

  /**
   * Write a log entry to the appropriate file
   */
  async writeLog(entry: string, prefix = 'app'): Promise<void> {
    await this.ensureLogDir()
    const filename = this.getLogFilename(prefix)

    try {
      // Append to log file
      await fs.appendFile(filename, `${entry}\n`)

      // Check file size and rotate if needed
      await this.checkAndRotate(filename)
    } catch (error: unknown) {
      console.error('Failed to write log:', error)
    }
  }

  /**
   * Check file size and rotate if needed
   */
  async checkAndRotate(filename: string): Promise<void> {
    try {
      const stats = await fs.stat(filename)

      if (stats.size >= (this.config.maxSize ?? defaultConfig.maxSize!)) {
        await this.rotateLog(filename)
      }
    } catch {
      // File might not exist yet, ignore
    }
  }

  /**
   * Rotate log file
   */
  async rotateLog(filename: string): Promise<void> {
    try {
      // Generate rotated filename with timestamp
      const timestamp = new Date()
        .toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '')
      const rotatedFilename = `${filename}.${timestamp}`

      // Rename current log file
      await fs.rename(filename, rotatedFilename)

      // Compress if configured
      if (this.config.compress) {
        await this.compressLog(rotatedFilename)
      }

      // Cleanup old logs
      await this.cleanupOldLogs(filename)
    } catch (error: unknown) {
      console.error('Failed to rotate log:', error)
    }
  }

  /**
   * Compress a log file
   */
  async compressLog(filename: string): Promise<void> {
    try {
      // Use gzip to compress the file
      await execAsync(`gzip -9 ${filename}`)
    } catch (error: unknown) {
      console.error('Failed to compress log:', error)
    }
  }

  /**
   * Clean up old log files
   */
  async cleanupOldLogs(baseFilename: string): Promise<void> {
    try {
      const dirname = path.dirname(baseFilename)
      const baseFile = path.basename(baseFilename)
      const prefix = baseFile.split('.')[0]

      // Get all rotated log files
      const files = await fs.readdir(dirname)
      const rotatedFiles = files
        .filter(
          (file) => prefix && file.startsWith(prefix) && file !== baseFile,
        )
        .map((file) => {
          const filePath = validatePath(file, dirname)
          return { name: file, path: filePath }
        })

      // Sort by modification time (newest first)
      const filesWithStats = await Promise.all(
        rotatedFiles.map(async (file) => {
          const stats = await fs.stat(file.path)
          return { ...file, mtime: stats.mtime }
        }),
      )

      filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

      // Delete excess files
      const maxFiles = this.config.maxFiles ?? defaultConfig.maxFiles!
      if (filesWithStats.length >= maxFiles) {
        const filesToDelete = filesWithStats.slice(maxFiles - 1)
        for (const file of filesToDelete) {
          await fs.unlink(file.path)
        }
      }
    } catch (error: unknown) {
      console.error('Failed to clean up old logs:', error)
    }
  }

  /**
   * Aggregate logs from multiple files
   */
  async aggregateLogs(
    output: string,
    pattern = '*',
    startDate?: Date,
    endDate?: Date,
  ): Promise<void> {
    try {
      await this.ensureLogDir()
      const { logDir } = this.config

      // Get all log files
      const files = await fs.readdir(logDir)

      // Filter by pattern
      const filteredFiles = files.filter((file) => {
        if (!file.endsWith('.log') && !file.endsWith('.log.gz')) {
          return false
        }

        if (pattern !== '*' && !file.includes(pattern)) {
          return false
        }

        // Extract date from filename
        const dateMatch = file.match(/\d{4}-\d{2}-\d{2}/)
        if (!dateMatch) {
          return true
        }

        const fileDate = new Date(dateMatch[0])

        if (startDate && fileDate < startDate) {
          return false
        }
        if (endDate && fileDate > endDate) {
          return false
        }

        return true
      })

      // Sort by date
      filteredFiles.sort()

      // Create output file
      await fs.writeFile(output, '')

      // Aggregate log content
      for (const file of filteredFiles) {
        const filePath = validatePath(file, logDir)

        // Handle compressed files
        if (file.endsWith('.gz')) {
          const { stdout } = await execAsync(`gunzip -c ${filePath}`)
          await fs.appendFile(output, stdout)
        } else {
          const content = await fs.readFile(filePath, 'utf8')
          await fs.appendFile(output, content)
        }
      }
    } catch (error: unknown) {
      console.error('Failed to aggregate logs:', error)
    }
  }
}
