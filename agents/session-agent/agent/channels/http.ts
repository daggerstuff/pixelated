import { defineChannel, POST, GET } from "eve/channels";

type MessageBody = {
  message: string;
  trainee_id?: string;
  scenario_id?: string;
  session_id?: string;
  resume?: boolean;
  token?: string;
};

namespace _unused_part_types {
  // Reserved for the next slice: rich content (file uploads, etc). Kept here
  // so the discriminated type surface is documented even though it is not yet
  // exposed to the typechecker.
  export type FilePart = { type: "file"; data: unknown; mediaType: string };
  export type TextPart = { type: "text"; text: string };
}

// Web frontend entry point for the rehearsal session agent. The frontend posts
// trainee messages and supervisor interventions here, and subscribes to the
// /stream endpoint for live model output and tool events. This is the minimum
// viable surface to unblock the rest of the sprint:
//
//   POST /message                 -> start or resume a session
//   GET  /sessions/:id/stream     -> SSE event stream for that session
//   POST /sessions/:id/intervene  -> supervisor intervenes mid-session

export default defineChannel({
  routes: [
    POST("/message", async (req, { send }) => {
      const body = (await req.json()) as MessageBody;
      const token = body.token ?? `${body.trainee_id ?? "anon"}:${body.scenario_id ?? "default"}`;

      const session = await send(body.message, {
        auth: null,
        continuationToken: token,
      });

      return Response.json({ sessionId: session.id });
    }),

    GET("/sessions/:sessionId/stream", async (_req, { getSession, params }) => {
      const session = getSession(params.sessionId);
      const stream = await session.getEventStream();
      return new Response(stream, {
        headers: {
          "content-type": "text/event-stream; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }),

    POST("/sessions/:sessionId/intervene", async (req, { send, params }) => {
      const body = (await req.json()) as {
        supervisor_id: string;
        message: string;
      };
      // Send the supervisor's message on the same session id as the active
      // trainee session so the model can react to the intervention.
      await send(
        `[SUPERVISOR ${body.supervisor_id}] ${body.message}`,
        { auth: null, continuationToken: params.sessionId },
      );
      return Response.json({ sessionId: params.sessionId, intervention: "queued" });
    }),
  ],
});
