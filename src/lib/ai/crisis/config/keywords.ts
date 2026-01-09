// Crisis keyword configuration for cultural/idiomatic edge cases and euphemisms
// Merges built-in patterns with auto-generated cultural/15k datasets from Python integrator.

// Built-in suicide euphemisms (conservative base set)
const BUILTIN_SUICIDE_EUPHEMISMS: readonly string[] = [
    'unalive',
    'unalive myself',
    "don't want to live",
]

// Built-in safe idiomatic exclusions (conservative regex patterns)
const BUILTIN_SAFE_IDIOMATIC_EXCLUSIONS: readonly RegExp[] = [
    /\bkill(?:ed|ing)?\s+it\b/i, // "we killed it at the show"
    /\b(dying|die|died)\s+to\b/i, // "dying to see you"
    /\bdie of (?:laughter|laughing|boredom)\b/i,
    /\bsuicide\s+squad\b/i, // movie reference
    /\b(homework|traffic|commute|deadline|exam|emoji)\s+is\s+killing\s+me\b/i,
    /\b(?:reading|studying|learning|talking)\s+about\s+suicide\b/i,
    /\b(?:watch(?:ing)?|saw)\s+(?:a\s+)?(?:movie|film|article)\s+about\s+suicide\b/i,
]

/**
 * Attempt to load auto-generated keywords from Python integrator.
 * Falls back gracefully if generated module is not yet populated.
 */
function loadGeneratedKeywords(): {
    euphemisms: string[]
    exclusions: RegExp[]
} {
    try {
        // Use require for synchronous loading (Astro/build-time compatible)
        // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
        const generated = require('./generated.keywords.ts')
        return {
            euphemisms: Array.isArray(generated.SUICIDE_EUPHEMISMS)
                ? generated.SUICIDE_EUPHEMISMS
                : [],
            exclusions: Array.isArray(generated.SAFE_IDIOMATIC_EXCLUSIONS)
                ? generated.SAFE_IDIOMATIC_EXCLUSIONS
                : [],
        }
    } catch {
        // Silently fall back to built-ins if generated module is not available
        // This allows the app to function before the Python integrator runs
        return { euphemisms: [], exclusions: [] }
    }
}

const generated = loadGeneratedKeywords()

/**
 * Merged suicide euphemisms: built-ins + auto-generated from cultural datasets
 * Supports up to 15k+ curated entries once Python integrator populates generated.keywords.ts
 */
export const SUICIDE_EUPHEMISMS: readonly string[] = [
    ...BUILTIN_SUICIDE_EUPHEMISMS,
    ...generated.euphemisms,
]

/**
 * Merged safe idiomatic exclusions: built-ins + auto-generated from cultural datasets
 * Keeps patterns conservative to avoid suppressing real crisis signals.
 */
export const SAFE_IDIOMATIC_EXCLUSIONS: readonly RegExp[] = [
    ...BUILTIN_SAFE_IDIOMATIC_EXCLUSIONS,
    ...generated.exclusions,
]
