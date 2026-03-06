import type { APIRoute } from "astro";
import { z } from "zod";

import {
  PersistentTurnLedger,
  type NoteTurn,
} from "../../../lib/agent-note-collab";
import {
  hasArtifactTurnAccess,
  filterTurnsByActorArtifactAccess,
  resolveActorIdentity,
} from "./authorization";

const apiJsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

type TurnQueryParams = {
  artifactId?: string;
  phase?: NoteTurn["phase"];
  role?: NoteTurn["role"] | string;
  requestedAction?: NoteTurn["requestedAction"] | string;
  limit?: number;
  sort?: "asc" | "desc";
};

const TURN_ROLE_VALUES = ["scribe", "critic", "synthesizer", "human-reviser", "router", "implementation-engine"] as const;
const TURN_PHASE_VALUES = ["Observe", "Propose", "Counter", "Synthesize", "Handoff"] as const;
const TURN_ACTION_VALUES = ["commit", "escalate", "ask-human", "merge", "defer", "handoff"] as const;

type LedgerCache = {
  filePath: string | undefined;
  instance: PersistentTurnLedger;
};

let cachedLedger: LedgerCache | null = null;

const getLedger = (): PersistentTurnLedger => {
  const filePath = process.env["AGENT_NOTE_COLLAB_LEDGER_PATH"];
  if (!cachedLedger || cachedLedger.filePath !== filePath) {
    cachedLedger = {
      filePath,
      instance: new PersistentTurnLedger({ filePath }),
    };
  }
  return cachedLedger.instance;
};

const turnSubmitSchema = z.object({
  turnId: z.string().default(""),
  artifactId: z.string().trim().min(1, "artifactId is required."),
  phase: z.enum(TURN_PHASE_VALUES),
  role: z.enum(TURN_ROLE_VALUES),
  agentId: z.string().trim().min(1, "agentId is required."),
  confidence: z.number().min(0, "confidence must be at least 0.").max(1, "confidence must be at most 1."),
  assumptions: z.array(z.string().trim().min(1, "assumptions cannot be blank.")).nonempty("At least one assumption is required."),
  openQuestions: z.array(z.string().trim().min(1, "openQuestions cannot be blank.")).nonempty("At least one open question is required."),
  decision: z.string().trim().min(1, "decision is required."),
  evidence: z.array(z.string().trim().min(1, "evidence cannot be blank.")).nonempty("At least one evidence item is required."),
  requestedAction: z.enum(TURN_ACTION_VALUES),
  replyTo: z.string().trim().optional(),
  expiresAt: z.string().trim().optional(),
});

const turnQuerySchema = z.object({
  artifactId: z.string().trim().optional(),
  phase: z.enum(TURN_PHASE_VALUES).optional(),
  role: z.string().trim().optional(),
  requestedAction: z.enum(TURN_ACTION_VALUES).optional(),
  limit: z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") {
        return undefined;
      }
      if (typeof value === "string") {
        const parsedLimit = Number.parseInt(value.trim(), 10);
        return Number.isNaN(parsedLimit) ? undefined : parsedLimit;
      }
      return value;
    },
    z.number().int().positive("limit must be a positive integer."),
  ).optional(),
  sort: z.enum(["asc", "desc"]).optional(),
});

function parseRequestUrl(rawUrl: URL | string | undefined): URL {
  if (!rawUrl) {
    throw new Error("Request URL is missing.");
  }

  if (rawUrl instanceof URL) {
    return rawUrl;
  }

  return new URL(rawUrl);
}

export const prerender = false;

function createErrorResponse(status: number, code: string, message: string, details?: unknown) {
  return new Response(
    JSON.stringify({
      ok: false,
      code,
      message,
      details,
    }),
    {
      status,
      headers: apiJsonHeaders,
    },
  );
}

