import { RequestedAction, TurnPhase, TurnValidationError, validateTurn, NoteTurn } from "./turn-log";
import { routeTurn, type HandoffPolicy } from "./route";

export type SortOrder = "asc" | "desc";

export type TurnQuery = {
  artifactId?: string;
  phase?: TurnPhase;
  role?: string;
  requestedAction?: RequestedAction;
  limit?: number;
  sort?: SortOrder;
};

export type TurnLedger = {
  append: (turn: NoteTurn) => void;
  list: (query?: TurnQuery) => NoteTurn[];
  nextTurnIdForArtifact: (artifactId: string) => string;
  getById: (turnId: string) => NoteTurn | undefined;
  replayByArtifact: (artifactId: string, asOf?: string) => NoteTurn[];
  openQuestionCount: (artifactId: string) => number;
};

export type TurnSubmissionError = {
  code: string;
  message: string;
};

export type TurnSubmissionResult = {
  ok: true;
  turn: NoteTurn;
  nextPhase?: string;
  action: "accept" | "retry" | "escalate";
};

export type TurnSubmissionFailure = {
  ok: false;
  errors: TurnSubmissionError[];
};

type TurnLedgerOptions = {
  policy?: HandoffPolicy;
};

const MAX_RETRY_COUNTER_KEY = "agent-note-collab:retry";

const nowIso = () => new Date().toISOString();

function toQueryTimestamp(value?: string): number | undefined {
  if (!value) return undefined;

  const millis = Date.parse(value);
  if (Number.isNaN(millis)) {
    return undefined;
  }

  return millis;
}

function sortTurns(turns: NoteTurn[], sort: SortOrder): NoteTurn[] {
  const direction = sort === "desc" ? -1 : 1;

  return [...turns].sort((left, right) => {
    const leftUpdated = Date.parse(left.updatedAt);
    const rightUpdated = Date.parse(right.updatedAt);
    return (leftUpdated - rightUpdated) * direction;
  });
}

function clampLimit(limit?: number): number {
  if (!Number.isFinite(limit) || limit <= 0) return Number.MAX_SAFE_INTEGER;
  return Math.floor(limit);
}

function normalizeRole(value: string): string {
  return value.trim();
}

function normalizeRequestedAction(value: string): string {
  return value.trim();
}

