/**
 * The synthetic-client reply path and the transcript-grounded coaching surface.
 *
 * Both are **structure only**. The 2026-11-11 grant allows the journey surfaces
 * to be built as structure and forbids authoring the content they depend on:
 * the client persona, its therapeutic model, the wording of its replies, the
 * coaching rubric, the competency framework, and the feedback copy are all
 * owner decisions.
 *
 * A plausible synthetic-client reply is the single most damaging thing this
 * phase could ship, because a trainee cannot tell it from a real one. This
 * module therefore has no branch that produces reply text at all:
 *
 *  - `requestClientReply` is the seam where a reply would be generated. It
 *    reads the real transcript and returns `not-approved`, never a reply.
 *  - `buildCoachingReport` is the seam where coaching would be assembled. It
 *    returns the blockers it is waiting on, never a score or a sentence of
 *    feedback.
 *
 * The reply and coaching decisions are separate blockers with the same owner,
 * because a model can be approved for one and not the other.
 *
 * Lives beside the pages rather than in `lib/` because the granted area is
 * `apps/web/src/pages/training/**`; the leading underscore keeps Astro's router
 * from treating it as a route (the same convention as `_session-load-state.ts`).
 */

/**
 * A product decision a journey surface is waiting on.
 *
 * Owners are roles, not people: a role survives staff changes and tells a
 * reviewer who unblocks the surface.
 */
export interface ScaffoldBlocker {
  /** Stable machine-readable id, so a reviewer can grep for the decision. */
  readonly id: string
  /** The role that owns the decision. */
  readonly owner: string
  /** One sentence the trainee reads first. */
  readonly headline: string
  /** Why the surface cannot do the thing yet. */
  readonly detail: string
}

/**
 * There is no approved synthetic-client model.
 *
 * Nothing here describes a persona, a therapeutic orientation, or a reply. The
 * absence is the point: a trainee must never be shown a sentence that could be
 * mistaken for a client's.
 */
export const SYNTHETIC_CLIENT_REPLY_BLOCKER: ScaffoldBlocker = {
  id: 'synthetic-client-reply-not-approved',
  owner: 'Clinical content owner',
  headline: 'Awaiting the approved synthetic-client model',
  detail:
    'A client response cannot be told apart from a real one, so this path emits none. The client persona, the therapeutic model behind it, and the wording of its replies are the clinical content owner’s decision. Only trainee messages are stored until that model is approved.',
}

/**
 * There is no approved coaching model.
 *
 * The coaching rubric, the competency framework, the thresholds, and the
 * feedback wording are all the owner's. Nothing in this module scores a
 * response, ranks a competency, or writes feedback copy.
 */
export const COACHING_MODEL_BLOCKER: ScaffoldBlocker = {
  id: 'coaching-model-not-approved',
  owner: 'Clinical content owner',
  headline: 'Awaiting the approved coaching model',
  detail:
    'The coaching rubric, the competency framework, and the wording of the feedback are the clinical content owner’s decision. This surface produces no score, no rating, and no feedback until that model is approved.',
}

/**
 * The stored transcript is one-sided, which limits what coaching could ground in.
 *
 * `training_session_messages` stores trainee messages. A client turn would only
 * exist once a synthetic-client model is approved, so coaching assembled today
 * would be grounded in half a conversation. Recorded as a separate blocker
 * because approving coaching without a client model would still leave this.
 */
export const COACHING_TRANSCRIPT_BLOCKER: ScaffoldBlocker = {
  id: 'coaching-transcript-one-sided',
  owner: 'Clinical content owner',
  headline: 'The transcript is one-sided',
  detail:
    'Only trainee messages are stored. Client turns arrive with the synthetic-client model, so coaching grounded in this transcript today would be grounded in half a conversation.',
}

/** One persisted message, as the training session read path returns it. */
export interface TranscriptMessage {
  readonly id: string
  readonly content: string
  readonly createdAt: string
}

/**
 * What a surface may say about the transcript it read.
 *
 * Deliberately mechanical: counts and timestamps. No interpretation, no
 * sentiment, no competence signal — those would be the coaching model.
 */
export interface TranscriptSummary {
  readonly messageCount: number
  readonly firstMessageAt: string | null
  readonly lastMessageAt: string | null
  /**
   * Always zero: no client turn is stored, because no synthetic-client model
   * has been approved. The literal type makes that a compile-time fact rather
   * than a comment a later edit can drift away from.
   */
  readonly clientTurnCount: 0
}

export const summarizeTranscript = (
  messages: readonly TranscriptMessage[],
): TranscriptSummary => {
  const first = messages[0]?.createdAt ?? null
  const last = messages[messages.length - 1]?.createdAt ?? null

  return {
    messageCount: messages.length,
    firstMessageAt: first,
    lastMessageAt: last,
    clientTurnCount: 0,
  }
}

/**
 * The input a reply generator would receive once a model is approved.
 *
 * `sessionId` is absent until the page has a session to point at; the reply
 * path reports the same refusal either way rather than inventing one.
 */
export interface ClientReplyRequest {
  readonly sessionId: string | undefined
  readonly transcript: readonly TranscriptMessage[]
}

/**
 * The reply path's only outcome until a model is approved.
 *
 * There is no `ready` variant on purpose. A reply has to be *returned* by this
 * module to reach the transcript, and no branch here returns one, so the
 * absence is structural rather than a convention. The approved implementation
 * adds a variant; it does not rewrite the call site.
 */
export interface ClientReplyOutcome {
  readonly status: 'not-approved'
  readonly blocker: ScaffoldBlocker
  readonly transcript: TranscriptSummary
}

/**
 * Ask the reply path for the client response to the current transcript.
 *
 * This is the seam a model call would sit behind. It reads the transcript so the
 * surface can report what it would have been grounded in, and then refuses: the
 * `status` is the only thing a caller can branch on.
 */
export const requestClientReply = async (
  request: ClientReplyRequest,
): Promise<ClientReplyOutcome> => ({
  status: 'not-approved',
  blocker: SYNTHETIC_CLIENT_REPLY_BLOCKER,
  transcript: summarizeTranscript(request.transcript),
})

/** The input a coaching assembler would receive once a model is approved. */
export interface CoachingRequest {
  readonly sessionId: string | undefined
  readonly transcript: readonly TranscriptMessage[]
}

/**
 * The coaching surface's only outcome until a model is approved.
 *
 * As with the reply path there is no `ready` variant, so no score, rating,
 * rubric line, or feedback sentence can reach a trainee through this module.
 */
export interface CoachingOutcome {
  readonly status: 'not-approved'
  readonly blockers: readonly ScaffoldBlocker[]
  readonly transcript: TranscriptSummary
}

/**
 * Ask the coaching surface what it can say about this transcript.
 *
 * It can say what it read and which decisions it is waiting on. It cannot say
 * anything about the trainee's performance, because that is the approved
 * coaching model's job and no model exists.
 */
export const buildCoachingReport = async (
  request: CoachingRequest,
): Promise<CoachingOutcome> => ({
  status: 'not-approved',
  blockers: [COACHING_MODEL_BLOCKER, COACHING_TRANSCRIPT_BLOCKER],
  transcript: summarizeTranscript(request.transcript),
})
