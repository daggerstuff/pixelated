

export interface Document {
  id: string
  title: string
  content: string
  summary?: string
  category: DocumentCategory
  tags: string[]
  status: DocumentStatus
  authorId: string
  collaborators: string[] // user IDs
  version: number
  parentDocumentId?: string
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
  metadata: DocumentMetadata
}

export interface DocumentMetadata {
  wordCount: number
  readingTime: number // in minutes
  lastEditedBy: string // user ID
  fileSize: number
  mimeType: string
  customFields: Record<string, any>
}

export interface DocumentVersion {
  id: string
  documentId: string
  version: number
  title: string
  content: string
  summary?: string
  authorId: string
  createdAt: Date
  changeSummary: string
  diff?: string
}

export interface DocumentComment {
  id: string
  documentId: string
  version: number
  userId: string
  content: string
  position?: { start: number; end: number }
  resolved: boolean
  createdAt: Date
  updatedAt: Date
}

export enum DocumentCategory {
  BUSINESS_PLAN = 'business_plan',
  MARKET_ANALYSIS = 'market_analysis',
  COMPETITIVE_ANALYSIS = 'competitive_analysis',
  MARKETING_STRATEGY = 'marketing_strategy',
  FINANCIAL_PROJECTION = 'financial_projection',
  OPERATIONS_PLAN = 'operations_plan',
  EXECUTIVE_SUMMARY = 'executive_summary',
  CUSTOM = 'custom',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export interface DocumentCreate {
  title: string
  content: string
  summary?: string
  category: DocumentCategory
  tags?: string[]
  parentDocumentId?: string
  metadata?: Partial<DocumentMetadata>
}

export interface DocumentUpdate {
  title?: string
  content?: string
  summary?: string
  category?: DocumentCategory
  tags?: string[]
  status?: DocumentStatus
  metadata?: Partial<DocumentMetadata>
}

export interface DocumentSearchFilters {
  category?: DocumentCategory
  status?: DocumentStatus
  authorId?: string
  tags?: string[]
  dateFrom?: Date
  dateTo?: Date
  searchTerm?: string
}

export interface DocumentSearchResult {
  documents: Document[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}
