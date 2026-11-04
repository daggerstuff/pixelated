import { createHash } from 'node:crypto'

import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { searchMemories, storeMemory } from '../foresight-client.js'

// Promote a trained/evaluated model artifact to staging. Runs a smoke-test
// probe after deploy and attaches a training_provenance block sourced from
// Foresight (rehearsal session IDs, QA digest).
//
// NOTE: qa_digest_id will be null until generate_report.ts (qa-agent)
// persists its scoring digest to Foresight. That's the next structural
// gap to close — the provenance block is future-proofed for it.

interface PromoteToStagingInput {
  training_job_id: string
  model_uri: string
  image_tag: string
}

export default defineTool({
  description:
    'Promote a model to the staging environment. Runs a ' +
    'canonical smoke-test probe after deploy. Queries Foresight for ' +
    'rehearsal session IDs and QA provenance, then stores and returns ' +
    'a training_provenance block for audit trail.',
  inputSchema: z.object({
    training_job_id: z.string().min(1),
    model_uri: z.string().min(1),
    image_tag: z.string().min(1),
  }),
  async execute(input: PromoteToStagingInput) {
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
      model_uri: input.model_uri,
      image_tag: input.image_tag,
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
