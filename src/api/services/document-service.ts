// Document Service
// Business logic for document operations

import { BusinessDocument } from '../../lib/database/mongodb/schemas'
import { getPostgresPool } from '../../lib/database/connection'
import { NotFoundError, ForbiddenError } from '../middleware/error-handler'
import { v4 as uuidv4 } from 'uuid'
import slug from 'slug'

// ============================================================================
// CREATE DOCUMENT
// ============================================================================

export async function createDocument(
    data: {
        title: string
        type: string
        category: string
        content?: any
        description?: string
        owner: string
    },
    userId: string
) {
    const documentId = uuidv4()
    const documentSlug = slug(data.title, { lower: true })

    const document = new BusinessDocument({
        documentId,
        slug: documentSlug,
        title: data.title,
        type: data.type,
        category: data.category,
        description: data.description,
        content: data.content || { markdown: '' },
        owner: data.owner,
        contributors: [userId],
        permissions: {
            view: [data.owner],
            edit: [data.owner],
            comment: [data.owner]
        },
        status: 'draft',
        version: 1
    })

    await document.save()

    // Audit log
    const pool = getPostgresPool()
    await pool.query(
        `INSERT INTO document_versions (document_id, version_number, title, content, created_by, change_summary)
     VALUES ($1, $2, $3, $4, $5, $6)`,
        [documentId, 1, document.title, JSON.stringify(document.content), userId, 'Initial version']
    )

    return document
}

// ============================================================================
// GET DOCUMENT
// ============================================================================

export async function getDocument(documentId: string, userId: string) {
    const document = await BusinessDocument.findOne({ documentId }).lean()

    if (!document) {
        return null
    }

    // Check permissions
    const hasAccess =
        document.owner.toString() === userId ||
        document.permissions.view?.some((id: any) => id.toString() === userId) ||
        document.permissions.edit?.some((id: any) => id.toString() === userId)

    if (!hasAccess) {
        throw new ForbiddenError('You do not have permission to view this document')
    }

    return document
}

// ============================================================================
// UPDATE DOCUMENT
// ============================================================================

export async function updateDocument(
    documentId: string,
    updates: {
        title?: string
        content?: any
        status?: string
        description?: string
    },
    userId: string
) {
    const document = await BusinessDocument.findOne({ documentId })

    if (!document) {
        return null
    }

    // Check edit permission
    const canEdit =
        document.owner.toString() === userId ||
        document.permissions.edit?.some((id: any) => id.toString() === userId)

    if (!canEdit) {
        throw new ForbiddenError('You do not have permission to edit this document')
    }

    // Track changes for version history
    const changes: any = {}
    if (updates.title && updates.title !== document.title) {
        changes.title = { old: document.title, new: updates.title }
        document.title = updates.title
    }
    if (updates.content) {
        changes.content = { updated: true }
        document.content = updates.content
    }
    if (updates.description && updates.description !== document.description) {
        changes.description = { old: document.description, new: updates.description }
        document.description = updates.description
    }
    if (updates.status && updates.status !== document.status) {
        changes.status = { old: document.status, new: updates.status }
        document.status = updates.status
    }

    // Update version
    document.version += 1
    document.revisions.push({
        revisionId: uuidv4(),
        version: document.version,
        timestamp: new Date(),
        author: userId,
        changes: JSON.stringify(changes),
        content: JSON.stringify(document.content)
    })

    await document.save()

    // Create version record in PostgreSQL
    const pool = getPostgresPool()
    await pool.query(
        `INSERT INTO document_versions (document_id, version_number, title, content, created_by, change_summary)
     VALUES ($1, $2, $3, $4, $5, $6)`,
        [documentId, document.version, document.title, JSON.stringify(document.content), userId, JSON.stringify(changes)]
    )

    return document
}

// ============================================================================
// DELETE DOCUMENT
// ============================================================================

export async function deleteDocument(documentId: string, userId: string) {
    const document = await BusinessDocument.findOne({ documentId })

    if (!document) {
        return false
    }

    // Only owner or admin can delete
    const canDelete = document.owner.toString() === userId

    if (!canDelete) {
        throw new ForbiddenError('Only the document owner can delete this document')
    }

    // Soft delete - archive instead
    document.status = 'archived'
    await document.save()

    return true
}

// ============================================================================
// SHARE DOCUMENT
// ============================================================================

export async function shareDocument(
    documentId: string,
    sharedWithUserId: string,
    permissionLevel: 'view' | 'edit' | 'comment',
    userId: string
) {
    const document = await BusinessDocument.findOne({ documentId })

    if (!document) {
        throw new NotFoundError('Document', documentId)
    }

    // Check if user is owner
    if (document.owner.toString() !== userId) {
        throw new ForbiddenError('Only the document owner can share this document')
    }

    // Add to appropriate permission array
    if (permissionLevel === 'view' && !document.permissions.view.includes(sharedWithUserId)) {
        document.permissions.view.push(sharedWithUserId)
    } else if (permissionLevel === 'edit' && !document.permissions.edit.includes(sharedWithUserId)) {
        document.permissions.edit.push(sharedWithUserId)
    } else if (permissionLevel === 'comment' && !document.permissions.comment.includes(sharedWithUserId)) {
        document.permissions.comment.push(sharedWithUserId)
    }

    await document.save()

    // Log share event
    const pool = getPostgresPool()
    await pool.query(
        `INSERT INTO document_shares (document_id, shared_by, shared_with, permission_level, shared_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (document_id, shared_with) DO UPDATE SET
       permission_level = $4,
       shared_at = NOW()`,
        [documentId, userId, sharedWithUserId, permissionLevel]
    )

    return document
}

// ============================================================================
// SEARCH DOCUMENTS
// ============================================================================

export async function searchDocuments(
    query: string,
    userId: string,
    filters?: {
        type?: string
        category?: string
        status?: string
    }
) {
    const searchFilter: any = {
        $or: [
            { owner: userId },
            { 'permissions.view': userId },
            { 'permissions.edit': userId }
        ],
        $text: { $search: query }
    }

    if (filters?.type) searchFilter.type = filters.type
    if (filters?.category) searchFilter.category = filters.category
    if (filters?.status) searchFilter.status = filters.status

    return await BusinessDocument.find(searchFilter)
            .limit(50)
            .lean();
}
