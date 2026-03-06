export type TurnPhase = "Observe" | "Propose" | "Counter" | "Synthesize" | "Handoff";

export type AgentRole =
  | "scribe"
  | "critic"
  | "synthesizer"
  | "human-reviser"
  | "router"
  | "implementation-engine";

export type RequestedAction =
  | "commit"
  | "escalate"
  | "ask-human"
  | "merge"
  | "defer"
  | "handoff";

export interface NoteTurn {
  turnId: string;
  artifactId: string;
  phase: TurnPhase;
  role: AgentRole;
  agentId: string;
  confidence: number;
  assumptions: string[];
  openQuestions: string[];
  decision: string;
  evidence: string[];
  requestedAction: RequestedAction;
  replyTo?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HandoffResult {
  nextAgent: string;
  summary: string;
  requiredContext: string[];
  mustKeepOpen: string[];
  constraints: string[];
  nextPhase: TurnPhase;
}

const PHASE_FLOW: Record<TurnPhase, TurnPhase> = {
  Observe: "Propose",
  Propose: "Counter",
  Counter: "Synthesize",
  Synthesize: "Handoff",
  Handoff: "Observe",
};

const ACTION_PHASE_RULES: Record<TurnPhase, readonly RequestedAction[]> = {
  Observe: ["ask-human", "escalate"],
  Propose: ["defer", "handoff"],
  Counter: ["defer", "handoff"],
  Synthesize: ["defer", "handoff"],
  Handoff: ["commit", "escalate"],
};

const ROLES: Record<AgentRole, true> = {
  scribe: true,
  critic: true,
  synthesizer: true,
  "human-reviser": true,
  router: true,
  "implementation-engine": true,
};

type ValidationIssue = {
  code: string;
  message: string;
};

export class TurnValidationError extends Error {
  constructor(public issues: ValidationIssue[]) {
    super("Turn validation failed");
    this.name = "TurnValidationError";
  }
}

function isValidConfidence(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function isNonEmptyList(value: string[]): boolean {
  return Array.isArray(value) && value.length > 0 && value.every((item) => item.trim().length > 0);
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

export function validateTurn(turn: NoteTurn): void {
  const issues: ValidationIssue[] = [];

  if (!turn.turnId.trim()) {
    issues.push({ code: "TURN_ID_REQUIRED", message: "turnId is required." });
  }

  if (!turn.artifactId.trim()) {
    issues.push({ code: "ARTIFACT_ID_REQUIRED", message: "artifactId is required." });
  }

  if (!turn.agentId.trim()) {
    issues.push({ code: "AGENT_ID_REQUIRED", message: "agentId is required." });
  }

  if (!isValidConfidence(turn.confidence)) {
    issues.push({
      code: "CONFIDENCE_OUT_OF_RANGE",
      message: "confidence must be between 0 and 1.",
    });
  }

  if (!turn.decision.trim()) {
    issues.push({ code: "DECISION_REQUIRED", message: "decision is required." });
  }

  if (!isNonEmptyList(turn.assumptions)) {
    issues.push({
      code: "ASSUMPTIONS_REQUIRED",
      message: "At least one assumption is required before turn acceptance.",
    });
  }

  if (!isNonEmptyList(turn.openQuestions)) {
    issues.push({
      code: "OPEN_QUESTIONS_REQUIRED",
      message: "At least one open question is required for explicit uncertainty capture.",
    });
  }

  if (!isNonEmptyList(turn.evidence)) {
    issues.push({
      code: "EVIDENCE_REQUIRED",
      message: "Add one or more evidence links or notes to support the turn.",
    });
  }

  if (!isIsoDate(turn.createdAt) || !isIsoDate(turn.updatedAt)) {
    issues.push({
      code: "TIMESTAMP_INVALID",
      message: "createdAt and updatedAt must be ISO8601 timestamps.",
    });
  }

  const allowedActions = ACTION_PHASE_RULES[turn.phase];
  if (!allowedActions.includes(turn.requestedAction)) {
    issues.push({
      code: "ACTION_PHASE_MISMATCH",
      message: `requestedAction '${turn.requestedAction}' is not valid for phase '${turn.phase}'.`,
    });
  }

  if (!ROLES[turn.role]) {
    issues.push({
      code: "INVALID_ROLE",
      message: `role '${turn.role}' is not a supported agent role.`,
    });
  }

  if (turn.expiresAt && !isIsoDate(turn.expiresAt)) {
    issues.push({ code: "EXPIRES_AT_INVALID", message: "expiresAt must be an ISO8601 timestamp." });
  }

  if (issues.length) {
    throw new TurnValidationError(issues);
  }
}

export function nextPhase(current: TurnPhase): TurnPhase {
  return PHASE_FLOW[current];
}
