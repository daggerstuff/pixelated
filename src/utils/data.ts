import type { CollectionEntry } from 'astro:content'
import type { GitHubView } from '@/types'

// Define the structure for the highlights collection entry data
export type HighlightEntry = CollectionEntry<'highlights'>

// The actual schema used in the project (from config.ts)
export interface HighlightData {
  projects?: Record<
    string,
    { name: string; link: string; desc: string; icon: string }[]
  >
}

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
  logos: GitHubView['mainLogoOverrides'] | GitHubView['subLogoMatches'],
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
export function extractPackageName(tagName: string) {
  const match = tagName.match(/(^@?[^@]+)@/)
  if (match) {
    return match[1]
  }
  return tagName
}

/**
 * Extracts the version number from a `tagName`.
 */
export function extractVersionNum(tagName: string) {
  // Use a more specific pattern to avoid backtracking
  const match = tagName.match(/^\D*(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/i)
  if (match) {
    return match[1]
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

  const nonHighlightedPart = parts.slice(0, highlightedIndex).join('')
  const highlightedPart = parts.slice(highlightedIndex).join('')

  return [versionType, nonHighlightedPart, highlightedPart]
}

/**
 * Extracts the ID from a string.
 */
export function extractId(input: string): number | null {
  const match = input.match(/\d+/g)
  if (match && match.length > 0) {
    return parseInt(match[0], 10)
  }
  return null
}

/**
 * Validates if a string is a valid ID.
 */
export function validateId(id: string): boolean {
  return /^\d+$/.test(id)
}

export interface ExampleCardData {
  title: string
  description?: string
  image?: string
  link?: string
  tags?: string[]
  date?: Date
  author?: string
}

export function getCardData(): ExampleCardData[] {
  return [
    {
      title: 'Example Card 1',
      description: 'This is an example card',
      image: '/images/example1.jpg',
      link: '/example1',
      tags: ['example', 'card'],
      date: new Date(),
      author: 'Example Author',
    },
    {
      title: 'Example Card 2',
      description: 'This is another example card',
      image: '/images/example2.jpg',
      link: '/example2',
      tags: ['example', 'card'],
      date: new Date(),
      author: 'Example Author',
    },
  ]
}
