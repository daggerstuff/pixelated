import { TurnPhase, AgentRole, RequestedAction } from "./turn-log";
import { getLedger } from "./server";

export interface CollaborationContext {
  artifactId: string;
  agentId: string;
  role: AgentRole;
  phase: TurnPhase;
}

/**
 * High-level integration helper for agents to record their collaboration turns.
 * Handles the mapping from raw agent output to structured collaboration turns.
 */
export async function recordAgentActivity(
  context: CollaborationContext,
  activity: {
    decision: string;
    confidence: number;
    assumptions?: string[];
    openQuestions?: string[];
    evidence?: string[];
    suggestedAction?: RequestedAction;
  }
) {
  const ledger = getLedger();

  const turn = {
    turnId: "", // Ledger will generate if empty
    artifactId: context.artifactId,
    agentId: context.agentId,
    role: context.role,
    phase: context.phase,
    decision: activity.decision,
    confidence: activity.confidence,
    assumptions: activity.assumptions || ["Default operational assumptions apply."],
    openQuestions: activity.openQuestions || [],
    evidence: activity.evidence || [],
    requestedAction: activity.suggestedAction || (context.phase === "Handoff" ? "commit" : "handoff"),
  };

  return await ledger.submitTurn(turn);
}

/**
 * Auto-scales or escalates based on agent performance metrics.
 * This can be hooked into agent post-processing loops.
 */
export function shouldEscalate(confidence: number, unresolvedQuestions: number): boolean {
  const MIN_CONFIDENCE = 0.85;
  const MAX_QUESTIONS = 3;

  return confidence < MIN_CONFIDENCE || unresolvedQuestions > MAX_QUESTIONS;
}
