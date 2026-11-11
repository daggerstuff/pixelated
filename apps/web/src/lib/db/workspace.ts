/**
 * The platform's default workspace, shared by every path that creates a user.
 *
 * `db/migrations/010_create_workspaces_table.sql` seeds this workspace and
 * `db/migrations/011_add_workspace_id_to_users.sql` backfills every existing
 * user onto it before enforcing `users.workspace_id NOT NULL`. Any code that
 * inserts a `users` row must therefore resolve this workspace first: writing a
 * row without it raises PostgreSQL `23502` and makes the identity unusable.
 *
 * Two callers need the same slug — first-login provisioning
 * (`lib/auth/user-identity.ts`) and registration (`UserManager.createUser`) —
 * so it lives here rather than being repeated as a literal in both.
 */

/** Slug of the workspace a user with no organisation assignment belongs to. */
export const DEFAULT_WORKSPACE_SLUG = 'personal'

/**
 * Raised when a user row cannot be written because no default workspace exists
 * to satisfy `users.workspace_id NOT NULL`.
 *
 * Callers answer this deliberately (a named 4xx on the registration route)
 * rather than letting the missing row surface as an unhandled `500`.
 */
export class WorkspaceResolutionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceResolutionError'
  }
}
