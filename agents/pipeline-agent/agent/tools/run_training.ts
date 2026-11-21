import { defineTool } from 'eve/tools'
import { always } from 'eve/tools/approval'
import { z } from 'zod'

import {
  planTrainingJob,
  submitTrainingJob,
} from '../lib/training-infra-client.js'

interface RunTrainingInput {
  curation_run_id: string
  model_id: string
  method: 'sft' | 'dpo' | 'grpo'
  hyperparams: {
    epochs: number
    batch_size: number
    learning_rate: number
  }
  launch_config?: string
  submit: boolean
}

export default defineTool({
  description:
    'Launch an SFT/DPO/GRPO training job on the training infrastructure. ' +
    'Plans a train-sft-latest job via the training-infra MCP, and when ' +
    'submit=true submits the approved plan_hash to get a real job id. ' +
    'Returns the training_infra_job_id for downstream monitoring.',
  inputSchema: z.object({
    curation_run_id: z.string().min(1),
    model_id: z.string().min(1),
    method: z.enum(['sft', 'dpo', 'grpo']).default('dpo'),
    hyperparams: z
      .object({
        // Max matches the train-sft-latest recipe override bound (recipes.yaml:
        // epochs {min: 1, max: 10}). A wider schema would accept values the MCP
        // rejects, turning a caller error into a confusing plan failure.
        epochs: z.number().int().min(1).max(10).default(3),
        batch_size: z.number().int().min(1).max(512).default(8),
        learning_rate: z.number().min(1e-7).max(1).default(5e-5),
      })
      .default(() => ({ epochs: 3, batch_size: 8, learning_rate: 5e-5 })),
    launch_config: z.string().optional(),
    submit: z.boolean().default(false),
  }),
  approval: always<RunTrainingInput>(),
  async execute(input: RunTrainingInput) {
    const method = input.method ?? 'dpo'
    const hp = input.hyperparams ?? {
      epochs: 3,
      batch_size: 8,
      learning_rate: 5e-5,
    }

    // Plan (side-effect free) a train-sft-latest job via the MCP.
    let trainingInfraPlan: Record<string, unknown> | null = null
    let trainingInfraJobId: string | null = null
    let submitError: string | null = null
    try {
      const planned = await planTrainingJob({
        recipe: 'train-sft-latest',
        inputs: {
          // The launch config is the only input the entrypoint receives: it
          // pins the release manifest and payload sha256 internally.
          launch_config:
            input.launch_config ??
            `docs/training/execution-2026-11-07/${input.curation_run_id}-launch-config.json`,
        },
        // learning_rate is deliberately NOT forwarded: train-sft-latest locks
        // it (invariant recipe_derived_lr) because the LR schedule comes from
        // the launch config, never from a caller. Sending it makes the MCP
        // reject the whole plan, so the caller's value is advisory only.
        overrides: { epochs: hp.epochs },
      })
      if (planned && planned.ok === true) {
        trainingInfraPlan = {
          plan_hash: planned.plan_hash,
          command: planned.command,
          est_cost_usd: planned.est_cost_usd,
          warnings: planned.warnings ?? [],
          recipe: 'train-sft-latest',
          epochs: hp.epochs,
          learning_rate_source: 'recipe',
        }
        // Submitting is gated behind approval and an explicit submit=true so a
        // planning call can never launch GPU spend by accident.
        if (input.submit && typeof planned.plan_hash === 'string') {
          const submitted = await submitTrainingJob({
            plan_hash: planned.plan_hash,
            requested_by: `pipeline-agent:${input.curation_run_id}`,
            idempotency_key: `train:${input.curation_run_id}:${input.model_id}`,
          })
          if (submitted && submitted.ok === true) {
            trainingInfraJobId = (submitted.job_id as string) ?? null
          } else {
            submitError =
              (submitted?.error as string) ?? 'submit_job returned no job id'
          }
        }
      } else if (planned && typeof planned.error === 'string') {
        // Surface the MCP's rejection reason instead of reporting the MCP as
        // unavailable, which would send the operator chasing the wrong problem.
        submitError = planned.error
      }
    } catch (err) {
      submitError = err instanceof Error ? err.message : String(err)
    }

    return {
      // No fabricated id: the registry job id is the only real handle, and it
      // is null until a plan is actually submitted.
      training_infra_job_id: trainingInfraJobId,
      training_infra_plan: trainingInfraPlan,
      submit_requested: input.submit,
      submit_error: submitError,
      curation_run_id: input.curation_run_id,
      model_id: input.model_id,
      method,
      status: trainingInfraJobId
        ? 'queued'
        : trainingInfraPlan
          ? 'planned'
          : submitError
            ? 'rejected'
            : 'unavailable',
      started_at: new Date().toISOString(),
      note: trainingInfraJobId
        ? 'Training submitted to the training-infra MCP; poll with check_training_job.'
        : trainingInfraPlan
          ? 'Training planned; pass submit=true (behind approval) to launch it.'
          : submitError
            ? `The MCP rejected this plan or submit: ${submitError}`
            : 'Training-infra MCP unavailable; no job was created.',
    }
  },
})
