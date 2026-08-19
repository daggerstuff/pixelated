import type { AIMessage } from '../models/ai-types'

const TOOL_CALL_ID_MAX_LENGTH = 72
const TOOL_CALL_ARGS_MAX_LENGTH = 8_192

interface NormalizedToolCall {
  id?: string
  type?: string
  function?: {
    name?: string
    arguments?: string
  }
  name?: string
  arguments?: string
}

interface ToolCallContainer {
  tool_calls?: NormalizedToolCall[]
  [key: string]: unknown
}

const toRecord = (value: unknown): Record<string, unknown> => {
  if (value === null || value === undefined || typeof value !== 'object') {
    return {}
  }
  return value as Record<string, unknown>
}

const safeJsonParse = (value: string): unknown | null => {
  try {
    return JSON.parse(value)
  } catch (_error) {
    return null
  }
}

const repairJsonString = (value: string): unknown | null => {
  if (value.length > TOOL_CALL_ARGS_MAX_LENGTH * 2) {
    return null
  }
  const normalized = value
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/'/g, '"')
    .replace(/"([a-zA-Z0-9_]+)"\s*:/g, '"$1":')
  return safeJsonParse(normalized)
}

const normalizeArguments = (value: unknown): string => {
  if (typeof value === 'undefined') {
    return '{}'
  }
  if (typeof value === 'string') {
    const parsed = safeJsonParse(value) ?? repairJsonString(value)
    if (parsed === null) {
      return value.length > TOOL_CALL_ARGS_MAX_LENGTH ? value.slice(0, TOOL_CALL_ARGS_MAX_LENGTH) : value
    }
    const serialized = JSON.stringify(parsed)
    return serialized.slice(0, TOOL_CALL_ARGS_MAX_LENGTH)
  }
  try {
    return JSON.stringify(value).slice(0, TOOL_CALL_ARGS_MAX_LENGTH)
  } catch (_error) {
    return '{}'
  }
}

const normalizeToolCallId = (value: unknown, index: number): string => {
  const fallback = `tool_${index + 1}`
  if (typeof value !== 'string') {
    return fallback
  }
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, TOOL_CALL_ID_MAX_LENGTH)
  return normalized || fallback
}

const toNormalizedToolCall = (item: unknown, index: number): NormalizedToolCall | null => {
  const toolCall = toRecord(item)
  const functionData = toRecord(toolCall['function'])
  const name = typeof toolCall['name'] === 'string'
    ? toolCall['name']
    : typeof functionData['name'] === 'string'
      ? functionData['name']
      : `tool_${index + 1}`
  const rawArgs = (toolCall['arguments'] ?? functionData['arguments']) as string ?? '{}'
  return {
    id: normalizeToolCallId(toolCall['id'], index),
    type: typeof toolCall['type'] === 'string' ? toolCall['type'] : 'function',
    function: {
      name,
      arguments: normalizeArguments(rawArgs),
    },
    name,
    arguments: normalizeArguments(rawArgs),
  }
}

const toToolCalls = (value: unknown): NormalizedToolCall[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }
  const normalized = value
    .map((toolCall, index) => toNormalizedToolCall(toolCall, index))
    .filter((toolCall): toolCall is NormalizedToolCall => toolCall !== null)
  return normalized.length > 0 ? normalized : undefined
}

const normalizeMessageForToolCalls = (
  message: AIMessage | Record<string, unknown>,
  index: number,
): ToolCallContainer => {
  const normalized = { ...(toRecord(message) as ToolCallContainer) }
  const legacyFunctionCall = toRecord((message as Record<string, unknown>)['function_call'])
  const hasFunctionCallShape =
    typeof normalized.tool_calls === 'undefined' &&
    (typeof legacyFunctionCall['name'] === 'string' || typeof normalized['function_call'] === 'object')
  const hasToolCalls = Array.isArray(normalized.tool_calls)
  if (hasToolCalls) {
    normalized.tool_calls = toToolCalls(normalized.tool_calls)
    return normalized
  }
  if (hasFunctionCallShape) {
    const syntheticToolCall: NormalizedToolCall = {
      id: normalizeToolCallId(normalized['tool_call_id'], index),
      type: 'function',
      function: {
        name: typeof legacyFunctionCall['name'] === 'string' ? legacyFunctionCall['name'] : 'unknown',
        arguments: typeof legacyFunctionCall['arguments'] === 'string' ? legacyFunctionCall['arguments'] : '{}',
      },
      name: typeof legacyFunctionCall['name'] === 'string' ? legacyFunctionCall['name'] : 'unknown',
      arguments: typeof legacyFunctionCall['arguments'] === 'string' ? legacyFunctionCall['arguments'] : '{}',
    }
    normalized.tool_calls = [syntheticToolCall]
  }
  return normalized
}

export const normalizeToolCalls = (payload: unknown): unknown => {
  const record = toRecord(payload)
  if (record === null || typeof record !== 'object') {
    return payload
  }
  const messages = (payload as Record<string, unknown>)['messages']
  if (!Array.isArray(messages)) {
    return payload
  }
  const nextPayload = { ...(payload as Record<string, unknown>),
    messages: messages.map((message, index) => normalizeMessageForToolCalls(message as AIMessage | Record<string, unknown>, index)),
  }
}

export const extractToolCallSummary = (toolCall: unknown): string => {
  const normalized = toRecord(toolCall)
  const functionData = toRecord(normalized['function'])
  const functionName = typeof functionData['name'] === 'string'
    ? functionData['name']
    : typeof normalized['name'] === 'string'
      ? normalized['name']
      : 'tool'
  const rawArgs = typeof normalized['arguments'] === 'string'
    ? normalized['arguments']
    : typeof functionData['arguments'] === 'string'
      ? functionData['arguments']
      : '{}'
  return `${functionName}(${rawArgs})`
}
