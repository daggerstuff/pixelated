import { defineTool } from 'eve/tools'
import { always } from 'eve/tools/approval'
import { z } from 'zod'

import {
  planTrainingJob,
  submitTrainingJob,
} from '../lib/training-infra-client.js'

interface CurateDatasetInput {
  dataset_id: string
  cohort_id?: string
  include_synthetic: boolean
  submit: boolean
}

interface CurationOutcome {
  plan: Record<string, unknown> | null
  jobId: string | null
  error: string | null
}

const SCHEMA = z.object({
  dataset_id: z.string().min(1),
  cohort_id: z.string().min(1).optional(),
  include_synthetic: z.boolean().default(true),
  submit: z.boolean().default(false),
})

async function planCuration(datasetId: string): Promise<{
  plan: Record<string, unknown> | null
  rejectionError: string | null
}> {
  const planned = await planTrainingJob({
    recipe: 'curate-sft-v30',
    inputs: {
      corpus: process.env.HACKATHON_ROOT ?? `/data/${datasetId}`,
    },
  })
  if (planned?.ok === true) {
    return {
      plan: {
        plan_hash: planned.plan_hash,
        command: planned.command,
        est_cost_usd: planned.est_cost_usd,
        warnings: planned.warnings ?? [],
        recipe: 'curate-sft-v30',
      },
      rejectionError: null,
    }
  }
  // A rejected plan is not an outage: report the MCP's reason.
  const rejectionError =
    planned && typeof planned.error === 'string' ? planned.error : null
  return { plan: null, rejectionError }
}

async function submitCuration(
  input: CurateDatasetInput,
  planHash: string,
): Promise<{ jobId: string | null; error: string | null }> {
  const submitted = await submitTrainingJob({
    plan_hash: planHash,
    requested_by: 'pipeline-agent:curate_dataset',
    idempotency_key: `curate:${input.dataset_id}:${input.cohort_id ?? 'all'}`,
  })
  if (submitted?.ok === true) {
    return { jobId: (submitted.job_id as string) ?? null, error: null }
  }
  return {
    jobId: null,
    error: (submitted?.error as string) ?? 'submit_job returned no job id',
  }
}

async function runCuration(input: CurateDatasetInput): Promise<CurationOutcome> {
  try {
    const { plan, rejectionError } = await planCuration(input.dataset_id)
    if (!plan) {
      return { plan: null, jobId: null, error: rejectionError }
    }
    if (!input.submit || typeof plan.plan_hash !== 'string') {
      return { plan, jobId: null, error: null }
    }
    const { jobId, error } = await submitCuration(input, plan.plan_hash)
    return { plan, jobId, error }
  } catch (err) {
    return {
      plan: null,
      jobId: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

export default defineTool({
  description:
    'Trigger dataset curation on the training infrastructure. Plans a ' +
    'curate-sft-v30 job via the training-infra MCP, and when submit=true ' +
    'submits the approved plan_hash to start a real curation run. Returns ' +
    'the training_infra_job_id for downstream stages.',
  inputSchema: SCHEMA,
  approval: always<CurateDatasetInput>(),
  async execute(input: CurateDatasetInput) {
    const { plan, jobId, error: submitError } = await runCuration(input)

    return {
      // The real handle is the registry job id; it stays null until a plan is
      // actually submitted, so no fabricated run id is ever reported.
      training_infra_job_id: jobId,
      training_infra_plan: plan,
      submit_requested: input.submit,
      submit_error: submitError,
      dataset_id: input.dataset_id,
      cohort_id: input.cohort_id ?? null,
      started_at: new Date().toISOString(),
      include_synthetic: input.include_synthetic,
      status: jobId ? 'queued' : plan ? 'planned' : submitError ? 'rejected' : 'unavailable',
      note: jobId
        ? 'Curation submitted to the training-infra MCP; poll with check_training_job.'
        : plan
          ? 'Curation planned; pass submit=true (behind approval) to launch it.'
          : submitError
            ? `The MCP rejected this plan or submit: ${submitError}`
            : 'Training-infra MCP unavailable; no job was created.',
    }
  },
})
