import * as path from 'path'
import { validatePath } from '../../utils/path-security'

/**
 * Server-side path utility functions
 */

/**
 * Secure path validation utility to prevent path traversal attacks
 * @param basePath - The base directory path that should not be escaped
 * @param userPath - The user-provided path segment
 * @param options - Additional validation options
 * @returns The validated and resolved path
 * @throws Error if the path is unsafe or attempts directory traversal
 */
export function securePathJoin(
  basePath: string,
  userPath: string,
  options: {
    allowAbsolute?: boolean
    allowedExtensions?: string[]
    maxDepth?: number
  } = {},
): string {
  const {
    allowAbsolute = false,
    allowedExtensions = [],
    maxDepth = 10,
  } = options

  // Check depth limit
  const segments = userPath
    .split(/[/\\]/)
    .filter((segment) => segment.length > 0)
  if (segments.length > maxDepth) {
    throw new Error(`Path depth exceeds maximum allowed depth of ${maxDepth}`)
  }

  // Check file extension allowlist if provided
  if (allowedExtensions.length > 0) {
    const ext = path.extname(userPath).toLowerCase()
    if (!allowedExtensions.includes(ext)) {
      throw new Error(
        `File extension '${ext}' is not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`,
      )
    }
  }

  const resolvedPath = allowAbsolute
    ? validatePath(userPath, basePath, { allowAbsolutePath: true })
    : validatePath(userPath, basePath)

  return resolvedPath
}
