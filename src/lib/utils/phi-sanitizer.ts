/**
 * Utility functions for sanitizing potentially sensitive information (PHI)
 * before logging or other processing where raw PHI should not be exposed.
 * These are basic implementations and should be reviewed and potentially
 * enhanced based on specific PHI identification needs and organizational policies.
 */

/**
 * A general-purpose redaction function for text fields that might contain
 * user input or model-generated content, which is presumed to be PHI in the
 * context of the MentalLLaMA integration.
 *
 * @param text The text to sanitize.
 * @returns A standard redacted placeholder if the text is not null/empty,
 *          otherwise returns an empty string or a representation for empty.
 */
export function redactPotentialPhi(text: string | undefined | null): string {
  if (text === null || text === undefined || text.trim() === '') {
    // Return empty string or a specific placeholder like '[EMPTY_CONTENT]'
    // if distinguishing between empty and redacted is important.
    return ''
  }
  // Using a generic placeholder for any non-empty potentially sensitive text.
  return '[USER_OR_MODEL_TEXT_REDACTED]'
}

/**
 * Sanitizes an array of message objects, typically used in chat contexts.
 * It redacts the 'content' field of each message.
 *
 * @param messages An array of message objects, each with a 'content' field.
 * @returns A string representation of the sanitized messages, suitable for logging.
 *          Each message's content will be redacted.
 */
export function sanitizeMessagesForLogging(
  messages:
    | Array<{ role: string; content: string } | unknown>
    | undefined
    | null,
): string {
  if (!messages || messages.length === 0) {
    return '[NO_MESSAGES]'
  }
  try {
    return messages
      .map((msg, index) => {
        if (
          typeof msg === 'object' &&
          msg !== null &&
          'role' in msg &&
          'content' in msg
        ) {
          const content = typeof msg.content === 'string' ? msg.content : ''
          return `Message ${index + 1} (Role: ${msg.role || 'unknown'}): ${redactPotentialPhi(content)}`
        }
        return `Message ${index + 1} (Role: unknown): [CONTENT_REDACTED]`
      })
      .join('\\n')
  } catch {
    // Fallback in case message structure is unexpected
    return '[MESSAGES_REDACTION_ERROR]'
  }
}

/**
 * Sanitizes a generic object by redacting string values that might contain PHI.
 * This is a naive implementation that redacts all string values.
 * For more targeted sanitization, specify keys to redact or improve detection logic.
 *
 * @param data The object to sanitize.
 * @returns A string representation of the object with sensitive string values redacted.
 */
export function sanitizeObjectForLogging(
  data: Record<string, unknown> | undefined | null,
): string {
  if (!data) {
    return '[NO_DATA_OBJECT]'
  }
  try {
    const sanitizedObject: Record<string, unknown> = {}
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key]
        if (typeof value === 'string') {
          sanitizedObject[key] = redactPotentialPhi(value)
        } else if (typeof value === 'object' && value !== null) {
          // Optionally, could recurse or use a more generic placeholder for nested objects
          sanitizedObject[key] = '[OBJECT_DATA]'
        } else {
          sanitizedObject[key] = value
        }
      }
    }
    return JSON.stringify(sanitizedObject)
  } catch {
    return '[OBJECT_REDACTION_ERROR]'
  }
}
