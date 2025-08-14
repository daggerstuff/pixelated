import type { APIRoute } from 'astro'
import {
  prepareAllFormats,
  prepareForOpenAI,
  prepareForHuggingFace,
  preparedDatasetsExist,
  type DatasetPaths,
} from '../../../../lib/ai/datasets/prepare-fine-tuning'
import { mergedDatasetExists } from '../../../../lib/ai/datasets/merge-datasets'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
const logger = createBuildSafeLogger('dataset-prepare')

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check request authentication (implement proper auth here)
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Unauthorized',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Parse request body
    const body = await request.json()
    const { format = 'all', force = false } = body

    // Check if merged dataset exists
    if (!mergedDatasetExists()) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Merged dataset not found. Run the dataset merge process first.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Check if prepared datasets already exist and force is not enabled
    const existingDatasets = preparedDatasetsExist()
    if (
      !force &&
      ((format === 'all' &&
        existingDatasets.openai &&
        existingDatasets.huggingface) ||
        (format === 'openai' && existingDatasets.openai) ||
        (format === 'huggingface' && existingDatasets.huggingface))
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            'Prepared datasets already exist. Use force: true to recreate.',
          existingDatasets,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Prepare datasets based on the requested format
    let result: DatasetPaths | null = null
    if (format === 'all') {
      // sourcery skip: dont-self-assign-variables
      result = await prepareAllFormats()
    } else if (format === 'openai') {
      const openaiPath = await prepareForOpenAI()
      // sourcery skip: dont-self-assign-variables
      result = { openai: openaiPath, huggingface: null }
    } else if (format === 'huggingface') {
      const huggingfacePath = await prepareForHuggingFace()
      // sourcery skip: dont-self-assign-variables
      result = { openai: null, huggingface: huggingfacePath }
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid format. Use "all", "openai", or "huggingface".',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Check if preparation was successful
    if (
      !result ||
      (format === 'all' && (!result.openai || !result.huggingface)) ||
      (format === 'openai' && !result.openai) ||
      (format === 'huggingface' && !result.huggingface)
    ) {
      logger.error('Dataset preparation failed via API call')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to prepare datasets. Check server logs for details.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Return success response with paths
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Datasets prepared successfully',
        openai: result.openai,
        huggingface: result.huggingface,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    logger.error(`Error in dataset preparation API: ${error}`)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

// Also allow GET to check dataset preparation status
export const GET: APIRoute = async () => {
  try {
    const preparedStatus = preparedDatasetsExist()
    const mergedExists = mergedDatasetExists()

    return new Response(
      JSON.stringify({
        mergedDatasetExists: mergedExists,
        preparedDatasets: preparedStatus,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    logger.error(`Error in dataset preparation status API: ${error}`)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
