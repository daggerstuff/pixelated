# Memory Scope Model

## Overview

Memory in Pixelated Empathy is **always scoped** to prevent data leakage between
users, accounts, and workspaces. The scope is **derived server-side** from the
authenticated user's identity — never trusted from client input.

This document defines the scope hierarchy, derivation rules, and the contract
between public API consumers and the internal memory service.

## Scope Dimensions

| Dimension     | Type     | Example         | Server-Derived | Description                            |
| ------------- | -------- | --------------- | -------------- | -------------------------------------- |
| `userId`      | required | `auth0\|abc123` | Yes            | The authenticated user's unique ID     |
| `accountId`   | optional | `acc_xyz`       | Yes            | Billing account / organization account |
| `workspaceId` | optional | `ws_42`         | Yes            | Workspace or team within an account    |

The following dimensions exist in the internal memory service but are **not
exposed** to public API consumers — they are internal-only:

| Dimension   | Internal Only | Description                                   |
| ----------- | ------------- | --------------------------------------------- |
| `orgId`     | Yes           | Organization scope for multi-tenant Foresight |
| `projectId` | Yes           | Project-level scope                           |
| `sessionId` | Yes           | Agent session scope                           |
| `agentId`   | Yes           | AI agent identity                             |
| `runId`     | Yes           | Execution run scope                           |

## Derivation Rules

Scope is always constructed via `toMemoryScope()` in
`src/pages/api/memory/_shared.ts`:

```
Scope = {
  userId:      token.userId,           // from JWT `sub` claim
  accountId:   token.accountId,        // from JWT `account_id` claim
  workspaceId: token.workspaceId,      // from JWT `workspace_id` claim
  includeShared: true                  // always include shared memories
}
```

**Key rules:**

1. **All scope dimensions come from the JWT or API key validation** — never from
   the HTTP request body, query parameters, or headers.
2. **`userId` is always required.** All memory operations filter primarily by
   userId.
3. **`accountId` is optional** — present for users with a billing/org account.
   When present, it additionally filters memories to that account's namespace.
4. **`workspaceId` is optional** — present for users in a multi-user workspace.
   When present, it additionally filters to that workspace.
5. **`includeShared` is always `true`** for the public API — shared/workspace
   memories are always visible alongside private ones.

## Isolation Guarantees

The scope model guarantees the following isolations:

| Scenario        | userId | accountId | Workspace | Isolation                          |
| --------------- | ------ | --------- | --------- | ---------------------------------- |
| Consumer user A | user-a | —         | —         | No collision — diff userId         |
| Consumer user B | user-b | —         | —         | No collision with user A           |
| Same account    | user-a | acc-1     | —         | Sees shared memories via accountId |
| Diff accounts   | user-a | acc-1     | —         | No collision — diff accountId      |
| Same workspace  | user-a | acc-1     | ws-1      | Sees workspace-shared memories     |
| Diff workspaces | user-a | acc-1     | ws-1      | No collision — diff workspaceId    |

## Public API Contract

All public memory endpoints accept scope **only via authentication** — the user
never passes `accountId`, `workspaceId`, or `orgId` directly.

### Request Flow

```
Client Request
     │
     ▼
Authentication (JWT / API Key)
     │
     ▼
getCurrentUser() → { id, accountId?, workspaceId?, role }
     │
     ▼
toMemoryScope(userId, accountId, workspaceId) → ProductMemoryScope
     │
     ▼
ProductMemoryGateway → toInternalScope() → InternalMemoryServiceClient
     │
     ▼
Internal Memory Service (Foresight / backend)
```

### Memory Visibility Model

- **Private memories**: Visible only to the owning user (`userId` match).
  Filtered by userId + accountId + workspaceId.
- **Shared memories**: Visible to all members of the same account/workspace.
  Filtered by accountId/workspaceId with `includeShared: true`.
- **Cross-tenant isolation**: Users in different accounts or workspaces never
  see each other's memories, regardless of shared vs. private status.

## Adding New Scope Dimensions

If a new scope dimension needs to be added (e.g., `integrationId` or `appId`):

1. Add the field to `InternalMemoryScopeInput` in
   `src/lib/server/internal-memory-service-client.ts`
2. Add serialization in `buildScopePayload()` / `buildScopeQuery()` in
   `src/lib/server/internal-memory-scope.ts`
3. Add the field to `ProductMemoryScope` in
   `src/lib/services/product-memory-gateway.ts`
4. Add the field to `toMemoryScope()` projection in
   `src/pages/api/memory/_shared.ts`
5. Extract the value from the JWT claims in `getCurrentUser()` in
   `src/lib/auth/index.ts`
6. Update the JWT signing logic to include the new claim
7. Add isolation tests for the new dimension
8. Update this document

## Key Files

| File                                               | Purpose                                        |
| -------------------------------------------------- | ---------------------------------------------- |
| `src/lib/auth/index.ts`                            | JWT token validation and user extraction       |
| `src/lib/auth/types.ts`                            | User and auth type definitions                 |
| `src/lib/server/internal-memory-service-client.ts` | Internal scope input type and service client   |
| `src/lib/server/internal-memory-scope.ts`          | Scope payload/query serialization              |
| `src/lib/services/product-memory-gateway.ts`       | Public product gateway with scope projection   |
| `src/pages/api/memory/_shared.ts`                  | Route helpers and `toMemoryScope()` derivation |
| `src/pages/api/memory/*.ts`                        | Individual API route handlers                  |
| `ai/api/mcp_server/memory_scope.py`                | Python-side scope model for MCP tools          |
