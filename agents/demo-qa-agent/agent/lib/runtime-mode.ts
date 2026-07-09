/**
 * Runtime guard helpers for agents whose primary mode is
 * "Foresight-first, opt-in to the model".
 *
 * The default path is: read Foresight + tool results, return a structured
 * note that cites the memory IDs consulted. Anthropic is never called in
 * this mode, so the agent works even when ANTHROPIC_API_KEY is unset.
 *
 * The opt-in path: an inbound message that begins with the explicit prefix
 * `/ask-model` is treated as a normal LLM turn (stripped of the prefix).
 */

export const ASK_MODEL_PREFIX = '/ask-model'

/**
 * True iff the LLM should be invoked on this turn.
 *
 * Mirrors the contract documented in each agent's instructions.md:
 * `/ask-model` is opt-in. Anything else must be answered from Foresight /
 * tools only.
 */
export function isModelAllowed(message: unknown): boolean {
  if (typeof message !== 'string') return false
  return message.trimStart().startsWith(ASK_MODEL_PREFIX)
}

/**
 * Strip the `/ask-model` prefix and return the user message underneath.
 * If the prefix is absent, returns the input unchanged.
 */
export function stripAskModelPrefix(message: string): string {
  if (!isModelAllowed(message)) return message
  return message.replace(/^\s*\/ask-model\s*/, '').trim()
}

/**
 * Returns true iff the process is configured to invoke an Anthropic
 * Claude model. Intended for runtime diagnostics and for log messages that
 * explain why a turn is being answered Foresight-first.
 */
export function hasAnthropicCredentials(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/**
 * Optional Foresight-only stub reply for agents that want a uniform
 * "this turn is off the hot path" notice.
 */
export const FORESIGHT_FIRST_BOOT_NOTICE = `\
This agent is configured for Foresight-first mode.

- Default: every message is answered from Foresight + tools only.
  Anthropic is not called, so this works without ANTHROPIC_API_KEY.
- To invoke the LLM explicitly, prefix the message with /ask-model.

If you expected a normal LLM reply, prefix your next message with
${ASK_MODEL_PREFIX} or set ANTHROPIC_API_KEY in the deployment environment.`
