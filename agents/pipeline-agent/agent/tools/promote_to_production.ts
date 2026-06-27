import { defineTool } from 'eve/tools'
import { z } from 'zod'

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
    return {
      production_release_id: `release-${Date.now().toString(36)}`,
      staging_release_id: input.staging_release_id,
      image_tag: input.image_tag,
      deploy_namespace: 'pixelated-prod',
      deployed_at: new Date().toISOString(),
      k8s_mcp_stub: {
        note:
          'k8s-mcp tool `deploy_production` is not yet wired. Once wired, ' +
          'the orchestrator should record the release in Linear via the ' +
          'linear channel.',
      },
    }
  },
})
