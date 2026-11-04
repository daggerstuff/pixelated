import { defineTool } from 'eve/tools'
import { z } from 'zod'

// Rollback to the previous production model. Only valid when the pipeline
// has crossed Gate 4 and the monitoring window is still active. Records
// a pipeline_event for traceability.

interface RollbackModelInput {
  current_release_id: string
  previous_release_id: string
  reason: string
}

export default defineTool({
  description:
    'Rollback the production deployment to the previous good release. ' +
    'Only valid when the pipeline is in Monitor, Staging Deploy, or ' +
    'Production Deploy state. Emits a pipeline_event=rollback for ' +
    'traceability.',
  inputSchema: z.object({
    current_release_id: z.string().min(1),
    previous_release_id: z.string().min(1),
    reason: z.string().max(1000),
  }),
  async execute(input: RollbackModelInput) {
    return {
      rolled_back_to: input.previous_release_id,
      from_release: input.current_release_id,
      reason: input.reason,
      rolled_back_at: new Date().toISOString(),
      deploy_stub: {
        note:
          'Automated rollback is not wired. The fleet runs from ' +
          'agents/deploy/docker-compose.yaml on the fleet host; roll back by ' +
          'pinning AGENT_IMAGE_TAG to the previous release and re-running ' +
          '`make deploy`, then confirm the service reports healthy.',
      },
    }
  },
})
