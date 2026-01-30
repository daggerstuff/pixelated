/**
 * Document Management Service
 * 
 * Provides functionality for managing business strategy documents,
 * versions, comments, and analytics.
 */

import type {
    Document,
    DocumentCreate,
    DocumentUpdate,
    DocumentSearch,
    DocumentSearchResult,
    DocumentVersion
} from '../types/document-management'
import type { UserId, DocumentId } from '../types/common'
import { BaseService } from './base-service'
import { v4 as uuidv4 } from 'uuid'

export class DocumentManagementService extends BaseService {
    private readonly collectionName: string

    constructor() {
        super()
        this.collectionName = this.db.mongodb.collections.documents
    }

    /**
     * Create a new document
     */
    async createDocument(userId: UserId, data: DocumentCreate): Promise<Document> {
        await this.validatePermissions(userId, 'document', 'create')
        this.validateRequired(data, ['title', 'content', 'type', 'category'])

        const sanitized = this.sanitizeInput(data)
        const documentId = this.generateId() as DocumentId
        const timestamp = new Date()

        const document: Document = {
            id: documentId,
            ...sanitized,
            slug: this.generateSlug(sanitized.title),
            version: 1,
            size: Buffer.byteLength(sanitized.content),
            checksum: this.generateChecksum(sanitized.content),
            status: 'draft',
            priority: 'medium',
            createdBy: userId,
            createdAt: timestamp,
            updatedBy: userId,
            updatedAt: timestamp,
            permissions: {
                read: [userId],
                write: [userId],
                approve: [],
                delete: [userId],
                share: [userId]
            },
            isPublic: false,
            isTemplate: false,
            collaborators: [{
                userId,
                role: 'owner',
                addedAt: timestamp,
                addedBy: userId
            }],
            analytics: {
                documentId,
                views: 0,
                uniqueViews: 0,
                lastViewed: timestamp,
                averageReadTime: 0,
                collaborators: [userId],
                editCount: 0,
                commentCount: 0,
                shareCount: 0,
                downloadCount: 0,
                searchAppearances: 0
            }
        }

        try {
            await this.db.mongodb.database.collection(this.collectionName).insertOne({
                ...document,
                _id: documentId // Use documentId as MongoDB _id
            })

            await this.logAudit({
                userId,
                action: 'create',
                entityType: 'document',
                entityId: documentId,
                result: 'success',
                details: { title: document.title }
            })

            // Create initial version
            await this.createVersion(userId, documentId, {
                title: document.title,
                content: document.content,
                changes: ['Initial creation']
            })

            return document
        } catch (error) {
            return this.handleError(error, 'createDocument')
        }
    }

    /**
     * Get a document by ID
     */
    async getDocument(userId: UserId, id: DocumentId): Promise<Document> {
        try {
            const document = await this.db.mongodb.database
                .collection<Document>(this.collectionName)
                .findOne({ id })

            if (!document) {
                throw new Error('Document not found')
            }

            const hasAccess = await this.validatePermissions(userId, 'document', 'read', { id })
            if (!hasAccess) {
                throw new Error('Access denied')
            }

            // Update analytics
            await this.updateAnalytics(id, 'view', userId)

            return document
        } catch (error) {
            return this.handleError(error, 'getDocument')
        }
    }

    /**
     * Search documents
     */
    async searchDocuments(userId: UserId, search: DocumentSearch): Promise<DocumentSearchResult[]> {
        try {
            const filter = this.buildMongoFilter(search.filters)
            const sort = this.buildMongoSort(search.sort?.field, search.sort?.order)
            const { page = 1, limit = 20 } = search.pagination || {}

            const documents = await this.db.mongodb.database
                .collection<Document>(this.collectionName)
                .find({
                    ...filter,
                    $or: [
                        { isPublic: true },
                        { 'permissions.read': userId },
                        { 'collaborators.userId': userId }
                    ]
                })
                .sort(sort)
                .skip((page - 1) * limit)
                .limit(limit)
                .toArray()

            return documents.map(doc => ({
                document: doc,
                score: 1.0, // basic implementation, would use MongoDB text score in real world
                highlights: [],
                matchedTerms: []
            }))
        } catch (error) {
            return this.handleError(error, 'searchDocuments')
        }
    }

    /**
     * Update a document
     */
    async updateDocument(userId: UserId, id: DocumentId, updates: DocumentUpdate): Promise<Document> {
        try {
            const hasAccess = await this.validatePermissions(userId, 'document', 'write', { id })
            if (!hasAccess) {
                throw new Error('Access denied')
            }

            const timestamp = new Date()
            const sanitized = this.sanitizeInput(updates)

            const currentDoc = await this.getDocument(userId, id)
            const newVersion = currentDoc.version + 1

            const updateFields: any = {
                ...sanitized,
                version: newVersion,
                updatedBy: userId,
                updatedAt: timestamp
            }

            if (updates.content) {
                updateFields.size = Buffer.byteLength(updates.content)
                updateFields.checksum = this.generateChecksum(updates.content)
            }

            const result = await this.db.mongodb.database
                .collection<Document>(this.collectionName)
                .findOneAndUpdate(
                    { id },
                    { $set: updateFields },
                    { returnDocument: 'after' }
                )

            if (!result) {
                throw new Error('Document not found or update failed')
            }

            await this.logAudit({
                userId,
                action: 'update',
                entityType: 'document',
                entityId: id,
                result: 'success',
                details: { version: newVersion }
            })

            // Create new version history record if content changed
            if (updates.content) {
                await this.createVersion(userId, id, {
                    title: result.title,
                    content: result.content,
                    summary: updates.summary,
                    changes: ['Content updated']
                })
            }

            return result as Document
        } catch (error) {
            return this.handleError(error, 'updateDocument')
        }
    }

    /**
     * Create a document version
     */
    private async createVersion(
        userId: UserId,
        documentId: DocumentId,
        data: Pick<DocumentVersion, 'title' | 'content' | 'summary' | 'changes'>
    ): Promise<DocumentVersion> {
        const version: DocumentVersion = {
            id: uuidv4(),
            documentId,
            version: 0, // Will be set by caller or incremented
            ...data,
            createdBy: userId,
            createdAt: new Date(),
            size: Buffer.byteLength(data.content),
            checksum: this.generateChecksum(data.content)
        }

        // Logic to get current version and increment would go here
        // For now, assume version is handled by document update

        await this.db.mongodb.database.collection('document_versions').insertOne(version)
        return version
    }

    /**
     * Update document analytics
     */
    private async updateAnalytics(id: DocumentId, type: 'view' | 'edit' | 'share', userId: UserId): Promise<void> {
        const update: any = {
            $set: { 'analytics.lastViewed': new Date() }
        }

        if (type === 'view') {
            update.$inc = { 'analytics.views': 1 }
            update.$addToSet = { 'analytics.collaborators': userId }
        } else if (type === 'edit') {
            update.$inc = { 'analytics.editCount': 1 }
        } else if (type === 'share') {
            update.$inc = { 'analytics.shareCount': 1 }
        }

        await this.db.mongodb.database
            .collection(this.collectionName)
            .updateOne({ id }, update)
    }

    private generateSlug(title: string): string {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '')
    }

    private generateChecksum(content: string): string {
        // Simple mock checksum for now
        return `sha256:${Buffer.from(content).length}`
    }
}
