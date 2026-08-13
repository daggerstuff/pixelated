// Express middleware bridge for the session-agent.
//
// Mounts four routes on the existing Express server at /eve/v1/session/*:
//
//   POST   /session/start              -> begin or resume a session
//   POST   /session/:id/message        -> forward a trainee turn
//   GET    /session/:id/stream         -> Server-Sent Events stream
//   POST   /session/:id/intervene      -> supervisor injection
//
// The file imports the agent's compiled http channel via runtime fetch
// against the bundled eve build output. All session logic lives inside
// the eve agent, not here.

import { Router, type Request, type Response as ExpressResponse } from 'express'

type BodyInit = {
  method: string
  headers: Record<string, string>
  body?: string
}

async function fetchUpstream(
  origin: string,
  path: string,
  req: Request,
): Promise<Response> {
  const url = new URL(path, origin)
  const init: BodyInit = {
    method: req.method,
    headers: { 'content-type': 'application/json' },
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = JSON.stringify(req.body ?? {})
  }
  return fetch(url, init)
}

async function sendUpstreamBody(
  res: ExpressResponse,
  upstream: Response,
): Promise<void> {
  res.status(upstream.status)
  // Forward the upstream media type instead of letting Express default to
  // text/html, so proxied JSON bodies are never interpreted as HTML by the
  // browser (prevents reflected XSS via user-controlled session ids).
  res.setHeader(
    'Content-Type',
    upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
  )
  res.send(await upstream.text())
}

export function mountSessionAgentRouter(
  opts: {
    agentOrigin: string // base URL where the eve agent listens, e.g. http://127.0.0.1:2000
    requireApiKey?: () => boolean
  } = { agentOrigin: 'http://127.0.0.1:2000' },
): Router {
  const router = Router()

  router.post('/session/start', async (req, res: ExpressResponse) => {
    if (opts.requireApiKey && !opts.requireApiKey()) {
      res.status(403).send('forbidden')
      return
    }
    const upstream = await fetchUpstream(
      opts.agentOrigin,
      '/eve/v1/session',
      req,
    )
    await sendUpstreamBody(res, upstream)
  })

  router.post('/session/:id/message', async (req, res: ExpressResponse) => {
    if (opts.requireApiKey && !opts.requireApiKey()) {
      res.status(403).send('forbidden')
      return
    }
    const upstream = await fetchUpstream(
      opts.agentOrigin,
      `/eve/v1/session/${req.params.id}`,
      req,
    )
    await sendUpstreamBody(res, upstream)
  })

  router.post('/session/:id/intervene', async (req, res: ExpressResponse) => {
    if (opts.requireApiKey && !opts.requireApiKey()) {
      res.status(403).send('forbidden')
      return
    }
    const upstream = await fetchUpstream(
      opts.agentOrigin,
      `/eve/v1/session/${req.params.id}`,
      req,
    )
    await sendUpstreamBody(res, upstream)
  })

  // SSE forwarder; pass-through.
  router.get('/session/:id/stream', async (req, res: ExpressResponse) => {
    if (opts.requireApiKey && !opts.requireApiKey()) {
      res.status(403).send('forbidden')
      return
    }
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')

    const upstream = await fetchUpstream(
      opts.agentOrigin,
      `/eve/v1/session/${req.params.id}/stream`,
      req,
    )
    if (!upstream.body) {
      res.status(204).end()
      return
    }
    const reader = upstream.body.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(Buffer.from(value))
    }
    res.end()
  })

  return router
}
