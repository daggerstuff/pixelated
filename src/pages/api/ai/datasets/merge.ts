import type { APIRoute } from 'astro'
import {
  mergeAllDatasets,
  mergedDatasetExists,
  getMergedDatasetPath,
} from '../../../../lib/ai/datasets/merge-datasets'

import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
const logger = createBuildSafeLogger('dataset-merge')

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
    const { force = false } = body

    // Check if dataset already exists and force is not enabled
    if (mergedDatasetExists() && !force) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Dataset already exists. Use force: true to recreate.',
          datasetPath: getMergedDatasetPath(),
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Start the merge process
    const stats = await mergeAllDatasets()

    if (!stats) {
      logger.error('Dataset merge failed via API call')
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to merge datasets. Check server logs for details.',
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Return success response with stats
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Datasets merged successfully',
        stats,
        datasetPath: getMergedDatasetPath(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    logger.error(`Error in dataset merge API: ${error}`)

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

// Also allow GET to check dataset status
export const GET: APIRoute = async () => {
  try {
    const exists = mergedDatasetExists()

    return new Response(
      JSON.stringify({
        exists,
        datasetPath: exists ? getMergedDatasetPath() : null,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    logger.error(`Error in dataset status API: ${error}`)

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
