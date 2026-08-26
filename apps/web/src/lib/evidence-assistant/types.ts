export type EvidenceCollection = 'docs' | 'pages'

export interface EvidenceDocument {
  id: string
  title: string
  content: string
  url: string
  collection: EvidenceCollection
  tags?: string[]
  category?: string
}

export interface EvidenceSearchOptions {
  limit?: number
  collection?: EvidenceCollection
  category?: string
}

export interface EvidenceSearchResult extends EvidenceDocument {
  score: number
  excerpt: string
  matchedTerms: string[]
}

export interface EvidenceAnswerCitation {
  index: number
  title: string
  url: string
  collection: EvidenceCollection
}
