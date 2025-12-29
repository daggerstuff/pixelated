/**
 * Document Management Types
 */

import type { BaseEntity, Status, Priority, UserId, DocumentId } from './common'

export type DocumentType =
    | 'market-analysis'
    | 'competitive-analysis'
    | 'marketing-plan'
    | 'strategy-document'
    | 'research-report'
    | 'presentation'
    | 'template'
    | 'policy'
    | 'other'

export type ContentType = 'markdown' | 'html' | 'rich-text' | 'plain-text'

export interface Category {
    id: string
    name: string
    description?: string
    parent?: string
    color?: string
    icon?: string
}

export interface DocumentPermissions {
    read: string[] // user IDs or role names
    write: string[]
    approve: string[]
    delete: string[]
    share: string[]
}

export interface DocumentVersion {
    id: string
    documentId: DocumentId
    version: number
    title: string
    content: string
    summary?: string
    changes: string[]
    createdBy: UserId
    createdAt: Date
    size: number // bytes
    checksum: string
}

export interface DocumentComment {
    id: string
    documentId: DocumentId
    versionId?: string
    parentId?: string // for replies
    content: string
    author: UserId
    createdAt: Date
    updatedAt?: Date
    resolved: boolean
    position?: {
        start: number
        end: number
        text: string
    }
    reactions?: {
        emoji: string
        users: UserId[]
    }[]
}

export interface DocumentTag {
    id: string
    name: string
    color?: string
    description?: string
    category?: string
}

export interface DocumentAnalytics {
    documentId: DocumentId
    views: number
    uniqueViews: number
    lastViewed: Date
    averageReadTime: number
    collaborators: UserId[]
    editCount: number
    commentCount: number
    shareCount: number
    downloadCount: number
    searchAppearances: number
    popularSections?: {
        section: string
        views: number
    }[]
}

export interface Document extends BaseEntity {
    title: string
    slug: string
    content: string
    contentType: ContentType
    type: DocumentType
    category: Category
    tags: DocumentTag[]
    description?: string
    excerpt?: string

    // Metadata
    status: Status
    priority: Priority
    version: number
    size: number // bytes
    checksum: string

    // Permissions and access
    permissions: DocumentPermissions
    isPublic: boolean
    isTemplate: boolean

    // Workflow
    workflow?: {
        currentStep?: string
        executionId?: string
        approvals: Approval[]
    }

    // Relationships
    parentId?: DocumentId
    relatedDocuments?: DocumentId[]
    attachments?: {
        id: string
        name: string
        type: string
        size: number
        url: string
        uploadedBy: UserId
        uploadedAt: Date
    }[]

    // Analytics
    analytics: DocumentAnalytics

    // Content structure
    tableOfContents?: {
        level: number
        title: string
        anchor: string
    }[]

    // Collaboration
    collaborators: {
        userId: UserId
        role: 'owner' | 'editor' | 'reviewer' | 'viewer'
        addedAt: Date
        addedBy: UserId
    }[]

    // Publishing
    publishedAt?: Date
    publishedBy?: UserId
    scheduledPublishAt?: Date

    // SEO and discovery
    seoTitle?: string
    seoDescription?: string
    keywords?: string[]

    // Archival
    archivedAt?: Date
    archivedBy?: UserId
    archiveReason?: string
}

export interface Approval {
    id: string
    stepId: string
    approver: UserId
    status: 'pending' | 'approved' | 'rejected' | 'delegated'
    decision?: 'approve' | 'reject' | 'request-changes'
    feedback?: string
    decidedAt?: Date
    delegatedTo?: UserId
    attachments?: string[]
}

export interface DocumentTemplate extends BaseEntity {
    name: string
    description: string
    type: DocumentType
    category: Category
    content: string
    contentType: ContentType
    variables: {
        name: string
        type: 'text' | 'number' | 'date' | 'boolean' | 'select'
        description: string
        required: boolean
        defaultValue?: unknown
        options?: string[] // for select type
    }[]
    instructions: string
    examples?: string[]
    usageCount: number
    rating?: number // 0-5
    reviews?: {
        userId: UserId
        rating: number
        comment: string
        createdAt: Date
    }[]
}

export interface DocumentExport {
    id: string
    documentId: DocumentId
    format: 'pdf' | 'docx' | 'html' | 'markdown' | 'json' | 'txt'
    options: {
        includeComments?: boolean
        includeVersionHistory?: boolean
        includeAnalytics?: boolean
        watermark?: string
        password?: boolean
    }
    status: 'pending' | 'processing' | 'completed' | 'failed'
    downloadUrl?: string
    expiresAt?: Date
    requestedBy: UserId
    requestedAt: Date
    completedAt?: Date
    error?: string
    fileSize?: number
}

export interface DocumentImport {
    id: string
    fileName: string
    fileType: string
    fileSize: number
    status: 'pending' | 'processing' | 'completed' | 'failed'
    options: {
        preserveFormatting?: boolean
        extractImages?: boolean
        convertToMarkdown?: boolean
        autoTag?: boolean
        autoCategory?: boolean
    }
    result?: {
        documentId?: DocumentId
        warnings?: string[]
        errors?: string[]
    }
    uploadedBy: UserId
    uploadedAt: Date
    processedAt?: Date
    error?: string
}

export interface DocumentSearch {
    query: string
    filters?: {
        type?: DocumentType[]
        category?: string[]
        tags?: string[]
        status?: Status[]
        author?: UserId[]
        dateRange?: {
            start: Date
            end: Date
            field: 'createdAt' | 'updatedAt' | 'publishedAt'
        }
    }
    sort?: {
        field: 'relevance' | 'createdAt' | 'updatedAt' | 'title' | 'views'
        order: 'asc' | 'desc'
    }
    pagination?: {
        page: number
        limit: number
    }
}

export interface DocumentSearchResult {
    document: Document
    score: number
    highlights: {
        field: string
        fragments: string[]
    }[]
    matchedTerms: string[]
}