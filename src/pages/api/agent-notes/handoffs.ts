import type { APIRoute } from "astro";
import { z } from "zod";

import { PersistentTurnLedger } from "../../../lib/agent-note-collab";
import { hasArtifactTurnAccess, resolveActorIdentity } from "./authorization";

const apiJsonHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
} as const;

const handoffPayloadSchema = z.object({
  artifactId: z.string().trim().min(1, "artifactId is required."),
  sourceTurnId: z.string().trim().min(1, "sourceTurnId is required."),
  target: z.string().trim().min(1, "target is required."),
  mode: z.enum(["agent", "human", "implementation-engine"]),
  urgency: z.enum(["low", "normal", "high"]),
  summary: z.string().trim().min(1, "summary is required."),
  blockers: z.array(z.string().trim()).default([]),
  requiredContext: z.array(z.string().trim()).default([]),
  constraints: z.array(z.string().trim()).default([]),
  nextPhase: z.enum(["Observe", "Propose", "Counter", "Synthesize", "Handoff"]),
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

function mapUrgencyToAction(urgency: string): "escalate" | "defer" | "commit" {
  if (urgency === "high") {
    return "escalate";
  }

  if (urgency === "normal") {
    return "defer";
  }

  return "commit";
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const body = await request.json();
    const parsed = handoffPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(400, "INVALID_PAYLOAD", "Handoff payload is invalid.", parsed.error.issues);
    }

    const ledger = getLedger();
    const source = await ledger.getById(parsed.data.sourceTurnId);
    if (!source) {
      return createErrorResponse(404, "NOT_FOUND", "Source turn not found.");
    }

    const actorContext = resolveActorIdentity(locals);
    const canAccessSource =
      actorContext.hasPrivilege ||
      hasArtifactTurnAccess([source], actorContext.actorId, actorContext.hasPrivilege);
    if (!canAccessSource) {
      return createErrorResponse(
        403,
        "FORBIDDEN",
        "You are not authorized to create handoffs for this source turn.",
      );
    }

    if (source.artifactId !== parsed.data.artifactId) {
      return createErrorResponse(
        403,
        "FORBIDDEN",
        "Source turn does not belong to the requested artifact.",
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          sourceTurnId: parsed.data.sourceTurnId,
          target: parsed.data.target,
          mode: parsed.data.mode,
          urgency: parsed.data.urgency,
          nextAction: mapUrgencyToAction(parsed.data.urgency),
          nextPhase: parsed.data.nextPhase,
          handoff: {
            summary: parsed.data.summary,
            blockers: parsed.data.blockers,
            requiredContext: parsed.data.requiredContext,
            constraints: parsed.data.constraints,
          },
          artifactId: parsed.data.artifactId,
          sourceArtifactId: source.artifactId,
          createdAt: new Date().toISOString(),
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
      error instanceof Error ? error.message : "An unexpected error occurred while handling handoff.",
    );
  }
};
