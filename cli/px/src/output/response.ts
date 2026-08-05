export function formatInteractiveResponse(data: unknown): string {
  return formatData(data, 0)
}

function formatData(data: unknown, indent: number): string {
  const pad = '  '.repeat(indent)
  if (data === null) return `${pad}null`
  if (typeof data === 'string') return `${pad}${data}`
  if (typeof data === 'number') return `${pad}${String(data)}`
  if (typeof data === 'boolean') return `${pad}${String(data)}`
  if (Array.isArray(data)) {
    if (data.length === 0) return `${pad}[]`
    return data.map((item) => formatData(item, indent)).join('\n')
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length === 0) return `${pad}{}`
    return keys
      .map((key) => {
        const val = obj[key]
        if (val === null) return `${pad}${key}: null`
        if (typeof val === 'string') return `${pad}${key}: ${val}`
        if (typeof val === 'number') return `${pad}${key}: ${String(val)}`
        if (typeof val === 'boolean') return `${pad}${key}: ${String(val)}`
        return `${pad}${key}:\n${formatData(val, indent + 1)}`
      })
      .join('\n')
  }
  return `${pad}${String(data)}`
}

export function formatAsyncResponse(taskId: string, channel?: string): string {
  const ch = channel ?? '#slack-channel'
  return `Queued — task ${taskId}\nResults will be posted to ${ch}`
}

export function formatJsonResponse(data: unknown): string {
  return JSON.stringify(data, null, 2)
}
