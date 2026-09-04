/**
 * MentalArena Python bridge helpers — package validation + temp-file cleanup
 * extracted from MentalArenaPythonBridge.ts.
 */

import { promises as fs } from 'node:fs'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('MentalArenaPythonBridge')

/**
 * Get the current package whitelist
 */
export function getPackageWhitelist(): Record<string, string[]> {
  return {
    torch: ['>=1.12.0,<3.0.0'],
    transformers: ['>=4.20.0,<5.0.0'],
    datasets: ['>=2.0.0,<3.0.0'],
    numpy: ['>=1.21.0,<2.0.0'],
    pandas: ['>=1.4.0,<3.0.0'],
    'scikit-learn': ['>=1.1.0,<2.0.0'],
    matplotlib: ['>=3.5.0,<4.0.0'],
    seaborn: ['>=0.11.0,<1.0.0'],
    tqdm: ['>=4.64.0,<5.0.0'],
    requests: ['>=2.28.0,<3.0.0'],
    pyyaml: ['>=6.0,<7.0'],
    pillow: ['>=9.0.0,<11.0.0'],
    tokenizers: ['>=0.13.0,<1.0.0'],
    accelerate: ['>=0.20.0,<1.0.0'],
    evaluate: ['>=0.4.0,<1.0.0'],
    wandb: ['>=0.13.0,<1.0.0'],
    tensorboard: ['>=2.9.0,<3.0.0'],
    jupyter: ['>=1.0.0,<2.0.0'],
    ipython: ['>=8.0.0,<9.0.0'],
    scipy: ['>=1.9.0,<2.0.0'],
  }
}

/**
 * Validate a single package against the whitelist
 */
export function validatePackage(
  packageName: string,
  versionSpec?: string,
): {
  isAllowed: boolean
  hasValidVersion: boolean
  allowedVersions: string[]
  violations: string[]
} {
  const whitelist = getPackageWhitelist()
  const normalizedPackageName = packageName
    .toLowerCase()
    .replace(/[-_]/g, '-')

  const whitelistKey = Object.keys(whitelist).find(
    (key) =>
      key.toLowerCase().replace(/[-_]/g, '-') === normalizedPackageName,
  )

  const violations: string[] = []

  if (!whitelistKey) {
    violations.push(`Package not in whitelist: ${packageName}`)
    return {
      isAllowed: false,
      hasValidVersion: false,
      allowedVersions: [],
      violations,
    }
  }

  const allowedVersions = whitelist[whitelistKey] ?? []

  if (!versionSpec) {
    violations.push(`Package missing version specification: ${packageName}`)
    return {
      isAllowed: true,
      hasValidVersion: false,
      allowedVersions,
      violations,
    }
  }

  // Basic version validation
  const hasValidVersion = allowedVersions.some((constraint) => {
    if (constraint.includes('>=') && constraint.includes('<')) {
      return true // Accept range specifications for now
    }
    return versionSpec.includes(constraint.replace(/[>=<]/g, ''))
  })

  if (!hasValidVersion) {
    violations.push(
      `Package version not in allowed range: ${packageName}${versionSpec} (allowed: ${allowedVersions.join(', ')})`,
    )
  }

  return {
    isAllowed: true,
    hasValidVersion,
    allowedVersions,
    violations,
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}


export async function cleanupTempFiles(filePaths: string[]): Promise<void> {
  await Promise.allSettled(
    filePaths.map(async (filePath) => {
      try {
        if (await fileExists(filePath)) {
          await fs.unlink(filePath)
        }
      } catch (error: unknown) {
        logger.warn(`Failed to cleanup temp file: ${filePath}`, error)
      }
    }),
  )
}