export function createTurnRecord(
  input: {
    turnId: string;
    artifactId: string;
    phase: TurnPhase;
    role: NoteTurn["role"];
    agentId: string;
    confidence: number;
    assumptions: string[];
    openQuestions: string[];
    decision: string;
    evidence: string[];
    requestedAction: RequestedAction;
    replyTo?: string;
    expiresAt?: string;
  },
  now: string = nowIso(),
): NoteTurn {
  return {
    ...input,
    turnId: input.turnId.trim(),
    artifactId: input.artifactId.trim(),
    role: input.role,
    agentId: input.agentId.trim(),
    confidence: input.confidence,
    assumptions: input.assumptions.map((item) => item.trim()).filter(Boolean),
    openQuestions: input.openQuestions.map((item) => item.trim()).filter(Boolean),
    decision: input.decision.trim(),
    evidence: input.evidence.map((item) => item.trim()).filter(Boolean),
    requestedAction: input.requestedAction,
    replyTo: input.replyTo?.trim() || undefined,
    expiresAt: input.expiresAt?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export class InMemoryTurnLedger implements TurnLedger {
  private readonly turnsByArtifact = new Map<string, NoteTurn[]>();
  private readonly attemptsByTurn = new Map<string, number>();
  private readonly turnCache = new Map<string, NoteTurn>();
  private readonly policy: HandoffPolicy;

  constructor(options?: TurnLedgerOptions) {
    this.policy = options?.policy ?? {
      minimumConfidenceForHandoff: 0.75,
      escalateOnOpenQuestions: 3,
      escalateOnMissingEvidence: true,
      maxRetriesBeforeEscalation: 2,
    };
  }

  private upsertTurn(turn: NoteTurn): void {
    const turns = this.turnsByArtifact.get(turn.artifactId) ?? [];
    this.turnsByArtifact.set(turn.artifactId, [...turns, turn]);
    this.turnCache.set(turn.turnId, turn);
  }

  append(turn: NoteTurn): void {
    validateTurn(turn);
    this.upsertTurn(turn);
  }

  nextTurnIdForArtifact(artifactId: string): string {
    const safeArtifactId = artifactId.trim();
    const turns = this.turnsByArtifact.get(safeArtifactId) ?? [];
    const count = turns.length + 1;
    return `${safeArtifactId}#turn-${count.toString().padStart(5, "0")}`;
  }

  list(query: TurnQuery = {}): NoteTurn[] {
    const normalizedArtifact = query.artifactId?.trim();
    const normalizedRole = query.role ? normalizeRole(query.role) : undefined;
    const normalizedAction = query.requestedAction ? normalizeRequestedAction(query.requestedAction) : undefined;
    const sort = query.sort ?? "desc";
    const limit = clampLimit(query.limit);
    const phase = query.phase;

    const sourceTurns = normalizedArtifact
      ? this.turnsByArtifact.get(normalizedArtifact) ?? []
      : Array.from(this.turnsByArtifact.values()).flat();

    const filtered = sourceTurns.filter((turn) => {
      if (phase && turn.phase !== phase) return false;
      if (normalizedRole && turn.role !== normalizedRole) return false;
      if (normalizedAction && turn.requestedAction !== normalizedAction) return false;
      return true;
    });

    return sortTurns(filtered, sort).slice(0, limit);
  }

  getById(turnId: string): NoteTurn | undefined {
    return this.turnCache.get(turnId.trim());
  }

  replayByArtifact(artifactId: string, asOf?: string): NoteTurn[] {
    const safeArtifact = artifactId.trim();
    const turns = this.turnsByArtifact.get(safeArtifact) ?? [];
    const asOfEpoch = toQueryTimestamp(asOf);

    if (asOfEpoch === undefined) return sortTurns(turns, "asc");

    return sortTurns(
      turns.filter((turn) => {
        const updatedAt = Date.parse(turn.updatedAt);
        return !Number.isNaN(updatedAt) && updatedAt <= asOfEpoch;
      }),
      "asc",
    );
  }

  openQuestionCount(artifactId: string): number {
    return (this.turnsByArtifact.get(artifactId.trim()) ?? []).reduce((count, turn) => {
      const next = turn.openQuestions.length;
      return count + next;
    }, 0);
  }

  submitTurn(input: Parameters<typeof createTurnRecord>[0]): TurnSubmissionResult | TurnSubmissionFailure {
    const artifactId = input.artifactId.trim();
    const turnId = input.turnId.trim() || this.nextTurnIdForArtifact(artifactId);
    const now = nowIso();
    const turn = createTurnRecord({ ...input, turnId }, now);
    const retryKey = `${artifactId}:${turn.replyTo || MAX_RETRY_COUNTER_KEY}`;
    const retries = this.attemptsByTurn.get(retryKey) ?? 0;
    const route = routeTurn(turn, retries, this.policy);
    this.attemptsByTurn.set(retryKey, retries + 1);

    if (route.action !== "accept") {
      return {
        ok: false,
        errors: [
          {
            code: route.action.toUpperCase(),
            message: route.reason,
          },
        ],
      };
    }

    this.attemptsByTurn.delete(retryKey);
    this.append(turn);
    return { ok: true, turn, action: route.action, nextPhase: route.nextPhase };
  }
}

export function formatTurnError(error: unknown): TurnSubmissionFailure {
  if (error instanceof TurnValidationError) {
    return {
      ok: false,
      errors: error.issues.map((item) => ({
        code: item.code,
        message: item.message,
      })),
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      errors: [{ code: "INTERNAL_ERROR", message: error.message }],
    };
  }

  return {
    ok: false,
    errors: [{ code: "UNKNOWN_ERROR", message: "An unknown error occurred while submitting the turn." }],
  };
}
