/**
 * The faculty-review access path, up to the boundary of the missing relation.
 *
 * Faculty review means: a faculty member opens a training session and reviews
 * the trainee's work in it. That requires answering one question first — *which
 * sessions may this faculty member see?* — and the answer has to be a workspace
 * scope, because a faculty member is a member of an organization, not the
 * therapist of the sessions they review. `sessions` has no `workspace_id`, so
 * there is no column to scope by and no such query can be written.
 *
 * This module therefore stops at the boundary. It models the query shape the
 * surface will use once the relation exists, and refuses to run it. Three
 * things are deliberately absent:
 *
 *  - **No substitute scoping.** There is no `therapist_id` join, no
 *    client-side filter over a broader result set, and no "faculty sees all".
 *    Each of those would be an unscoped review surface — a tenant-boundary
 *    defect of exactly the kind this mission exists to prevent — while looking
 *    like a working feature.
 *  - **No session read at all.** The one read path that exists
 *    (`getTrainingSessionResponse`) scopes by `therapist_id`, so reusing it here
 *    would *be* the therapist-id join under another name. The surface reads no
 *    session data until the relation exists.
 *  - **No `ready` outcome.** `FacultyReviewOutcome` has one variant, `blocked`,
 *    so no branch of this module can hand a caller a list of sessions. The
 *    approved implementation adds a variant; it does not rewrite the surface.
 *
 * The blockers are structural, not engineering tickets to be worked around.
 * Each names the decision that would clear it and the role that owns it.
 *
 * Lives beside the pages rather than in `lib/` because the granted area is
 * `apps/web/src/pages/training/**`; the leading underscore keeps Astro's router
 * from treating it as a route (the same convention as `_session-load-state.ts`).
 */

/**
 * A product or platform decision a journey surface is waiting on.
 *
 * Owners are roles, not people: a role survives staff changes and tells a
 * reviewer who unblocks the surface.
 */
export interface ScaffoldBlocker {
  /** Stable machine-readable id, so a reviewer can grep for the decision. */
  readonly id: string
  /** The role that owns the decision. */
  readonly owner: string
  /** One sentence the reader sees first. */
  readonly headline: string
  /** Why the surface cannot do the thing yet. */
  readonly detail: string
}

/**
 * The only role the training surfaces grant faculty access to.
 *
 * `session.user.role` is an `AuthRole` — `admin | staff | therapist | user |
 * guest` (`apps/web/src/config/auth.config.ts`). `admin` is the name both
 * training pages already check and the only one the auth mapping can emit, so
 * the faculty access path uses it rather than inventing a fourth vocabulary.
 */
export const FACULTY_REVIEW_ROLE = 'admin' as const

/**
 * The migration that would close the missing relation.
 *
 * Named so a reviewer can see the exact change that unblocks the surface, and
 * named as a *proposal*: this mission may not write DDL or a migration, so the
 * file does not exist.
 */
export const CLOSING_MIGRATION = '018_add_workspace_id_to_sessions.sql'

/**
 * What that migration has to contain, and why the number is 018.
 *
 * 017 is the highest migration number present. Two files already share the
 * number 011, which is the fourth blocker below.
 */
export const CLOSING_MIGRATION_DETAIL =
  'Adds `sessions.workspace_id UUID REFERENCES workspaces(id)`, an index for the workspace-scoped review query, and a backfill policy for sessions that predate the column. The backfill policy — which workspace owns an existing session — is a data-ownership decision, not a default. This mission may not write it: no DDL and no migration are permitted here.'

/** There is no `sessions.workspace_id`, so there is nothing to scope by. */
export const FACULTY_REVIEW_SCOPE_BLOCKER: ScaffoldBlocker = {
  id: 'faculty-review-sessions-workspace-relation-missing',
  owner: 'Platform data owner',
  headline: 'Faculty review is not available',
  detail:
    'Training sessions are not linked to a workspace, so a faculty member cannot be scoped to the sessions they may review. The `sessions` table has no `workspace_id` column (`db/session.sql` declares it without one and no migration adds it), and the access path will not approximate that scope with a therapist-id join, a client-side filter, or a blanket view of every session.',
}

/** Three role vocabularies disagree about what a faculty member is. */
export const FACULTY_REVIEW_ROLE_BLOCKER: ScaffoldBlocker = {
  id: 'faculty-review-role-vocabulary-disjoint',
  owner: 'Identity owner',
  headline: 'Faculty access has no single role name',
  detail:
    'Three vocabularies disagree: `AuthRole` is `admin | staff | therapist | user | guest`, `UserRole` is `admin | therapist | patient | researcher | guest`, and `mapToUserRole` collapses everything else — including a literal `supervisor` — to `guest`. The training pages check `admin` because it is the one name all three can produce. Granting review to a role the mapping cannot emit would be unreachable UI; widening the mapping would change authorization for every consumer, so it is an owner decision.',
}

