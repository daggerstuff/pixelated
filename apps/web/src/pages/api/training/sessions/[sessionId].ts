import type { APIRoute } from 'astro'

import { getTrainingSessionResponse } from '../../../../lib/services/training/session-api'

export const GET: APIRoute = async ({ params, request }) =>
  getTrainingSessionResponse(request, params['sessionId'])
