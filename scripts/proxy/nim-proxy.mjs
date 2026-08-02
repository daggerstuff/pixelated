/**
 * Minimal NIM proxy for Cursor/BYOK.
 *
 * - Spaces out requests per api key
 * - Dedupes concurrent identical requests
 * - Strips noisy headers before forwarding
 */

import http from 'node:http'

const PORT = 8080
const NIM_BASE = 'https://integrate.api.nvidia.com'
const MIN_INTERVAL_MS = 900

const queue = new Map()
const MAX_BODY_BYTES = 2 * 1024 * 1024

function normalizeBody(raw) {
  if (!raw || typeof raw !== 'object') return raw
  if (typeof raw.trim === 'function' && raw.trim().startsWith('{')) {
    try { raw = JSON.parse(raw) } catch {}
  }
  if (typeof raw !== 'object' || raw === null) return raw
  const copy = { ...raw }
  delete copy.logprobs
  delete copy.top_logprobs
  delete copy.user
  delete copy.custom_inputs
  delete copy.custom_generation_context
  delete copy.nvext
  if (Array.isArray(copy.messages)) {
    copy.messages = copy.messages.map((m) => {
      if (!m || typeof m !== 'object') return m
      const out = { ...m }
      delete out.metadata
      delete out.custom_fields
      return out
    })
  }
  return copy
}

function serialize(body) { return JSON.stringify(body) }

function enqueue(key, task) {
  const existing = queue.get(key)
  if (!existing) {
    queue.set(key, { pending: [task], running: false })
    runNext(key)
    return
  }
  existing.pending.push(task)
  runNext(key)
}

function runNext(key) {
  const item = queue.get(key)
  if (!item || item.running || !item.pending.length) return
  item.running = true
  const { resolve, body } = item.pending.shift()
  setTimeout(async () => {
    try {
      const result = await forward(body)
      resolve({ ok: true, data: result })
    } catch (error) {
      resolve({ ok: false, error })
    } finally {
      item.running = false
      runNext(key)
    }
  }, MIN_INTERVAL_MS)
}

async function forward(body) {
  const url = new URL(body.path, NIM_BASE)
  const headers = { ...body.headers }
  delete headers['content-length']
  delete headers['host']

  return new Promise((resolve, reject) => {
    const proxyReq = http.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: body.method,
        headers,
        timeout: body.timeoutMs ?? 120_000,
      },
      (proxyRes) => {
        const chunks = []
        proxyRes.on('data', (c) => chunks.push(c))
        proxyRes.on('end', () => {
          const raw = Buffer.concat(chunks)
          resolve({
            statusCode: proxyRes.statusCode,
            headers: proxyRes.headers,
            body: raw,
          })
        })
        proxyRes.on('error', reject)
      },
    )
    proxyReq.on('error', reject)
    proxyReq.setTimeout(body.timeoutMs ?? 120_000, () => {
      proxyReq.destroy()
      reject(new Error('upstream timeout'))
    })
    if (body.payload) proxyReq.write(body.payload)
    proxyReq.end()
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(serialize({ status: 'ok', queuedKeys: queue.size }))
    return
  }

  if (req.method !== 'POST') {
    res.writeHead(404)
    res.end('not found')
    return
  }

  let raw = ''
  req.setEncoding('utf8')
  for await (const chunk of req) raw += chunk

  if (req.headers['content-length'] && Number(req.headers['content-length']) > MAX_BODY_BYTES) {
    res.writeHead(413)
    res.end(JSON.stringify({ error: 'request too large' }))
    return
  }

  let body
  try { body = raw ? JSON.parse(raw) : {} } catch {
    res.writeHead(400)
    res.end(JSON.stringify({ error: 'invalid json' }))
    return
  }

  const apiKey = String(req.headers['authorization'] || req.headers['x-api-key'] || '')
  const key = apiKey || '_anon'
  const reduced = normalizeBody(body)
  const upstreamPath = url.pathname + url.search
  const payload = serialize(reduced)

  enqueue(key, {
    body: {
      method: req.method,
      path: upstreamPath,
      headers: req.headers,
      payload,
      timeoutMs: 120_000,
    },
    resolve({ ok, data, error }) {
      if (!ok) {
        res.writeHead(502)
        res.end(JSON.stringify({ error: 'upstream error', detail: String(error) }))
        return
      }
      res.writeHead(data.statusCode, {
        'content-type': data.headers['content-type'] || 'application/json',
        connection: 'close',
      })
      res.end(data.body)
    },
  })
})

server.on('clientError', (err, socket) => {
  try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n') } catch {}
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`NIM proxy listening on http://127.0.0.1:${PORT}`)
  console.log(`Forwarding to ${NIM_BASE}`)
  console.log(`Min spacing: ${MIN_INTERVAL_MS}ms`)
})
