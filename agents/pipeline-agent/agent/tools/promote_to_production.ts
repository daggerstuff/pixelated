import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { storeMemory } from '../foresight-client.js'

// Final approval gate — promote to production. Only reachable after
// Gate 4 resolves positively.

interface PromoteToProductionInput {
  staging_release_id: string
  image_tag: string
  release_notes?: string
}

export default defineTool({
  description:
    'Promote a model to the production environment. Only callable after ' +
    'Gate 4 has resolved with an approval. Returns the production release ' +
    'identifier. The orchestrator transitions to Monitor after deploy.',
  inputSchema: z.object({
    staging_release_id: z.string().min(1),
    image_tag: z.string().min(1),
    release_notes: z.string().max(2000).optional(),
  }),
  async execute(input: PromoteToProductionInput) {
    const productionReleaseId = `release-${input.staging_release_id}`
    const stored = await storeMemory({
      content: JSON.stringify({
        type: 'production_promotion',
        production_release_id: productionReleaseId,
        staging_release_id: input.staging_release_id,
        image_tag: input.image_tag,
        release_notes: input.release_notes ?? null,
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
      deploy_target: 'docker_compose',
      deployed_at: new Date().toISOString(),
      release_notes: input.release_notes ?? null,
      _provenance_stored: stored !== null,
      deploy_stub: {
        note:
          'Automated rollout is not wired. The fleet runs from ' +
          'agents/deploy/docker-compose.yaml on the fleet host; promote by ' +
          'pinning AGENT_IMAGE_TAG to this release and re-running ' +
          '`make deploy`.',
      },
    }
  },
})
