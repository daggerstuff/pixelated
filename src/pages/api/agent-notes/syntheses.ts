import type { APIRoute } from "astro";
import { z } from "zod";

import { PersistentTurnLedger } from "../../../lib/agent-note-collab";
import { hasArtifactTurnAccess, resolveActorIdentity } from "./authorization";

const apiJsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

const synthesesRequestSchema = z.object({
  artifactId: z.string().trim().min(1, "artifactId is required."),
  maxTurns: z.number().int().positive().max(200).default(50),
  includeResolvedOpenQuestions: z.boolean().default(false),
});

const getLedger = () =>
  new PersistentTurnLedger({
    filePath: process.env["AGENT_NOTE_COLLAB_LEDGER_PATH"],
  });

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

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const parsed = synthesesRequestSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "INVALID_PAYLOAD", "Synthesis payload is invalid.", parsed.error.issues);
    }

    const ledger = getLedger();
    const actorContext = resolveActorIdentity(locals);
    const artifactTurns = await ledger.replayByArtifact(parsed.data.artifactId);
    if (!hasArtifactTurnAccess(artifactTurns, actorContext.actorId, actorContext.hasPrivilege)) {
      return createErrorResponse(
        403,
        "FORBIDDEN",
        "You are not authorized to request synthesis for this artifact.",
      );
    }

    const turns = artifactTurns.slice(-parsed.data.maxTurns);

    if (!turns.length) {
      return createErrorResponse(404, "NOT_FOUND", "No turns found for this artifact.");
    }

    const openQuestions = turns.flatMap((turn) => turn.openQuestions);
    const unresolvedQuestions = parsed.data.includeResolvedOpenQuestions
      ? openQuestions
      : openQuestions;
    const combinedDecision = turns
      .map((turn) => turn.decision.trim())
      .filter(Boolean)
      .join(" | ");

    const latestTurn = turns.at(-1);
    const summary = latestTurn
      ? {
          artifactId: parsed.data.artifactId,
          latestPhase: latestTurn.phase,
          latestRole: latestTurn.role,
          latestDecision: latestTurn.decision,
          turnCount: turns.length,
          openQuestions: unresolvedQuestions,
          summaryText: `${latestTurn.phase} has ${turns.length} turns in history; latest decision is: ${combinedDecision.slice(0, 600)}`,
        }
      : null;

    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          artifactId: parsed.data.artifactId,
          turnCount: turns.length,
          requestedWindow: parsed.data.maxTurns,
          openQuestions: unresolvedQuestions,
          synthesis: summary,
        },
      }),
      {
        status: 200,
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
      error instanceof Error ? error.message : "An unexpected error occurred while building synthesis.",
    );
  }
};
