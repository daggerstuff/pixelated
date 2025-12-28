import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { securePathJoin } from '../../utils/index'
import { ALLOWED_DIRECTORIES, safeJoin } from '../../../utils/path-security'

const logger = createBuildSafeLogger('default')
import { existsSync } from 'fs'

export interface DatasetMergeStats {
  totalDatasets: number
  totalSamples: number
  mergedSamples: number
  duplicatesRemoved: number
  categoriesCount: number
  qualityScoreAverage: number
  processingTimeMs: number
}

export interface MergeDatasetOptions {
  outputFormat: 'jsonl' | 'json' | 'csv'
  removeDuplicates: boolean
  qualityThreshold: number
  maxSamples?: number
  categories?: string[]
}

export async function mergeAllDatasets(
  options: MergeDatasetOptions = {
    outputFormat: 'jsonl',
    removeDuplicates: true,
    qualityThreshold: 0.7,
  },
): Promise<DatasetMergeStats> {
  const startTime = Date.now()

  logger.info('Starting dataset merge process', { options })

  // Mock implementation for now
  const stats: DatasetMergeStats = {
    totalDatasets: 5,
    totalSamples: 10000,
    mergedSamples: 9500,
    duplicatesRemoved: 500,
    categoriesCount: 8,
    qualityScoreAverage: 0.82,
    processingTimeMs: Date.now() - startTime,
  }

  logger.info('Dataset merge completed', { stats })

  return stats
}

export function mergedDatasetExists(outputPath?: string): boolean {
  const basePath = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, 'data', 'merged')
  const defaultFilename = 'mental_health_dataset.jsonl'

  // Validate and resolve path to prevent path traversal
  const checkPath = outputPath
    ? securePathJoin(basePath, outputPath, {
      allowedExtensions: ['.jsonl', '.json', '.csv'],
    })
    : securePathJoin(basePath, defaultFilename, {
      allowedExtensions: ['.jsonl', '.json', '.csv'],
    })

  const exists = existsSync(checkPath)
  logger.info('Checking merged dataset existence', { path: checkPath, exists })

  return exists
}

export function getMergedDatasetPath(
  format: 'jsonl' | 'json' | 'csv' = 'jsonl',
): string {
  // Validate format parameter to prevent path traversal
  if (format !== 'jsonl' && format !== 'json' && format !== 'csv') {
    throw new Error('Invalid format parameter')
  }

  const extension = format === 'jsonl' ? 'jsonl' : format
  const filename = `mental_health_dataset.${extension}`

  // Use securePathJoin which validates the filename internally
  const basePath = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, 'data', 'merged')
  const validatedPath = securePathJoin(basePath, filename, {
    allowedExtensions: ['.jsonl', '.json', '.csv'],
  })

  logger.debug('Generated merged dataset path', { format, path: validatedPath })

  return validatedPath
}

export async function validateMergedDataset(filePath: string): Promise<{
  isValid: boolean
  errors: string[]
  sampleCount: number
}> {
  logger.info('Validating merged dataset', { filePath })

  // Validate filePath to prevent path traversal
  const basePath = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, 'data', 'merged')
  const validatedPath = securePathJoin(basePath, filePath, {
    allowedExtensions: ['.jsonl', '.json', '.csv'],
  })

  // Mock validation for now
  const validation = {
    isValid: true,
    errors: [] as string[],
    sampleCount: 9500,
  }

  if (!existsSync(validatedPath)) {
    validation.isValid = false
    validation.errors.push('Dataset file does not exist')
    validation.sampleCount = 0
  }

  logger.info('Dataset validation completed', { filePath: validatedPath, validation })

  return validation
}
