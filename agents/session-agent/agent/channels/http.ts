import { defineChannel, POST, GET } from 'eve/channels'

type MessageBody = {
  message: string
  trainee_id?: string
  scenario_id?: string
  session_id?: string
  resume?: boolean
  token?: string
}

// Web frontend entry point for the rehearsal session agent. The frontend posts
// trainee messages and supervisor interventions here, and subscribes to the
// /stream endpoint for live model output and tool events.
//
//   POST /message                 -> start or resume a session
//   GET  /sessions/:sessionId/stream -> NDJSON event stream for that session
//   POST /sessions/:sessionId/intervene -> supervisor intervenes mid-session

export default defineChannel({
  routes: [
    POST('/message', async (req, args) => {
      const body = (await req.json()) as MessageBody
      // from(address).send() creates a session when the address is unowned,
      // and resumes the existing session when the address is already bound.
      // See eve custom channels docs: "Only send() can create a session when
      // the address is unowned."
      const address = body.session_id ?? body.token ?? crypto.randomUUID()
      const session = await args.from(address).send(body.message, {
        auth: null,
      })
      return Response.json({ sessionId: session.id })
    }),

    GET('/sessions/:sessionId/stream', async (_req, args) => {
      // attachSession pins a fixed handle to the durable session ID; the first
      // operation (getEventStream) reports whether that ID is currently active.
      const session = args.attachSession(args.params.sessionId)
      const stream = await session.getEventStream({ startIndex: 0 })
      const reader = stream.getReader()
      const encoder = new TextEncoder()
      // Manually pipe the event stream into an NDJSON response. Passing the raw
      // ReadableStream to new Response() causes a socket hang-up in Nitro dev.
      const body = new ReadableStream<Uint8Array>({
        async pull(controller) {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            return
          }
          controller.enqueue(encoder.encode(JSON.stringify(value) + '\n'))
        },
        cancel() {
          void reader.cancel()
        },
      })
      return new Response(body, {
        headers: {
          'content-type': 'application/x-ndjson; charset=utf-8',
          'cache-control': 'no-store',
        },
      })
    }),

    POST('/sessions/:sessionId/intervene', async (req, args) => {
      const body = (await req.json()) as {
        supervisor_id: string
        message: string
      }
      // Send the supervisor's message on the same durable session ID so the
      // model can react to the intervention.
      const session = args.attachSession(args.params.sessionId)
      await session.send(`[SUPERVISOR ${body.supervisor_id}] ${body.message}`, {
        auth: null,
      })
      return Response.json({
        sessionId: args.params.sessionId,
        intervention: 'queued',
      })
    }),
  ],
})
