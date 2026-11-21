import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { storeMemory } from '../foresight-client.js'
import { checkEvalGate } from '../lib/training-infra-client.js'

// Final approval gate — promote to production. Only reachable after
// Gate 4 resolves positively, and it re-checks the eval gate (P3.2) so a
// production promotion can never outrun the eval deltas.

interface PromoteToProductionInput {
  staging_release_id: string
  image_tag: string
  release_notes?: string
  eval_tag?: string
  min_eval_delta?: number
  min_pass_rate?: number
}

export default defineTool({
  description:
    'Promote a model to the production environment. Only callable after ' +
    'Gate 4 has resolved with an approval, and re-checks the eval gate for ' +
    'the release so promotion cannot outrun the eval deltas. Returns the ' +
    'production release identifier. The orchestrator transitions to Monitor ' +
    'after deploy.',
  inputSchema: z.object({
    staging_release_id: z.string().min(1),
    image_tag: z.string().min(1),
    release_notes: z.string().max(2000).optional(),
    eval_tag: z
      .string()
      .optional()
      .describe(
        'Eval results tag under evals/ in the training bucket. Defaults to image_tag.',
      ),
    min_eval_delta: z
      .number()
      .optional()
      .describe('Minimum sft-minus-base pass-rate delta required.'),
    min_pass_rate: z
      .number()
      .optional()
      .describe('Minimum absolute sft-arm pass rate required.'),
  }),
  async execute(input: PromoteToProductionInput) {
    const evalTag = input.eval_tag ?? input.image_tag
    const gate = await checkEvalGate({
      tag: evalTag,
      min_delta: input.min_eval_delta,
      min_pass_rate: input.min_pass_rate,
    })
    if (gate?.passed !== true) {
      return {
        staging_release_id: input.staging_release_id,
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
          'Production promotion refused: the eval gate did not pass for ' +
          `${evalTag}. Re-run the eval or adjust thresholds explicitly.`,
      }
    }

    const productionReleaseId = `release-${input.staging_release_id}`
    const stored = await storeMemory({
      content: JSON.stringify({
        type: 'production_promotion',
        production_release_id: productionReleaseId,
        staging_release_id: input.staging_release_id,
        image_tag: input.image_tag,
        release_notes: input.release_notes ?? null,
        eval_gate: { tag: evalTag, passed: true },
      }),
      category: 'fact',
      scope: 'project',
      retention: 'long_term',
      importance: 0.9,
      tags: [
        'production_promotion',
        `staging:${input.staging_release_id}`,
        `image:${input.image_tag}`,
      ],
    })
    return {
      production_release_id: productionReleaseId,
      staging_release_id: input.staging_release_id,
      image_tag: input.image_tag,
      promoted: true,
      blocked_by: null,
      eval_gate: {
        tag: evalTag,
        passed: true,
        min_delta: gate.min_delta,
        min_pass_rate: gate.min_pass_rate,
        runs: gate.runs ?? {},
      },
      deploy_target: 'docker_compose',
      deployed_at: new Date().toISOString(),
      release_notes: input.release_notes ?? null,
      _provenance_stored: stored !== null,
      deploy_stub: {
        note:
          'Automated rollout is not wired. The fleet runs from ' +
          'agents/deploy/docker-compose.yaml on the fleet host; promote by ' +
          'pinning AGENT_IMAGE_TAG to this release and re-running ' +
          '`make -f Makefile.agents deploy`.',
      },
    }
  },
})
