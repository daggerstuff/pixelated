/**
 * Security Utilities
 *
 * Provides common functions for input sanitization and security-related operations.
 */

/**
 * Ensures a query parameter or input is a string, preventing NoSQL injection.
 *
 * MongoDB operators like { $ne: null } can be passed via Express query parameters
 * if they are parsed as objects. This utility forces the value to a string or
 * returns a safe default.
 *
 * @param param The input parameter to sanitize (usually from req.query)
 * @param defaultValue The value to return if sanitization fails (defaults to undefined)
 * @returns The sanitized string or defaultValue
 */
export function ensureString(param: unknown): string | undefined {
    if (typeof param === 'string') {
        return param
    }
    if (Array.isArray(param)) {
        const first = param[0]
        return typeof first === 'string' ? first : undefined
    }
    // Explicitly do NOT traverse objects to prevent NoSQL operator injection
    return undefined
}
