import type { GitHubView } from '@/types'

export const VERSION_COLOR = {
  major: 'bg-rose:15 text-rose-7 dark:text-rose-3',
  minor: 'bg-purple:15 text-purple-7 dark:text-purple-3',
  patch: 'bg-green:15 text-green-7 dark:text-green-3',
  pre: 'bg-teal:15 text-teal-7 dark:text-teal-3',
}

/**
 * Matches the input string against the rules in `UI.githubView.mainLogoOverrides`
 * or `UI.githubView.subLogoMatches`, and returns the matching URL/Icon.
 */
export function matchLogo(
  input: string,
  logos: GitHubView['mainLogoOverrides'],
) {
  for (const [pattern, logo] of logos) {
    if (typeof pattern === 'string') {
      if (input === pattern) {
        return logo
      }
    } else if (pattern instanceof RegExp && pattern.test(input)) {
      return logo
    }
  }
  return undefined
}

/**
 * Extracts the package name (before the `@` version part) from a `tagName`.
 */
export function extractPackageName(tagName: string): string {
  const match = tagName.match(/(^@?[^@]+)@/)
  if (match) {
    return match[1] ?? tagName
  }
  return tagName
}

/**
 * Processes the version number and return the highlighted and non-highlighted parts.
 */
export function processVersion(
  versionNum: string,
): ['major' | 'minor' | 'patch' | 'pre', string, string] {
  const parts = versionNum.split(/(\.)/g)
  let highlightedIndex = -1
  let versionType: 'major' | 'minor' | 'patch' | 'pre'

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]
    if (part && part !== '.') {
      const num = +part
      if (!Number.isNaN(num) && num > 0) {
        highlightedIndex = i
        break
      }
    }
  }

  if (highlightedIndex === 0) {
    versionType = 'major'
  } else if (highlightedIndex === 2) {
    versionType = 'minor'
  } else if (highlightedIndex === 4) {
    versionType = 'patch'
  } else {
    versionType = 'pre'
  }

  const nonHighlightedPart = parts
    .slice(0, highlightedIndex === -1 ? 0 : highlightedIndex)
    .join('')
  const highlightedPart = parts
    .slice(highlightedIndex === -1 ? 0 : highlightedIndex)
    .join('')

  return [versionType, nonHighlightedPart, highlightedPart]
}

/**
 * Parses a tuple value and returns the numeric value.
 * Expects a tuple like [boolean, number] and returns the number.
 */
export function parseTuple(
  value: [boolean, number] | undefined,
  name: string,
): number {
  if (!value || !Array.isArray(value) || value.length < 2) {
    throw new Error(
      `Invalid ${name}: expected a tuple [boolean, number], got ${JSON.stringify(value)}`,
    )
  }
  const num = value[1]
  if (typeof num !== 'number' || isNaN(num)) {
    throw new Error(
      `Invalid ${name}: expected a number, got ${typeof num} (${JSON.stringify(num)})`,
    )
  }
  return num
}
