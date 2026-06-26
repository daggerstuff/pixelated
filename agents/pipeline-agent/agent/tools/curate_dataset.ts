import { defineTool } from 'eve/tools'
import { z } from 'zod'

// Kick off dataset curation. Triggers the training-infra MCP job. Returns
// a `curation_run_id` the orchestrator uses to monitor progress.

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
    'Trigger dataset curation on the training infrastructure. Returns the ' +
    'curation_run_id and the resulting fingerprint for downstream stages.',
  inputSchema: SCHEMA,
  async execute(input: CurateDatasetInput) {
    return {
      curation_run_id: `curation-${Date.now().toString(36)}`,
      dataset_id: input.dataset_id,
      cohort_id: input.cohort_id ?? null,
      started_at: new Date().toISOString(),
      include_synthetic: input.include_synthetic,
      training_infra_stub: {
        note:
          'training-infra-mcp tool `curate_dataset` is not yet wired. ' +
          'When it is, the orchestrator should poll its status endpoint ' +
          'every 30 seconds with the returned run id.',
      },
    }
  },
})
