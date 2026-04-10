import { describe, expect, it } from 'vitest'

import {
  buildEvidenceCitations,
  buildExcerpt,
  contentIdToUrl,
  createEvidenceDocument,
  EvidenceSearchIndex,
  tokenizeQuery,
} from './search'

describe('EvidenceSearchIndex', () => {
  it('prioritizes title and content matches with citations', () => {
    const index = new EvidenceSearchIndex()
    index.importDocuments([
      createEvidenceDocument(
        'docs',
        'compliance/ethics',
        'Ethics Framework',
        'The EARS framework blocks non-compliant therapeutic outputs in production.',
        ['safety'],
        'compliance',
      ),
      createEvidenceDocument(
        'docs',
        'architecture/memory-system',
        'Memory System',
        'Memory retrieval runs after crisis detection and before response generation.',
        ['memory'],
        'architecture',
      ),
    ])

    const results = index.search('EARS therapeutic outputs', { limit: 5 })

    expect(results).toHaveLength(1)
    expect(results[0]?.title).toBe('Ethics Framework')
    expect(results[0]?.matchedTerms).toContain('ears')

    const citations = buildEvidenceCitations(results)
    expect(citations[0]?.index).toBe(1)
    expect(citations[0]?.url).toBe('/docs/compliance/ethics')
  })

  it('supports collection and category filtering', () => {
    const index = new EvidenceSearchIndex()
    index.importDocuments([
      createEvidenceDocument(
        'docs',
        'guides/security',
        'Security Guide',
        'Security monitoring and deployment procedures.',
        [],
        'security',
      ),
      createEvidenceDocument(
        'pages',
        'about',
        'About Pixelated',
        'Pixelated Empathy builds mental-health AI systems.',
        [],
        'marketing',
      ),
    ])

    const docsOnly = index.search('security', { collection: 'docs' })
    const pagesOnly = index.search('pixelated', { collection: 'pages' })
    const categoryOnly = index.search('security', { category: 'security' })

    expect(docsOnly).toHaveLength(1)
    expect(docsOnly[0]?.collection).toBe('docs')
    expect(pagesOnly).toHaveLength(1)
    expect(pagesOnly[0]?.collection).toBe('pages')
    expect(categoryOnly).toHaveLength(1)
    expect(categoryOnly[0]?.category).toBe('security')
  })
})

describe('evidence assistant helpers', () => {
  it('normalizes URLs for docs and pages collections', () => {
    expect(contentIdToUrl('docs', 'architecture/overview')).toBe(
      '/docs/architecture/overview',
    )
    expect(contentIdToUrl('pages', 'index')).toBe('/')
    expect(contentIdToUrl('pages', 'posts/introducing-pixelated')).toBe(
      '/posts/introducing-pixelated',
    )
  })

  it('tokenizes queries and builds excerpts around matches', () => {
    const terms = tokenizeQuery('Voice safety for crisis detection')
    expect(terms).toEqual(['voice', 'safety', 'for', 'crisis', 'detection'])

    const excerpt = buildExcerpt(
      'Streaming voice pipelines should run crisis detection before response generation so safety gates stay intact.',
      ['crisis', 'safety'],
      80,
    )

    expect(excerpt.toLowerCase()).toContain('crisis detection')
    expect(excerpt.endsWith('...')).toBe(true)
  })
})
