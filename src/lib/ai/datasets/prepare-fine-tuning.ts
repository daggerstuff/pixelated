import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

import fs from 'node:fs'
import { safeJoin, ALLOWED_DIRECTORIES, validateAndCreateDir } from '../../../utils/path-security'

export interface DatasetPaths {
  openai: string | null
  huggingface: string | null
}

export interface PreparedDatasetStatus {
  openai: boolean
  huggingface: boolean
}

/**
 * Check if prepared datasets exist
 */
export function preparedDatasetsExist(): PreparedDatasetStatus {
  const dataDir = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, 'data', 'prepared')
  const openaiPath = safeJoin(dataDir, 'openai_dataset.jsonl')
  const huggingfacePath = safeJoin(dataDir, 'huggingface_dataset.json')

  return {
    openai: fs.existsSync(openaiPath),
    huggingface: fs.existsSync(huggingfacePath),
  }
}

/**
 * Prepare dataset for OpenAI fine-tuning format
 */
export async function prepareForOpenAI(): Promise<string | null> {
  try {
    logger.info('Preparing dataset for OpenAI format')

    // TODO: Implement actual OpenAI dataset preparation
    const dataDir = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, 'data', 'prepared')
    const outputPath = safeJoin(dataDir, 'openai_dataset.jsonl')

    // Ensure directory exists
    validateAndCreateDir(dataDir, ALLOWED_DIRECTORIES.PROJECT_ROOT)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    // Placeholder implementation
    fs.writeFileSync(
      outputPath,
      '{"messages": [{"role": "system", "content": "You are a helpful assistant."}]}\n',
    )

    logger.info(`OpenAI dataset prepared: ${outputPath}`)
    return outputPath
  } catch (error: unknown) {
    logger.error(`Failed to prepare OpenAI dataset: ${error}`)
    return null
  }
}

/**
 * Prepare dataset for HuggingFace format
 */
export async function prepareForHuggingFace(): Promise<string | null> {
  try {
    logger.info('Preparing dataset for HuggingFace format')

    // TODO: Implement actual HuggingFace dataset preparation
    const dataDir = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, 'data', 'prepared')
    const outputPath = safeJoin(dataDir, 'huggingface_dataset.json')

    // Ensure directory exists
    validateAndCreateDir(dataDir, ALLOWED_DIRECTORIES.PROJECT_ROOT)
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }

    // Placeholder implementation
    const data = {
      train: [{ text: 'Example training text', label: 'example' }],
    }
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2))

    logger.info(`HuggingFace dataset prepared: ${outputPath}`)
    return outputPath
  } catch (error: unknown) {
    logger.error(`Failed to prepare HuggingFace dataset: ${error}`)
    return null
  }
}

/**
 * Prepare datasets for all formats
 */
export async function prepareAllFormats(): Promise<DatasetPaths> {
  const openaiPath = await prepareForOpenAI()
  const huggingfacePath = await prepareForHuggingFace()

  return {
    openai: openaiPath,
    huggingface: huggingfacePath,
  }
}
