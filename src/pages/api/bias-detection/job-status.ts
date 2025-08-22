import { NextRequest } from 'next/server'
import { batchJobQueue } from './submit-batch-job'

export const runtime = 'nodejs'

export default async function handler(req: NextRequest): Promise<Response> {
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }
  const url = new URL(req.url!)
  const jobId = url.searchParams.get('jobId')
  if (!jobId) {
    return new Response('Missing jobId parameter', { status: 400 })
  }
  const job = batchJobQueue.getJob(jobId)
  if (!job) {
    return new Response('Job not found', { status: 404 })
  }
  return new Response(JSON.stringify(job), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}