/** The checked-in schema file is not the migration-managed schema. */
export const FACULTY_REVIEW_SCHEMA_BLOCKER: ScaffoldBlocker = {
  id: 'faculty-review-session-schema-divergent',
  owner: 'Platform data owner',
  headline: 'The checked-in session schema is divergent',
  detail:
    '`db/session.sql` declares the `sessions` table by hand and is not generated from `db/migrations/`: it carries no `workspace_id`, and it does not carry tables later migrations add (for example `training_session_messages` from 017). A scoping column added through a migration would leave that file divergent, so it has to be reconciled in the same change.',
}

/** Two migration files share the number 011. */
export const FACULTY_REVIEW_MIGRATION_BLOCKER: ScaffoldBlocker = {
  id: 'faculty-review-migration-number-collision',
  owner: 'Platform data owner',
  headline: 'Two migrations share the number 011',
  detail:
    '`db/migrations/011_add_workspace_id_to_users.sql` and `db/migrations/011_create_audit_logs_table.sql` are both numbered 011, so a replay from scratch has no unambiguous order for that step. The scoping migration is therefore proposed as 018 — the next free number above 017 — and the collision has to be resolved before the set is replayed rather than worked around by picking a number silently.',
}

/**
 * Every blocker the faculty-review surface renders.
 *
 * All four are structural and independent: clearing one does not clear another,
 * and the surface stays blocked until each has an owner decision behind it.
 */
export const FACULTY_REVIEW_BLOCKERS: readonly ScaffoldBlocker[] = [
  FACULTY_REVIEW_SCOPE_BLOCKER,
  FACULTY_REVIEW_ROLE_BLOCKER,
  FACULTY_REVIEW_SCHEMA_BLOCKER,
  FACULTY_REVIEW_MIGRATION_BLOCKER,
]

/**
 * The input the access path would receive once the relation exists.
 *
 * `listSessionsInWorkspace` is the *only* query shape faculty review may use:
 * sessions filtered by the caller's workspace. It is passed in rather than
 * imported so the surface cannot quietly reach for the therapist-scoped read
 * path instead, and so a test can prove it is never called.
 */
export interface FacultyReviewRequest {
  /** The caller's role, as `session.user.role` reports it. */
  readonly role: string | null | undefined
  /** The caller's workspace, once the identity carries one. */
  readonly workspaceId: string | null | undefined
  /** The workspace-scoped session query that does not exist yet. */
  readonly listSessionsInWorkspace: (
    workspaceId: string,
  ) => Promise<readonly unknown[]>
}

/**
 * The access path's only outcome until the relation exists.
 *
 * There is no `ready` variant on purpose. A session list has to be *returned*
 * by this module to reach the surface, and no branch here returns one, so the
 * absence is structural rather than a convention.
 */
export interface FacultyReviewOutcome {
  readonly status: 'blocked'
  /** Whether the caller's role is the faculty role. */
  readonly canReview: boolean
  /**
   * The workspace the caller's sessions would be scoped to. `null` today: the
   * identity carries a workspace, but no session carries one to match.
   */
  readonly scopeWorkspaceId: string | null
  readonly blockers: readonly ScaffoldBlocker[]
}

/**
 * The query a caller must pass while the relation is missing.
 *
 * It throws instead of querying, so a future edit that reaches for it fails
 * closed in a test rather than returning an unscoped session list.
 */
export const refuseUnscopedSessionQuery = async (): Promise<
  readonly never[]
> => {
  throw new Error(
    'Faculty review must not query sessions while sessions.workspace_id does not exist',
  )
}

/**
 * Resolve what a faculty member may review.
 *
 * It may review nothing, and the outcome says why. `listSessionsInWorkspace` is
 * deliberately not called: every query shape available today is either
 * unscoped or therapist-scoped, and both are wrong for a faculty member.
 */
export const resolveFacultyReviewScope = (
  request: FacultyReviewRequest,
): FacultyReviewOutcome => ({
  status: 'blocked',
  canReview: request.role === FACULTY_REVIEW_ROLE,
  scopeWorkspaceId: request.workspaceId ?? null,
  blockers: FACULTY_REVIEW_BLOCKERS,
})