export const GET: APIRoute = async ({ url, locals }) => {
  const parsedUrl = parseRequestUrl(url);

  const parsed = turnQuerySchema.safeParse({
    artifactId: parsedUrl.searchParams.get("artifactId") ?? undefined,
    phase: parsedUrl.searchParams.get("phase") ?? undefined,
    role: parsedUrl.searchParams.get("role") ?? undefined,
    requestedAction: parsedUrl.searchParams.get("requestedAction") ?? undefined,
    limit: parsedUrl.searchParams.get("limit") ?? undefined,
    sort: parsedUrl.searchParams.get("sort") ?? undefined,
  });

  if (!parsed.success) {
    return createErrorResponse(400, "INVALID_QUERY", "Turn query is invalid.", parsed.error.issues);
  }

  const query = parsed.data as TurnQueryParams;

  const queryParams: TurnQueryParams = {
    artifactId: query.artifactId,
    phase: query.phase,
    role: query.role,
    requestedAction: query.requestedAction,
    limit: query.limit,
    sort: query.sort,
  };

  const ledger = getLedger();
  const actorContext = resolveActorIdentity(locals);

  let turns: NoteTurn[];
  if (query.artifactId) {
    const turnsForArtifactAccess = await ledger.replayByArtifact(query.artifactId);
    if (!hasArtifactTurnAccess(turnsForArtifactAccess, actorContext.actorId, actorContext.hasPrivilege)) {
      return createErrorResponse(
        403,
        "FORBIDDEN",
        "You are not authorized to query this artifact.",
      );
    }
    turns = await ledger.list(queryParams);
  } else {
    if (!actorContext.actorId && !actorContext.hasPrivilege) {
      return createErrorResponse(
        403,
        "FORBIDDEN",
        "You are not authorized to query turns without an artifact filter.",
      );
    }

    const unscopedTurns = await ledger.list();
    turns = filterByQueryFilters(
      filterTurnsByActorArtifactAccess(unscopedTurns, actorContext.actorId),
      query,
    );
    turns = sortTurnsByUpdatedAt(turns, query.sort);
    if (query.limit) {
      turns = turns.slice(0, query.limit);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      data: {
        turns,
        count: turns.length,
      },
      query: queryParams,
    }),
    {
      status: 200,
      headers: apiJsonHeaders,
    },
  );
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const parsed = turnSubmitSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "INVALID_PAYLOAD", "Turn payload is invalid.", parsed.error.issues);
    }

    const ledger = getLedger();
    const actorContext = resolveActorIdentity(locals);
    const submitPayload =
      actorContext.actorId && !actorContext.hasPrivilege
        ? { ...parsed.data, agentId: actorContext.actorId }
        : parsed.data;

    const artifactTurns = await ledger.replayByArtifact(submitPayload.artifactId);
    const actorCanWrite =
      actorContext.hasPrivilege ||
      artifactTurns.length === 0 ||
      hasArtifactTurnAccess(artifactTurns, actorContext.actorId);

    if (!actorCanWrite) {
      return createErrorResponse(
        403,
        "FORBIDDEN",
        "You are not authorized to append to this artifact.",
      );
    }

    if (submitPayload.replyTo) {
      const parentTurn = await ledger.getById(submitPayload.replyTo);
      if (!parentTurn) {
        return createErrorResponse(
          404,
          "PARENT_NOT_FOUND",
          "replyTo turn was not found.",
        );
      }
      if (parentTurn.artifactId !== submitPayload.artifactId) {
        return createErrorResponse(
          403,
          "FORBIDDEN",
          "replyTo turn does not belong to the same artifact.",
        );
      }
    }

    const result = await ledger.submitTurn(submitPayload);

    if (!result.ok) {
      return createErrorResponse(422, "SUBMISSION_REJECTED", "Turn rejected by governance policy.", result.errors);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          action: result.action,
          nextPhase: result.nextPhase,
          turn: result.turn,
        },
      }),
      {
        status: 201,
        headers: apiJsonHeaders,
      },
    );
  } catch (error: unknown) {
    if (error instanceof SyntaxError) {
      return createErrorResponse(400, "INVALID_JSON", "Request body is not valid JSON.");
    }

    return createErrorResponse(
      500,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "An unexpected error occurred while processing the turn.",
    );
  }
};

function filterByQueryFilters(turns: NoteTurn[], query: TurnQueryParams): NoteTurn[] {
  return turns.filter((turn) => {
    if (query.phase && turn.phase !== query.phase) {
      return false;
    }

    if (query.role && turn.role !== query.role) {
      return false;
    }

    if (query.requestedAction && turn.requestedAction !== query.requestedAction) {
      return false;
    }

    return true;
  });
}

function sortTurnsByUpdatedAt(turns: NoteTurn[], sort: "asc" | "desc" = "desc") {
  const direction = sort === "asc" ? 1 : -1;
  return [...turns].sort(
    (left, right) =>
      (Date.parse(left.updatedAt) - Date.parse(right.updatedAt)) * direction,
  );
}
