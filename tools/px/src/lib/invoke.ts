import {
  createEveSession,
  invokeViaEveSession,
  type EveSessionResult,
} from '../client/eve-session.js'

export interface InvokeAgentToolOptions {
  endpoint: string
  tool: string
  body: unknown
  timeout: number
  async: boolean
  authHeader?: string
}

/**
 * Invoke an agent tool via the Eve session API.
 *
 * Eve agents are conversational — they don't expose individual REST endpoints
 * per tool. Instead, we POST to /eve/v1/session with a message instructing the
 * agent to run the specified tool, then stream the NDJSON response to collect
 * the final assistant message.
 *
 * In async mode the session is created and handed off — the call returns as
 * soon as the agent accepts it, and the reply is delivered out of band (e.g.
 * to the configured Slack channel).
 */
export async function invokeAgentTool(
  options: InvokeAgentToolOptions,
): Promise<EveSessionResult> {
  const message = buildToolMessage(options.tool, options.body)

  if (options.async) {
    const { sessionId } = await createEveSession({
      endpoint: options.endpoint,
      message,
      timeoutMs: options.timeout,
      authHeader: options.authHeader,
    })
    return { sessionId, message: '' }
  }

  return invokeViaEveSession({
    endpoint: options.endpoint,
    message,
    timeoutMs: options.timeout,
    authHeader: options.authHeader,
  })
}

/**
 * Build a natural-language message that asks the agent to run a specific tool
 * with the given parameters.
 */
function buildToolMessage(tool: string, body: unknown): string {
  if (
    body &&
    typeof body === 'object' &&
    Object.keys(body as object).length > 0
  ) {
    return `Run the ${tool} tool with these parameters:\n${JSON.stringify(body, null, 2)}`
  }
  return `Run the ${tool} tool.`
}
