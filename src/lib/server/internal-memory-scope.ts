import type { InternalMemoryScopeInput } from "@/lib/server/internal-memory-service-client";

export function buildScopePayload(scope: InternalMemoryScopeInput) {
  return {
    user_id: scope.userId,
    account_id: scope.accountId,
    workspace_id: scope.workspaceId,
    org_id: scope.orgId,
    project_id: scope.projectId,
    session_id: scope.sessionId,
    agent_id: scope.agentId,
    run_id: scope.runId,
    include_shared: scope.includeShared ?? true,
  };
}

export function buildScopeQuery(scope: InternalMemoryScopeInput): URLSearchParams {
  const params = new URLSearchParams();
  params.set("user_id", scope.userId);
  if (scope.accountId) params.set("account_id", scope.accountId);
  if (scope.workspaceId) params.set("workspace_id", scope.workspaceId);
  if (scope.orgId) params.set("org_id", scope.orgId);
  if (scope.projectId) params.set("project_id", scope.projectId);
  if (scope.sessionId) params.set("session_id", scope.sessionId);
  if (scope.agentId) params.set("agent_id", scope.agentId);
  if (scope.runId) params.set("run_id", scope.runId);
  params.set("include_shared", String(scope.includeShared ?? true));
  return params;
}
