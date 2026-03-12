/**
 * Path Security Utilities
 *
 * Provides secure path validation and sanitization to prevent path traversal attacks.
 * All file operations should use these utilities to ensure paths are safe.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

// eslint-disable-next-line no-control-regex
const UNSAFE_PATH_CHARS = /[<>:"|?*\u0000-\u001f]/
const PATH_SEPARATOR = path.sep

function validateUntrustedPathInput(
  filePath: string,
  options: { allowAbsolute?: boolean } = {},
): void {
  const { allowAbsolute = false } = options

  if (!filePath) {
    throw new Error('Path is required')
  }

  if (!allowAbsolute && path.isAbsolute(filePath)) {
    throw new Error('Absolute paths are not allowed')
  }

  if (UNSAFE_PATH_CHARS.test(filePath)) {
    throw new Error('Path contains unsafe characters')
  }

  const segments = filePath.split(/[\\/]+/).filter(Boolean)
  if (segments.includes('..')) {
    throw new Error('Directory traversal sequences (..) are not allowed')
  }
}

function isPathEscapingBase(
  basePath: string,
  targetPath: string,
): boolean {
  const normalizedBase = path.resolve(basePath)
  const normalizedTarget = path.resolve(targetPath)

  const baseWithSeparator = normalizedBase.endsWith(PATH_SEPARATOR)
    ? normalizedBase
    : `${normalizedBase}${PATH_SEPARATOR}`

  return (
    !normalizedTarget.startsWith(baseWithSeparator) &&
    normalizedTarget !== normalizedBase
  )
}

/**
 * Get the project root directory safely
 */
export function getProjectRoot(): string {
  if (typeof process !== 'undefined' && process.cwd) {
    return process.cwd()
  }
  // Fallback for edge cases
  const __filename = fileURLToPath(import.meta.url)
  return path.dirname(path.dirname(path.dirname(__filename)))
}

/**
 * Validates that a path is within an allowed directory (prevents path traversal)
 * @param filePath The path to validate
 * @param allowedDir The allowed base directory
 * @returns The normalized absolute path if valid, throws error if invalid
 */
export function validatePath(
  filePath: string,
  allowedDir: string,
  options: { allowAbsolutePath?: boolean } = {},
): string {
  const { allowAbsolutePath = false } = options

  // Reject unsafe path input before resolution
  validateUntrustedPathInput(filePath, { allowAbsolute: allowAbsolutePath })

  // Normalize the allowed directory to absolute path
  const normalizedAllowedDir = path.resolve(allowedDir)

  // Resolve the file path to absolute using the same base policy
  const resolvedPath = allowAbsolutePath
    ? path.resolve(filePath)
    : path.resolve(normalizedAllowedDir, filePath)

  const escapesBase = isPathEscapingBase(normalizedAllowedDir, resolvedPath)

  if (escapesBase) {
    throw new Error(
      `Path traversal detected: ${filePath} resolves outside allowed directory ${allowedDir}`,
    )
  }

  return path.normalize(resolvedPath)
}

/**
 * Safely joins paths and validates against an allowed directory
 * @param allowedDir The allowed base directory
 * @param ...pathSegments Path segments to join
 * @returns The validated absolute path
 */
export function safeJoin(
  allowedDir: string,
  ...pathSegments: string[]
): string {
  const hasAbsoluteSegment = pathSegments.some((segment) => path.isAbsolute(segment))

  for (const segment of pathSegments) {
    validateUntrustedPathInput(segment, { allowAbsolute: hasAbsoluteSegment })
  }

  const joinedPath = hasAbsoluteSegment
    ? path.resolve(...pathSegments)
    : path.join(...pathSegments)
  return validatePath(joinedPath, allowedDir, {
    allowAbsolutePath: hasAbsoluteSegment,
  })
}

/**
 * Validates a file path against multiple allowed directories
 * @param filePath The path to validate
 * @param allowedDirs Array of allowed base directories
 * @returns The normalized absolute path if valid, throws error if invalid
 */
export function validatePathAgainstMultiple(
  filePath: string,
  allowedDirs: string[],
): string {
  for (const allowedDir of allowedDirs) {
    try {
      return validatePath(filePath, allowedDir)
    } catch {
      // Try next directory
      continue
    }
  }

  throw new Error(
    `Path ${filePath} is not within any allowed directories: ${allowedDirs.join(', ')}`,
  )
}

/**
 * Sanitizes a filename to prevent directory traversal and other unsafe characters
 * @param filename The filename to sanitize
 * @returns Sanitized filename safe for use
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and dangerous characters
  const withoutSeparators = filename
    .replace(/[/\\]/g, '') // Remove path separators
    .replace(/\.\./g, '') // Remove parent directory references

  const filtered = Array.from(withoutSeparators)
    .filter((ch) => {
      const code = ch.codePointAt(0)
      if (code === undefined) return false
      if (code >= 0x00 && code <= 0x1f) return false
      return !['<', '>', ':', '"', '|', '?', '*'].includes(ch)
    })
    .join('')

  return filtered.trim()
}

/**
 * Creates a safe file path by joining base directory with sanitized filename
 * @param baseDir The base directory
 * @param filename The filename to sanitize and join
 * @returns The validated absolute path
 */
export function createSafeFilePath(baseDir: string, filename: string): string {
  const sanitized = sanitizeFilename(filename)
  return safeJoin(baseDir, sanitized)
}

/**
 * Validates that a directory path is safe and creates it if needed
 * @param dirPath The directory path to validate
 * @param allowedDir The allowed base directory
 * @returns The validated absolute path
 */
export function validateAndCreateDir(
  dirPath: string,
  allowedDir: string,
): string {
  return validatePath(dirPath, allowedDir)
}

/**
 * Common allowed directories for the application
 */
// Lazy initialization to avoid issues with import.meta.url in some contexts
let _projectRoot: string | null = null

function getCachedProjectRoot(): string {
  if (!_projectRoot) {
    _projectRoot = getProjectRoot()
  }
  return _projectRoot
}

export const ALLOWED_DIRECTORIES = {
  get PROJECT_ROOT() {
    return getCachedProjectRoot()
  },
  get CONTENT() {
    return path.join(getCachedProjectRoot(), 'content')
  },
  get PUBLIC() {
    return path.join(getCachedProjectRoot(), 'public')
  },
  get OUTPUT() {
    return path.join(getCachedProjectRoot(), 'output')
  },
  get LOGS() {
    return path.join(getCachedProjectRoot(), 'logs')
  },
  get TEMP() {
    return path.join(getCachedProjectRoot(), '.temp')
  },
  get TESTS() {
    return path.join(getCachedProjectRoot(), 'tests')
  },
  get SCRIPTS() {
    return path.join(getCachedProjectRoot(), 'scripts')
  },
} as const
