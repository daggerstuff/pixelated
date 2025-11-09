/**
 * Node.js utilities for visual regression tests
 * This file contains server-side only functionality
 */

import fs from 'node:fs'
import path from 'node:path'
import { safeJoin, ALLOWED_DIRECTORIES, validatePath, sanitizeFilename } from '../../utils/path-security'

export interface Screenshot {
  name: string
  page: string
  deviceType: string
  baselinePath: string
  actualPath: string | null
  diffPath: string | null
  hasDiff: boolean
  lastUpdated: string
}

export interface PageMap {
  [page: string]: Screenshot[]
}

export interface VisualRegressionData {
  error: string | null
  screenshots: Screenshot[]
  byPage: PageMap
  diffCount: number
  lastUpdated: string | null
}

export const getVisualRegressionData =
  async (): Promise<VisualRegressionData> => {
    try {
      // Path to visual test results directory
      const testResultsDir = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, 'test-results')

      if (!fs.existsSync(testResultsDir)) {
        return {
          error: 'No test results found',
          screenshots: [],
          byPage: {},
          diffCount: 0,
          lastUpdated: null,
        }
      }

      const screenshots: Screenshot[] = []
      const byPage: PageMap = {}

      // Recursively scan for visual regression test files
      const scanDirectory = (dir: string) => {
        try {
          const items = fs.readdirSync(dir)

          for (const item of items) {
            const sanitizedItem = sanitizeFilename(item)
            const itemPath = validatePath(sanitizedItem, dir)
            const stats = fs.statSync(itemPath)

            if (stats.isDirectory()) {
              scanDirectory(itemPath)
            } else if (
              item.endsWith('-actual.png') ||
              item.endsWith('-expected.png')
            ) {
              const baseName = item.replace(/-(?:actual|expected)\.png$/, '')
              const page =
                path.relative(testResultsDir, dir).replace(/[/\\]/g, '/') ||
                'root'

              const sanitizedBaseName = sanitizeFilename(baseName)
              const expectedPath = safeJoin(dir, `${sanitizedBaseName}-expected.png`)
              const actualPath = safeJoin(dir, `${sanitizedBaseName}-actual.png`)
              const diffPath = safeJoin(dir, `${sanitizedBaseName}-diff.png`)

              const hasExpected = fs.existsSync(expectedPath)
              const hasActual = fs.existsSync(actualPath)
              const hasDiff = fs.existsSync(diffPath)

              if (hasExpected || hasActual) {
                const screenshot: Screenshot = {
                  name: baseName,
                  page,
                  deviceType: baseName.includes('mobile')
                    ? 'mobile'
                    : 'desktop',
                  baselinePath: hasExpected ? expectedPath : '',
                  actualPath: hasActual ? actualPath : null,
                  diffPath: hasDiff ? diffPath : null,
                  hasDiff,
                  lastUpdated: stats.mtime.toISOString(),
                }

                screenshots.push(screenshot)

                if (!byPage[page]) {
                  byPage[page] = []
                }
                byPage[page].push(screenshot)
              }
            }
          }
        } catch (scanError) {
          console.warn(`Error scanning directory ${dir}:`, scanError)
        }
      }

      scanDirectory(testResultsDir)

      // Sort screenshots by page and name
      screenshots.sort((a, b) => {
        const pageCompare = a.page.localeCompare(b.page)
        return pageCompare !== 0 ? pageCompare : a.name.localeCompare(b.name)
      })

      for (const page in byPage) {
        if (byPage[page]) {
          byPage[page].sort((a, b) => a.name.localeCompare(b.name))
        }
      }

      const diffCount = screenshots.filter((s) => s.hasDiff).length
      let lastUpdated: string | null = null
      if (screenshots.length > 0 && screenshots[0]?.lastUpdated) {
        lastUpdated = screenshots.reduce((latest, current) => {
          return new Date(current.lastUpdated) > new Date(latest)
            ? current.lastUpdated
            : latest
        }, screenshots[0].lastUpdated)
      }

      return {
        error: null,
        screenshots,
        byPage,
        diffCount,
        lastUpdated,
      }
    } catch (error: unknown) {
      console.error('Error fetching visual regression data:', error)
      return {
        error:
          error instanceof Error ? String(error) : 'Unknown error occurred',
        screenshots: [],
        byPage: {},
        diffCount: 0,
        lastUpdated: null,
      }
    }
  }
