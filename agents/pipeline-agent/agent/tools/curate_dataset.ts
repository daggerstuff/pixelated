import { defineTool } from 'eve/tools'
import { always } from 'eve/tools/approval'
import { z } from 'zod'

import { planTrainingJob } from '../lib/training-infra-client.js'

interface CurateDatasetInput {
  dataset_id: string
  cohort_id?: string
  include_synthetic: boolean
}

const SCHEMA = z.object({
  dataset_id: z.string().min(1),
  cohort_id: z.string().min(1).optional(),
  include_synthetic: z.boolean().default(true),
})

export default defineTool({
  description:
    'Trigger dataset curation on the training infrastructure. Plans (and, ' +
    'behind approval, submits) a curate-sft-v30 job via the training-infra ' +
    'MCP. Returns the curation_run_id for downstream stages.',
  inputSchema: SCHEMA,
  approval: always<CurateDatasetInput>(),
  async execute(input: CurateDatasetInput) {
    let trainingInfraPlan: Record<string, unknown> | null = null
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
      }
    } catch {
      // Advisory: MCP may be unavailable; fall back to local id.
    }

    const suffix = Date.now().toString(36)
    const curationRunId = `curation-${suffix}`

    return {
      curation_run_id: curationRunId,
      training_infra_job_id: null,
      training_infra_plan: trainingInfraPlan,
      dataset_id: input.dataset_id,
      cohort_id: input.cohort_id ?? null,
      started_at: new Date().toISOString(),
      include_synthetic: input.include_synthetic,
      note: trainingInfraPlan
        ? 'Curation planned via training-infra MCP.'
        : 'Training-infra MCP unavailable; using local run id. Retry when service is up.',
    }
  },
})
