export interface InvokeAgentToolOptions {
  endpoint: string
  tool: string
  body: unknown
  timeout: number
  async: boolean
}

export async function invokeAgentTool(
  options: InvokeAgentToolOptions,
): Promise<unknown> {
  const url = new URL(
    `/eve/v1/tools/${encodeURIComponent(options.tool)}`,
    options.endpoint,
  )
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeout)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(options.async ? { 'x-px-async': '1' } : {}),
      },
      body: JSON.stringify(options.body ?? {}),
      signal: controller.signal,
    })

    const text = await response.text()
    const payload = text.length > 0 ? JSON.parse(text) : null

    if (!response.ok) {
      throw new Error(
        `Agent request failed (${response.status} ${response.statusText}): ${text}`,
      )
    }

    return payload
  } finally {
    clearTimeout(timeout)
  }
}
