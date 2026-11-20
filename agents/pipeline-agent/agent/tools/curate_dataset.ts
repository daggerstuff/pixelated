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

const SCHEMA = z.object({
  dataset_id: z.string().min(1),
  cohort_id: z.string().min(1).optional(),
  include_synthetic: z.boolean().default(true),
  submit: z.boolean().default(false),
})

export default defineTool({
  description:
    'Trigger dataset curation on the training infrastructure. Plans a ' +
    'curate-sft-v30 job via the training-infra MCP, and when submit=true ' +
    'submits the approved plan_hash to start a real curation run. Returns ' +
    'the training_infra_job_id for downstream stages.',
  inputSchema: SCHEMA,
  approval: always<CurateDatasetInput>(),
  async execute(input: CurateDatasetInput) {
    let trainingInfraPlan: Record<string, unknown> | null = null
    let trainingInfraJobId: string | null = null
    let submitError: string | null = null
    try {
      const planned = await planTrainingJob({
        recipe: 'curate-sft-v30',
        inputs: {
          corpus: process.env.HACKATHON_ROOT ?? `/data/${input.dataset_id}`,
        },
      })
      if (planned && planned.ok === true) {
        trainingInfraPlan = {
          plan_hash: planned.plan_hash,
          command: planned.command,
          est_cost_usd: planned.est_cost_usd,
          warnings: planned.warnings ?? [],
          recipe: 'curate-sft-v30',
        }
        if (input.submit && typeof planned.plan_hash === 'string') {
          const submitted = await submitTrainingJob({
            plan_hash: planned.plan_hash,
            requested_by: 'pipeline-agent:curate_dataset',
            idempotency_key: `curate:${input.dataset_id}:${input.cohort_id ?? 'all'}`,
          })
          if (submitted && submitted.ok === true) {
            trainingInfraJobId = (submitted.job_id as string) ?? null
          } else {
            submitError =
              (submitted?.error as string) ?? 'submit_job returned no job id'
          }
        }
      } else if (planned && typeof planned.error === 'string') {
        // A rejected plan is not an outage: report the MCP's reason.
        submitError = planned.error
      }
    } catch (err) {
      submitError = err instanceof Error ? err.message : String(err)
    }

    return {
      // The real handle is the registry job id; it stays null until a plan is
      // actually submitted, so no fabricated run id is ever reported.
      training_infra_job_id: trainingInfraJobId,
      training_infra_plan: trainingInfraPlan,
      submit_requested: input.submit,
      submit_error: submitError,
      dataset_id: input.dataset_id,
      cohort_id: input.cohort_id ?? null,
      started_at: new Date().toISOString(),
      include_synthetic: input.include_synthetic,
      status: trainingInfraJobId
        ? 'queued'
        : trainingInfraPlan
          ? 'planned'
          : submitError
            ? 'rejected'
            : 'unavailable',
      note: trainingInfraJobId
        ? 'Curation submitted to the training-infra MCP; poll with check_training_job.'
        : trainingInfraPlan
          ? 'Curation planned; pass submit=true (behind approval) to launch it.'
          : submitError
            ? `The MCP rejected this plan or submit: ${submitError}`
            : 'Training-infra MCP unavailable; no job was created.',
    }
  },
})
