import {
  Document,
  DocumentCategory,
  DocumentStatus,
  DocumentMetadata,
} from '@/types/document'

// In-memory document storage for now
const documents: Document[] = []
const documentVersions: any[] = []
let nextId = 1
let nextVersionId = 1

export class DocumentModel {
  static async create(
    documentData: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<Document> {
    const document: Document = {
      ...documentData,
      id: (nextId++).toString(),
      createdAt: new Date(),
      updatedAt: new Date(),
      version: 1,
    }
    documents.push(document)

    // Create initial version
    await this.createVersion({
      documentId: document.id,
      version: 1,
      title: document.title,
      content: document.content,
      summary: document.summary,
      authorId: document.authorId,
      changeSummary: 'Initial document creation',
    })

    return document
  }

  static async findById(id: string): Promise<Document | null> {
    return documents.find((doc) => doc.id === id) || null
  }

  static async findAll(filters?: any): Promise<Document[]> {
    let result = [...documents]

    if (filters) {
      if (filters.authorId) {
        result = result.filter((doc) => doc.authorId === filters.authorId)
      }
      if (filters.category) {
        result = result.filter((doc) => doc.category === filters.category)
      }
      if (filters.status) {
        result = result.filter((doc) => doc.status === filters.status)
      }
      if (filters.tags && filters.tags.length > 0) {
        result = result.filter((doc) =>
          filters.tags.some((tag: string) => doc.tags.includes(tag)),
        )
      }
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase()
        result = result.filter(
          (doc) =>
            doc.title.toLowerCase().includes(term) ||
            doc.content.toLowerCase().includes(term) ||
            doc.summary?.toLowerCase().includes(term),
        )
      }
    }

    return result
  }

  static async update(
    id: string,
    updates: Partial<Document>,
  ): Promise<Document | null> {
    const docIndex = documents.findIndex((doc) => doc.id === id)
    if (docIndex === -1) return null

    const oldDoc = documents[docIndex]
    const updatedDoc = {
      ...oldDoc,
      ...updates,
      updatedAt: new Date(),
      version: oldDoc.version + 1,
    }

    documents[docIndex] = updatedDoc

    // Create new version
    await this.createVersion({
      documentId: id,
      version: updatedDoc.version,
      title: updatedDoc.title,
      content: updatedDoc.content,
      summary: updatedDoc.summary,
      authorId: updatedDoc.metadata.lastEditedBy,
      changeSummary: updates.content ? 'Content updated' : 'Metadata updated',
    })

    return updatedDoc
  }

  static async delete(id: string): Promise<boolean> {
    const docIndex = documents.findIndex((doc) => doc.id === id)
    if (docIndex === -1) return false

    documents.splice(docIndex, 1)
    return true
  }

  static async addCollaborator(
    documentId: string,
    userId: string,
  ): Promise<Document | null> {
    const doc = await this.findById(documentId)
    if (!doc) return null

    if (!doc.collaborators.includes(userId)) {
      doc.collaborators.push(userId)
      return this.update(documentId, { collaborators: doc.collaborators })
    }

    return doc
  }

  static async removeCollaborator(
    documentId: string,
    userId: string,
  ): Promise<Document | null> {
    const doc = await this.findById(documentId)
    if (!doc) return null

    doc.collaborators = doc.collaborators.filter((id) => id !== userId)
    return this.update(documentId, { collaborators: doc.collaborators })
  }

  static async createVersion(versionData: any): Promise<any> {
    const version = {
      ...versionData,
      id: (nextVersionId++).toString(),
      createdAt: new Date(),
    }
    documentVersions.push(version)
    return version
  }

  static async getVersions(documentId: string): Promise<any[]> {
    return documentVersions
      .filter((v) => v.documentId === documentId)
      .sort((a, b) => b.version - a.version)
  }

  static async getVersion(
    documentId: string,
    version: number,
  ): Promise<any | null> {
    return (
      documentVersions.find(
        (v) => v.documentId === documentId && v.version === version,
      ) || null
    )
  }
}
