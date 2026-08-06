/**
 * NIM stream proxy for Factory.ai Droid BYOK.
 *
 * Problem: NVIDIA NIM puts content and finish_reason in the same SSE chunk.
 * Droid's chunk processor skips content when finish_reason is set, resulting
 * in empty responses.
 *
 * Solution: This proxy sends non-streaming requests to NIM, then converts
 * the response to properly formatted SSE with content and finish_reason
 * in separate chunks.
 */

import http from 'node:http'
import https from 'node:https'

const PORT = 8081
const NIM_HOST = 'integrate.api.nvidia.com'
const NIM_BASE_PATH = '/v1'
const MAX_BODY_BYTES = 2 * 1024 * 1024
const UPSTREAM_TIMEOUT_MS = 300000 // 5 minutes for slow models like glm-5.2

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  // Collect request body
  let raw = ''
  req.setEncoding('utf8')
  for await (const chunk of req) raw += chunk

  if (raw.length > MAX_BODY_BYTES) {
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

  // Determine upstream path
  let upstreamPath = url.pathname + url.search
  if (upstreamPath.startsWith('/v1/')) upstreamPath = upstreamPath.slice(3)

  // Check if client requested streaming
  const clientOriginalStream = body.stream
  const clientWantsStream = clientOriginalStream === true
  console.log(`[${new Date().toISOString()}] Client stream=${clientOriginalStream} -> proxy will ${clientWantsStream ? 'emit SSE' : 'pass JSON'}`)

      // Force non-streaming request to NIM — strip stream_options too
      body.stream = false
      delete body.stream_options

      const payload = JSON.stringify(body)

  const options = {
    hostname: NIM_HOST,
    path: `${NIM_BASE_PATH}${upstreamPath}`,
    method: req.method,
    headers: {
      ...req.headers,
      host: NIM_HOST,
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(payload),
      accept: 'application/json',
    },
  }
  // Remove streaming-related headers
  delete options.headers['accept']
  options.headers['accept'] = 'application/json'

  console.log(`[${new Date().toISOString()}] ${req.method} ${NIM_HOST}${NIM_BASE_PATH}${upstreamPath} model=${body.model || '?'} stream=${body.stream} tools=${body.tools ? body.tools.length : 'none'}`)

  const upstreamReq = https.request(options, (upstreamRes) => {
    const chunks = []
    upstreamRes.on('data', (c) => chunks.push(c))
    upstreamRes.on('end', () => {
      const buf = Buffer.concat(chunks)
      const statusCode = upstreamRes.statusCode || 200
      const contentType = upstreamRes.headers['content-type'] || 'application/json'

      // If not JSON, pass through as-is
      if (!contentType.includes('application/json')) {
        res.writeHead(statusCode, { 'content-type': contentType })
        res.end(buf)
        return
      }

      let jsonResp
      try { jsonResp = JSON.parse(buf.toString()) } catch {
        // Can't parse — pass through
        res.writeHead(statusCode, { 'content-type': contentType })
        res.end(buf)
        return
      }

      // Debug: log the NIM response structure
      const choicesDebug = jsonResp.choices || []
      for (const ch of choicesDebug) {
        const msg = ch.message || {}
        const tc = msg.tool_calls || []
        const tcSummary = tc.length > 0 ? tc.map(t => `${t.function?.name || '?'}(${(t.function?.arguments||'').slice(0,80)})`).join('; ') : 'none'
        console.log(`[${new Date().toISOString()}] NIM response: finish=${ch.finish_reason} content_len=${(msg.content||'').length} tool_calls_count=${tc.length} tool_calls=[${tcSummary}] reasoning_len=${(msg.reasoning_content||'').length}`)
        // Log the full message when content and tool_calls are both empty
        if ((msg.content||'').length === 0 && tc.length === 0) {
          console.log(`[${new Date().toISOString()}] EMPTY RESPONSE - full message: ${JSON.stringify(msg).slice(0,500)}`)
        }
      }

      // If error response or client doesn't want stream, pass through as JSON
      if (statusCode !== 200 || jsonResp.error || !clientWantsStream) {
        res.writeHead(statusCode, { 'content-type': 'application/json' })
        res.end(JSON.stringify(jsonResp))
        return
      }

      // Convert non-streaming response to SSE format
      // Droid expects text/event-stream
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
      })

      const choices = jsonResp.choices || []
      const model = jsonResp.model || body.model || ''
      const id = jsonResp.id || `chatcmpl-${Date.now()}`
      const created = jsonResp.created || Math.floor(Date.now() / 1000)
      const usage = jsonResp.usage || null

      // Emit initial role chunk
      if (choices.length > 0 && choices[0].message) {
        const roleChunk = {
          id, object: 'chat.completion.chunk', created, model,
          choices: [{
            index: 0,
            delta: { role: 'assistant', content: '' },
            finish_reason: null,
            logprobs: null,
          }],
        }
        if (usage) roleChunk.usage = { ...usage, completion_tokens: 0 }
        res.write(`data: ${JSON.stringify(roleChunk)}\n\n`)
      }

      // Emit content chunks — split content into small pieces to simulate streaming
      for (const choice of choices) {
        const content = choice.message?.content || ''
        const reasoning = choice.message?.reasoning_content || ''
        const toolCalls = choice.message?.tool_calls

        // Emit reasoning content if present
        if (reasoning) {
          const reasoningChunk = {
            id, object: 'chat.completion.chunk', created, model,
            choices: [{
              index: choice.index || 0,
              delta: { reasoning_content: reasoning },
              finish_reason: null,
              logprobs: null,
            }],
          }
          res.write(`data: ${JSON.stringify(reasoningChunk)}\n\n`)
        }

        // Emit content as a single chunk (no finish_reason)
        if (content) {
          const contentChunk = {
            id, object: 'chat.completion.chunk', created, model,
            choices: [{
              index: choice.index || 0,
              delta: { content },
              finish_reason: null,
              logprobs: null,
            }],
          }
          res.write(`data: ${JSON.stringify(contentChunk)}\n\n`)
        }

        // Emit tool_calls if present (OpenAI streaming format)
        if (toolCalls && toolCalls.length > 0) {
          for (let i = 0; i < toolCalls.length; i++) {
            const tc = toolCalls[i]
            const toolCallChunk = {
              id, object: 'chat.completion.chunk', created, model,
              choices: [{
                index: choice.index || 0,
                delta: {
                  tool_calls: [{
                    index: i,
                    id: tc.id,
                    type: tc.type || 'function',
                    function: {
                      name: tc.function?.name || '',
                      arguments: tc.function?.arguments || '',
                    },
                  }],
                },
                finish_reason: null,
                logprobs: null,
              }],
            }
            res.write(`data: ${JSON.stringify(toolCallChunk)}\n\n`)
          }
        }

        // Emit finish chunk (no content)
        const finishChunk = {
          id, object: 'chat.completion.chunk', created, model,
          choices: [{
            index: choice.index || 0,
            delta: {},
            finish_reason: choice.finish_reason || 'stop',
            logprobs: null,
          }],
        }
        res.write(`data: ${JSON.stringify(finishChunk)}\n\n`)
      }

      // Emit final usage chunk (empty choices)
      if (usage) {
        const usageChunk = {
          id, object: 'chat.completion.chunk', created, model,
          choices: [],
          usage,
        }
        res.write(`data: ${JSON.stringify(usageChunk)}\n\n`)
      }

      // Done
      res.write('data: [DONE]\n\n')
      res.end()

      console.log(`[${new Date().toISOString()}] Response sent: ${choices.length} choice(s), usage=${JSON.stringify(usage)}`)
    })

    upstreamRes.on('error', (err) => {
      console.error(`[${new Date().toISOString()}] upstream error: ${err}`)
      if (!res.headersSent) {
        res.writeHead(502)
        res.end(JSON.stringify({ error: 'upstream error', detail: String(err) }))
      }
    })
  })

  upstreamReq.on('error', (err) => {
    console.error(`[${new Date().toISOString()}] request error: ${err}`)
    if (!res.headersSent) {
      res.writeHead(502)
      res.end(JSON.stringify({ error: 'upstream error', detail: String(err) }))
    }
  })

  upstreamReq.setTimeout(UPSTREAM_TIMEOUT_MS, () => {
    upstreamReq.destroy()
    if (!res.headersSent) {
      res.writeHead(504)
      res.end(JSON.stringify({ error: 'upstream timeout' }))
    }
  })

  upstreamReq.write(payload)
  upstreamReq.end()
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`NIM stream proxy listening on http://127.0.0.1:${PORT}`)
  console.log(`Forwarding to https://${NIM_HOST}${NIM_BASE_PATH}`)
  console.log('Converts non-streaming NIM responses to SSE format')
})
