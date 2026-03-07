/**
 * PII Scrubber
 *
 * Utility for redacting Personally Identifiable Information (PII) from therapeutic transcripts.
 * Essential for HIPAA compliance and ensuring psychological safety in training sessions.
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('PIIScrubber')

export interface ScrubberOptions {
    maskType?: 'placeholder' | 'redacted' | 'randomized'
    enabledCategories?: PIICategory[]
    customReplacements?: Record<string, string>
}

export type PIICategory =
    | 'names'
    | 'emails'
    | 'phones'
    | 'addresses'
    | 'ssn'
    | 'dates'
    | 'financial'

const PII_PATTERNS: Record<PIICategory, RegExp> = {
    names: /\b(?:Mr\.|Ms\.|Mrs\.|Dr\.)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, // Simple name detection
    emails: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phones: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    addresses: /\b\d{1,5}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:St|Ave|Rd|Blvd|Ln|Ct|Dr)\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    dates: /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4})|(?:[A-Z][a-z]+\s+\d{1,2},\s+\d{4})\b/g,
    financial: /\b(?:\d{4}-){3}\d{4}\b/g, // Credit card format
}

const PLACEHOLDERS: Record<PIICategory, string> = {
    names: '[NAME]',
    emails: '[EMAIL]',
    phones: '[PHONE]',
    addresses: '[ADDRESS]',
    ssn: '[SSN]',
    dates: '[DATE]',
    financial: '[FINANCIAL]',
}

/**
 * Redacts PII from text based on configured categories
 */
export function scrubPII(text: string, options: ScrubberOptions = {}): string {
    if (!text) return text

    const {
        maskType = 'placeholder',
        enabledCategories = ['names', 'emails', 'phones', 'ssn'],
        customReplacements = {},
    } = options

    let scrubbedText = text

    // Apply custom replacements first
    for (const [target, replacement] of Object.entries(customReplacements)) {
        const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        scrubbedText = scrubbedText.replace(new RegExp(escapedTarget, 'g'), replacement)
    }

    // Apply category-based scrubbing
    for (const category of enabledCategories) {
        const pattern = PII_PATTERNS[category]
        if (!pattern) continue

        if (maskType === 'placeholder') {
            scrubbedText = scrubbedText.replace(pattern, PLACEHOLDERS[category])
        } else if (maskType === 'redacted') {
            scrubbedText = scrubbedText.replace(pattern, '[REDACTED]')
        }
    }

    logger.debug('Text scrubbed for PII', {
        originalLength: text.length,
        newLength: scrubbedText.length,
        categoriesUsed: enabledCategories,
    })

    return scrubbedText
}

/**
 * Scans text for PII without modifying it
 */
export function scanForPII(text: string): {
    found: boolean
    categories: PIICategory[]
    count: number
} {
    const result = {
        found: false,
        categories: [] as PIICategory[],
        count: 0,
    }

    for (const [category, pattern] of Object.entries(PII_PATTERNS)) {
        const matches = text.match(pattern)
        if (matches && matches.length > 0) {
            result.found = true
            result.categories.push(category as PIICategory)
            result.count += matches.length
        }
    }

    return result
}
