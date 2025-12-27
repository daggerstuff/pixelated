import {
  Document,
  DocumentCreate,
  DocumentUpdate,
  DocumentSearchFilters,
  DocumentSearchResult,
} from '@/types/document'
import { DocumentModel } from '@/models/Document'
import { UserModel } from '@/models/User'

export class DocumentService {
  static async createDocument(
    documentData: DocumentCreate,
    authorId: string,
  ): Promise<Document> {
    // Validate author exists
    const author = await UserModel.findById(authorId)
    if (!author) {
      throw new Error('Author not found')
    }

    const wordCount = documentData.content.split(/\s+/).length
    const readingTime = Math.ceil(wordCount / 200) // Average reading speed

    const metadata: Document['metadata'] = {
      wordCount,
      readingTime,
      lastEditedBy: authorId,
      fileSize: new Blob([documentData.content]).size,
      mimeType: 'text/html',
      customFields: documentData.metadata?.customFields || {},
      ...documentData.metadata,
    }

    const document = await DocumentModel.create({
      ...documentData,
      authorId,
      status: DocumentStatus.DRAFT,
      collaborators: [],
      metadata,
    })

    return document
  }

  static async getDocument(id: string): Promise<Document | null> {
    return DocumentModel.findById(id)
  }

  static async getDocuments(
    filters?: DocumentSearchFilters,
  ): Promise<DocumentSearchResult> {
    const docs = await DocumentModel.findAll(filters)

    return {
      documents: docs,
      total: docs.length,
      page: 1,
      limit: 50,
      hasMore: false,
    }
  }

  static async updateDocument(
    id: string,
    updates: DocumentUpdate,
    userId: string,
  ): Promise<Document | null> {
    const document = await DocumentModel.findById(id)
    if (!document) {
      throw new Error('Document not found')
    }

    // Check if user has permission to edit
    const canEdit =
      document.authorId === userId || document.collaborators.includes(userId)

    if (!canEdit) {
      throw new Error('Insufficient permissions to edit this document')
    }

    // Update metadata
    const updatedMetadata = { ...document.metadata }
    if (updates.content) {
      const wordCount = updates.content.split(/\s+/).length
      const readingTime = Math.ceil(wordCount / 200)
      updatedMetadata.wordCount = wordCount
      updatedMetadata.readingTime = readingTime
      updatedMetadata.fileSize = new Blob([updates.content]).size
    }
    updatedMetadata.lastEditedBy = userId

    const updatedDocument = await DocumentModel.update(id, {
      ...updates,
      metadata: updatedMetadata,
    })

    return updatedDocument
  }

  static async deleteDocument(id: string, userId: string): Promise<boolean> {
    const document = await DocumentModel.findById(id)
    if (!document) {
      throw new Error('Document not found')
    }

    // Only author can delete
    if (document.authorId !== userId) {
      throw new Error('Only the author can delete this document')
    }

    return DocumentModel.delete(id)
  }

  static async addCollaborator(
    documentId: string,
    userId: string,
    requesterId: string,
  ): Promise<Document | null> {
    const document = await DocumentModel.findById(documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    // Only author can add collaborators
    if (document.authorId !== requesterId) {
      throw new Error('Only the author can add collaborators')
    }

    // Check if user exists
    const user = await UserModel.findById(userId)
    if (!user) {
      throw new Error('User not found')
    }

    return DocumentModel.addCollaborator(documentId, userId)
  }

  static async removeCollaborator(
    documentId: string,
    userId: string,
    requesterId: string,
  ): Promise<Document | null> {
    const document = await DocumentModel.findById(documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    // Only author can remove collaborators
    if (document.authorId !== requesterId) {
      throw new Error('Only the author can remove collaborators')
    }

    return DocumentModel.removeCollaborator(documentId, userId)
  }

  static async getDocumentVersions(documentId: string): Promise<any[]> {
    const document = await DocumentModel.findById(documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    return DocumentModel.getVersions(documentId)
  }

  static async getDocumentVersion(
    documentId: string,
    version: number,
  ): Promise<any | null> {
    const document = await DocumentModel.findById(documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    return DocumentModel.getVersion(documentId, version)
  }

  static async publishDocument(
    id: string,
    userId: string,
  ): Promise<Document | null> {
    const document = await DocumentModel.findById(id)
    if (!document) {
      throw new Error('Document not found')
    }

    // Check if user has permission to publish
    const canPublish =
      document.authorId === userId || document.collaborators.includes(userId)

    if (!canPublish) {
      throw new Error('Insufficient permissions to publish this document')
    }

    return DocumentModel.update(id, {
      status: DocumentStatus.PUBLISHED,
      publishedAt: new Date(),
    })
  }

  static async archiveDocument(
    id: string,
    userId: string,
  ): Promise<Document | null> {
    const document = await DocumentModel.findById(id)
    if (!document) {
      throw new Error('Document not found')
    }

    // Only author can archive
    if (document.authorId !== userId) {
      throw new Error('Only the author can archive this document')
    }

    return DocumentModel.update(id, { status: DocumentStatus.ARCHIVED })
  }
}
