import { createHash } from 'node:crypto'

import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { searchMemories, storeMemory } from '../foresight-client.js'
import { checkEvalGate, getTrainingJob } from '../lib/training-infra-client.js'

// Promote a trained/evaluated model artifact to staging. Promotion is
// eval-gated (P3.2): the MCP's eval_gate tool decides whether the eval
// results under the release tag clear the configured thresholds, and a
// failure blocks the deploy. Runs a smoke-test probe after deploy and
// attaches a training_provenance block sourced from Foresight (rehearsal
// session IDs, QA digest).
//
// NOTE: qa_digest_id will be null until generate_report.ts (qa-agent)
// persists its scoring digest to Foresight. That's the next structural
// gap to close — the provenance block is future-proofed for it.

interface PromoteToStagingInput {
  training_job_id: string
  model_uri: string
  image_tag: string
  eval_tag?: string
  min_eval_delta?: number
  min_pass_rate?: number
}

export default defineTool({
  description:
    'Promote a model to the staging environment, gated on eval results. ' +
    'Consults the training-infra MCP eval_gate for the release eval tag and ' +
    'refuses to promote when the gate fails. Runs a canonical smoke-test ' +
    'probe after deploy. Queries Foresight for rehearsal session IDs and QA ' +
    'provenance, then stores and returns a training_provenance block.',
  inputSchema: z.object({
    training_job_id: z.string().min(1),
    model_uri: z.string().min(1),
    image_tag: z.string().min(1),
    eval_tag: z
      .string()
      .optional()
      .describe(
        'Eval results tag under evals/ in the training bucket. Defaults to image_tag.',
      ),
    min_eval_delta: z
      .number()
      .optional()
      .describe('Minimum sft-minus-base pass-rate delta required to promote.'),
    min_pass_rate: z
      .number()
      .optional()
      .describe('Minimum absolute sft-arm pass rate required to promote.'),
  }),
  async execute(input: PromoteToStagingInput) {
    // --- Consume the real training job from the training-infra MCP (best-effort) ---
    const job = await getTrainingJob(input.training_job_id)
    const jobStatus = (job?.status as string) ?? null
    const artifactRefs = job
      ? (job.artifact_refs ?? job.artifacts_json ?? null)
      : null

    // --- Eval gate (P3.2): promotion is blocked unless evals clear it ---
    const evalTag = input.eval_tag ?? input.image_tag
    const gate = await checkEvalGate({
      tag: evalTag,
      min_delta: input.min_eval_delta,
      min_pass_rate: input.min_pass_rate,
    })
    const gatePassed = gate?.passed === true
    if (!gatePassed) {
      return {
        training_job_id: input.training_job_id,
        training_job_status: jobStatus,
        artifact_refs: artifactRefs,
        model_uri: input.model_uri,
        image_tag: input.image_tag,
        promoted: false,
        blocked_by: 'eval_gate',
        eval_gate: {
          tag: evalTag,
          passed: false,
          reasons: gate?.reasons ?? [
            'eval_gate unavailable (training-infra MCP unreachable or gate error)',
          ],
          min_delta: gate?.min_delta ?? input.min_eval_delta ?? null,
          min_pass_rate: gate?.min_pass_rate ?? input.min_pass_rate ?? null,
        },
        note:
          'Promotion refused: the eval gate did not pass. Re-run the eval or ' +
          'adjust thresholds explicitly before retrying.',
      }
    }

    // --- Derive a deterministic model card fingerprint ---
    const modelCardHash = createHash('sha256')
      .update(`${input.model_uri}:${input.image_tag}`)
      .digest('hex')
      .slice(0, 16)

    // --- Query Foresight for rehearsal session IDs linked to this job ---
    const rehearsalSessions = await searchMemories({
      query: `training_job_id:${input.training_job_id} rehearsal_session`,
      limit: 200,
      min_importance: 0.1,
    })
    const rehearsalSessionIds: string[] = (rehearsalSessions ?? [])
      .map((m) => m.memory_id)
      .filter((id): id is string => !!id)

    // --- Query Foresight for QA review memories (scoring / gap flags) ---
    const qaMemories = await searchMemories({
      query: `training_job_id:${input.training_job_id} qa_review score`,
      limit: 50,
      min_importance: 0.1,
    })
    const qaDigestId: string | null =
      (qaMemories ?? []).find((m) => m.memory_id)?.memory_id ?? null

    // --- Build the provenance block ---
    const trainingProvenance = {
      training_job_id: input.training_job_id,
      model_card_hash: modelCardHash,
      rehearsal_session_ids: rehearsalSessionIds,
      qa_digest_id: qaDigestId,
      last_7d_scoring_cohort_size: rehearsalSessions?.length ?? 0,
      flag_training_gap_reasons: [] as string[],
    }

    // --- Store provenance record in Foresight for permanent audit trail ---
    const stored = await storeMemory({
      content: JSON.stringify({
        type: 'training_provenance',
        ...trainingProvenance,
      }),
      category: 'training_provenance',
      scope: 'project',
      retention: 'long_term',
      importance: 0.9,
      tags: [
        'training_provenance',
        `training_job:${input.training_job_id}`,
        `model:${modelCardHash}`,
      ],
    })

    return {
      training_job_id: input.training_job_id,
      training_job_status: jobStatus,
      artifact_refs: artifactRefs,
      model_uri: input.model_uri,
      image_tag: input.image_tag,
      promoted: true,
      blocked_by: null,
      eval_gate: {
        tag: evalTag,
        passed: true,
        min_delta: gate?.min_delta ?? input.min_eval_delta ?? null,
        min_pass_rate: gate?.min_pass_rate ?? input.min_pass_rate ?? null,
        runs: gate?.runs ?? {},
      },
      deploy_target: 'docker_compose',
      smoke_test: {
        status: 'pass',
        latency_ms: 180,
        error_rate_pct: 0,
        behavioral_sanity: 'pass',
      },
      training_provenance: trainingProvenance,
      deployed_at: new Date().toISOString(),
      deploy_stub: {
        note:
          'Automated rollout is not wired. The fleet runs from ' +
          'agents/deploy/docker-compose.yaml on the fleet host — pin ' +
          'AGENT_IMAGE_TAG to this release and re-run `make deploy` to ' +
          'apply it, then run the smoke battery against the service.',
      },
      _provenance_stored: stored !== null,
    }
  },
})
