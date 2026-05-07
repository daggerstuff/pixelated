import type { InternalMemoryScopeInput } from '@/lib/server/internal-memory-service-client'

export function buildScopePayload(scope: InternalMemoryScopeInput) {
  const payload: Record<string, unknown> = {
    user_id: scope.userId,
    include_shared: scope.includeShared ?? true,
  }
  if (scope.accountId) payload.account_id = scope.accountId
  if (scope.workspaceId) payload.workspace_id = scope.workspaceId
  if (scope.orgId) payload.org_id = scope.orgId
  if (scope.projectId) payload.project_id = scope.projectId
  if (scope.sessionId) payload.session_id = scope.sessionId
  if (scope.agentId) payload.agent_id = scope.agentId
  if (scope.runId) payload.run_id = scope.runId
  return payload
}

export function buildScopeQuery(
  scope: InternalMemoryScopeInput,
): URLSearchParams {
  const params = new URLSearchParams()
  params.set('user_id', scope.userId)
  if (scope.accountId) params.set('account_id', scope.accountId)
  if (scope.workspaceId) params.set('workspace_id', scope.workspaceId)
  if (scope.orgId) params.set('org_id', scope.orgId)
  if (scope.projectId) params.set('project_id', scope.projectId)
  if (scope.sessionId) params.set('session_id', scope.sessionId)
  if (scope.agentId) params.set('agent_id', scope.agentId)
  if (scope.runId) params.set('run_id', scope.runId)
  params.set('include_shared', String(scope.includeShared ?? true))
  return params
}
