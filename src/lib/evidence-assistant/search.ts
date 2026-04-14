import type { AIMessage } from '@/lib/ai/models/ai-types'

import type {
  EvidenceAnswerCitation,
  EvidenceCollection,
  EvidenceDocument,
  EvidenceSearchOptions,
  EvidenceSearchResult,
} from './types'

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 10

function stripMarkup(content: string): string {
  return content
    .replace(/^---[\s\S]*?---/m, ' ')
    .replace(/`{1,3}[\s\S]*?`{1,3}/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_\-|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeTerm(term: string): string {
  return term.toLowerCase().trim()
}

export function tokenizeQuery(query: string): string[] {
  return Array.from(
    new Set(
      query
        .split(/[^a-zA-Z0-9]+/)
        .map(normalizeTerm)
        .filter((term) => term.length >= 2),
    ),
  )
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0
  }

  let count = 0
  let start = 0

  for (;;) {
    const index = haystack.indexOf(needle, start)
    if (index === -1) {
      return count
    }

    count += 1
    start = index + needle.length
  }
}

export function contentIdToUrl(
  collection: EvidenceCollection,
  id: string,
): string {
  if (collection === 'docs') {
    return (
      `/docs/${id.replace(/\/index$/, '').replace(/^index$/, '')}`.replace(
        /\/$/,
        '',
      ) || '/docs'
    )
  }

  return (
    `/${id.replace(/\/index$/, '').replace(/^index$/, '')}`.replace(
      /\/$/,
      '',
    ) || '/'
  )
}

export function createEvidenceDocument(
  collection: EvidenceCollection,
  id: string,
  title: string,
  content: string,
  tags: string[] = [],
  category?: string,
): EvidenceDocument {
  return {
    id,
    title,
    content: stripMarkup(content),
    url: contentIdToUrl(collection, id),
    collection,
    tags,
    category,
  }
}

export function buildExcerpt(
  content: string,
  matchedTerms: string[],
  maxLength = 220,
): string {
  if (!content) {
    return ''
  }

  const normalizedContent = stripMarkup(content)
  if (normalizedContent.length <= maxLength) {
    return normalizedContent
  }

  const lowerContent = normalizedContent.toLowerCase()
  const candidateMatches = matchedTerms
    .map((term) => ({
      term,
      index: lowerContent.indexOf(term.toLowerCase()),
    }))
    .filter((candidate) => candidate.index >= 0)

  if (candidateMatches.length === 0) {
    return `${normalizedContent.slice(0, maxLength).trim()}...`
  }

  let bestStart = Math.max(0, candidateMatches[0]?.index ?? 0) - 40
  let bestCoverage = -1
  let bestFirstMatch = Number.POSITIVE_INFINITY

  for (const candidate of candidateMatches) {
    const start = Math.max(0, candidate.index - 40)
    const end = Math.min(normalizedContent.length, start + maxLength)
    const window = lowerContent.slice(start, end)
    const coveredTerms = matchedTerms.filter((term) =>
      window.includes(term.toLowerCase()),
    )
    const firstCoveredMatch =
      candidateMatches
        .filter((match) => match.index >= start && match.index < end)
        .map((match) => match.index)
        .sort((a, b) => a - b)[0] ?? Number.POSITIVE_INFINITY

    if (
      coveredTerms.length > bestCoverage ||
      (coveredTerms.length === bestCoverage &&
        firstCoveredMatch < bestFirstMatch)
    ) {
      bestCoverage = coveredTerms.length
      bestFirstMatch = firstCoveredMatch
      bestStart = start
    }
  }

  const end = Math.min(normalizedContent.length, bestStart + maxLength)
  const prefix = bestStart > 0 ? '...' : ''
  const suffix = end < normalizedContent.length ? '...' : ''
  return `${prefix}${normalizedContent.slice(bestStart, end).trim()}${suffix}`
}

export function scoreDocument(
  document: EvidenceDocument,
  queryTerms: string[],
): { score: number; matchedTerms: string[] } {
  if (queryTerms.length === 0) {
    return { score: 0, matchedTerms: [] }
  }

  const lowerTitle = document.title.toLowerCase()
  const lowerContent = document.content.toLowerCase()
  const lowerCategory = document.category?.toLowerCase() ?? ''
  const lowerTags = (document.tags ?? []).map((tag) => tag.toLowerCase())

  let score = 0
  const matchedTerms = new Set<string>()

  for (const term of queryTerms) {
    const exactTitleMatch = lowerTitle === term
    const titleMatches = countOccurrences(lowerTitle, term)
    const contentMatches = countOccurrences(lowerContent, term)
    const categoryMatches = lowerCategory.includes(term) ? 1 : 0
    const tagMatches = lowerTags.some((tag) => tag.includes(term)) ? 1 : 0

    if (exactTitleMatch) {
      score += 10
      matchedTerms.add(term)
      continue
    }

    if (titleMatches > 0) {
      score += 6 + titleMatches * 2
      matchedTerms.add(term)
    }

    if (categoryMatches > 0) {
      score += 3
      matchedTerms.add(term)
    }

    if (tagMatches > 0) {
      score += 2
      matchedTerms.add(term)
    }

    if (contentMatches > 0) {
      score += Math.min(5, contentMatches)
      matchedTerms.add(term)
    }
  }

  return {
    score,
    matchedTerms: Array.from(matchedTerms),
  }
}

export class EvidenceSearchIndex {
  private readonly documents: EvidenceDocument[] = []

  importDocuments(documents: EvidenceDocument[]): void {
    this.documents.push(...documents)
  }

  clear(): void {
    this.documents.length = 0
  }

  search(
    query: string,
    options: EvidenceSearchOptions = {},
  ): EvidenceSearchResult[] {
    const terms = tokenizeQuery(query)
    if (terms.length === 0) {
      return []
    }

    const limit = Math.min(
      Math.max(options.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    )

    return this.documents
      .filter((document) => {
        if (options.collection && document.collection !== options.collection) {
          return false
        }

        if (
          options.category &&
          document.category?.toLowerCase() !== options.category.toLowerCase()
        ) {
          return false
        }

        return true
      })
      .map((document) => {
        const { score, matchedTerms } = scoreDocument(document, terms)
        return {
          ...document,
          score,
          matchedTerms,
          excerpt: buildExcerpt(document.content, matchedTerms),
        }
      })
      .filter((result) => result.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score
        }

        return left.title.localeCompare(right.title)
      })
      .slice(0, limit)
  }
}

export function buildEvidenceCitations(
  results: EvidenceSearchResult[],
): EvidenceAnswerCitation[] {
  return results.map((result, index) => ({
    index: index + 1,
    title: result.title,
    url: result.url,
    collection: result.collection,
  }))
}

export function buildGroundedMessages(
  query: string,
  results: EvidenceSearchResult[],
): AIMessage[] {
  const evidenceBlocks = results
    .map(
      (result, index) =>
        `[${index + 1}] ${result.title}\nURL: ${result.url}\nCollection: ${result.collection}\nExcerpt: ${result.excerpt}`,
    )
    .join('\n\n')

  return [
    {
      role: 'system',
      content:
        'You are the Pixelated Empathy internal evidence assistant. Answer only from the supplied evidence. Do not invent facts. If the evidence is insufficient, say so clearly. Treat this as internal product and compliance guidance, not clinical advice. When you use evidence, cite it inline using bracketed numbers like [1] or [2].',
    },
    {
      role: 'user',
      content: `Question: ${query}\n\nEvidence:\n${evidenceBlocks}`,
    },
  ]
}
