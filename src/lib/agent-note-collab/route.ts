import { NoteTurn, TurnPhase, nextPhase } from "./turn-log";

export type HandoffPolicy = {
  minimumConfidenceForHandoff: number;
  escalateOnOpenQuestions: number;
  escalateOnMissingEvidence?: boolean;
  maxRetriesBeforeEscalation: number;
};

const DEFAULT_POLICY: HandoffPolicy = {
  minimumConfidenceForHandoff: 0.75,
  escalateOnOpenQuestions: 3,
  escalateOnMissingEvidence: true,
  maxRetriesBeforeEscalation: 2,
};

export type RouteDecision =
  | { action: "accept"; nextPhase: TurnPhase }
  | { action: "retry"; nextPhase: TurnPhase; reason: string }
  | { action: "escalate"; nextPhase: "Handoff"; reason: string };

export function routeTurn(turn: NoteTurn, retryCount = 0, policy: HandoffPolicy = DEFAULT_POLICY): RouteDecision {
  if (turn.phase === "Observe") {
    return {
      action: "accept",
      nextPhase: nextPhase(turn.phase),
    };
  }

  if (turn.confidence < policy.minimumConfidenceForHandoff) {
    return {
      action: "retry",
      nextPhase: turn.phase,
      reason: "Confidence below minimum for handoff.",
    };
  }

  if (turn.openQuestions.length >= policy.escalateOnOpenQuestions) {
    return {
      action: "escalate",
      nextPhase: "Handoff",
      reason: "Open-question volume indicates unresolved ambiguity.",
    };
  }

  if (policy.escalateOnMissingEvidence && turn.evidence.length < 1) {
    return {
      action: "escalate",
      nextPhase: "Handoff",
      reason: "Evidence required before moving forward.",
    };
  }

  if (retryCount > policy.maxRetriesBeforeEscalation) {
    return {
      action: "escalate",
      nextPhase: "Handoff",
      reason: "Repeated retries exceeded policy threshold.",
    };
  }

  return { action: "accept", nextPhase: nextPhase(turn.phase) };
}
