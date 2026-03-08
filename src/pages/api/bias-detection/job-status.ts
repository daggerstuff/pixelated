import { batchJobQueue } from './submit-batch-job'

export async function GET({
  request,
}: {
  request: Request
}): Promise<Response> {
  const url = new URL(request.url)
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
