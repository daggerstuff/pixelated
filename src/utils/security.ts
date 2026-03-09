/**
 * Security utilities for input sanitization and validation.
 */

/**
 * Ensures a value is a string. Useful for sanitizing Express query parameters
 * which can be string | string[] | ParsedQs | ParsedQs[].
 * This prevents NoSQL injection attacks where an attacker passes an object
 * instead of a string to a MongoDB query.
 */
export const ensureString = (param: unknown): string => {
    if (Array.isArray(param)) {
        return ensureString(param[0])
    }
    if (typeof param === 'string') {
        return param
    }
    if (param && typeof param === 'object') {
        const values = Object.values(param)
        if (values.length > 0) {
            const firstValue = values[0]
            return typeof firstValue === 'string' ? firstValue : String(firstValue ?? '')
        }
    }
    return param !== undefined && param !== null ? String(param) : ''
}

/**
 * Ensures a value is a number, with an optional default value.
 */
export const ensureNumber = (param: unknown, defaultValue: number): number => {
    const value = ensureString(param)
    const num = parseInt(value, 10)
    return isNaN(num) ? defaultValue : num
}
