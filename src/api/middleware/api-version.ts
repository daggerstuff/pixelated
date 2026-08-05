import type { Request, Response, NextFunction } from 'express'

declare global {
  namespace Express {
    interface Request {
      apiVersion?: string
    }
  }
}

const VERSION_PATH_REGEX = /^\/api\/v(\d+)\//
const ACCEPT_HEADER_REGEX = /application\/vnd\.pixelated\.v(\d+)\+json/

export function getApiVersion(req: Request): string {
  // Check URL path: /api/v1/... or /api/v2/...
  const pathMatch = req.path.match(VERSION_PATH_REGEX)
  if (pathMatch) {
    return pathMatch[1]
  }

  // Check Accept header: application/vnd.pixelated.v<version>+json
  const accept = typeof req.get === 'function' ? req.get('Accept') : undefined
  if (typeof accept === 'string') {
    const headerMatch = accept.match(ACCEPT_HEADER_REGEX)
    if (headerMatch) {
      return headerMatch[1]
    }
  }

  // Default to version 1
  return '1'
}

export function requireApiVersion(minVersion: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const versionStr = getApiVersion(req)
    const version = parseInt(versionStr, 10)

    if (isNaN(version)) {
      res.status(400).json({
        error: {
          code: 'INVALID_API_VERSION',
          message: 'Invalid API version format',
        },
      })
      return
    }

    const minVersionNum = parseInt(minVersion, 10)
    if (version < minVersionNum) {
      res.status(426).json({
        error: {
          code: 'UPGRADE_REQUIRED',
          message: `API version ${minVersion} is required`,
          minVersion,
        },
      })
      return
    }

    next()
  }
}

export function apiVersionResolver() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Determine API version
    req.apiVersion = getApiVersion(req)

    // Rewrite URL to remove version prefix if present in path
    const pathMatch = req.path.match(VERSION_PATH_REGEX)
    req.url = pathMatch
      ? req.path.replace(VERSION_PATH_REGEX, '/api/')
      : req.path

    next()
  }
}
