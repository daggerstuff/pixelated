/**
 * URL sanitization utilities.
 *
 * Prevents javascript: and data: URI injection in href attributes.
 */

const SAFE_URL_PATTERN = /^(https?|ftp|mailto):/i

/**
 * Sanitize a URL for safe use in <a href="..."> attributes.
 *
 * Returns the original URL if it is safe, or '#' if it is not.
 */
export function sanitizeUrl(url: string): string {
	const trimmed = url.trim()
	if (!trimmed) {
		return '#'
	}
	if (SAFE_URL_PATTERN.test(trimmed)) {
		return trimmed
	}
	// Allow relative URLs (starting with /, ./, ../, or #)
	if (/^[/.#]/.test(trimmed)) {
		return trimmed
	}
	// Reject everything else (javascript:, data:, vbscript:, etc.)
	return '#'
}
