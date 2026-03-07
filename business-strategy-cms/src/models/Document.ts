import { Document } from '@/types/document'
import { DocumentModelMongoose, DocumentVersionModel } from './DocumentMongoose'

export class DocumentModel {
  static async create(
    documentData: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): Promise<Document> {
    const doc = await DocumentModelMongoose.create({
      ...documentData,
      version: 1,
    })

    const document = doc.toJSON() as unknown as Document

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
    const doc = await DocumentModelMongoose.findById(id)
    return doc ? (doc.toJSON() as unknown as Document) : null
  }

  static async findAll(filters?: any): Promise<Document[]> {
    const query: any = {}

    if (filters) {
      if (filters.authorId) query.authorId = filters.authorId
      if (filters.category) query.category = filters.category
      if (filters.status) query.status = filters.status
      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags }
      }
      if (filters.searchTerm) {
        query.$text = { $search: filters.searchTerm }
      }
    }

    const docs = await DocumentModelMongoose.find(query).sort({ updatedAt: -1 })
    return docs.map((doc) => doc.toJSON() as unknown as Document)
  }

  static async update(
    id: string,
    updates: Partial<Document>,
  ): Promise<Document | null> {
    const oldDoc = await DocumentModelMongoose.findById(id)
    if (!oldDoc) return null

    const updatedDoc = await DocumentModelMongoose.findByIdAndUpdate(
      id,
      {
        $set: updates,
        $inc: { version: 1 },
      },
      { new: true },
    )

    if (!updatedDoc) return null

    const document = updatedDoc.toJSON() as unknown as Document

    // Create new version
    await this.createVersion({
      documentId: id,
      version: document.version,
      title: document.title,
      content: document.content,
      summary: document.summary,
      authorId: document.metadata.lastEditedBy,
      changeSummary: updates.content ? 'Content updated' : 'Metadata updated',
    })

    return document
  }

  static async delete(id: string): Promise<boolean> {
    const result = await DocumentModelMongoose.findByIdAndDelete(id)
    if (result) {
      await DocumentVersionModel.deleteMany({ documentId: id })
      return true
    }
    return false
  }

  static async addCollaborator(
    documentId: string,
    userId: string,
  ): Promise<Document | null> {
    const doc = await DocumentModelMongoose.findByIdAndUpdate(
      documentId,
      { $addToSet: { collaborators: userId } },
      { new: true },
    )
    return doc ? (doc.toJSON() as unknown as Document) : null
  }

  static async removeCollaborator(
    documentId: string,
    userId: string,
  ): Promise<Document | null> {
    const doc = await DocumentModelMongoose.findByIdAndUpdate(
      documentId,
      { $pull: { collaborators: userId } },
      { new: true },
    )
    return doc ? (doc.toJSON() as unknown as Document) : null
  }

  static async createVersion(versionData: any): Promise<any> {
    return await DocumentVersionModel.create(versionData)
  }

  static async getVersions(documentId: string): Promise<any[]> {
    return await DocumentVersionModel.find({ documentId })
      .sort({ version: -1 })
  }

  static async getVersion(
    documentId: string,
    version: number,
  ): Promise<any | null> {
    return await DocumentVersionModel.findOne({ documentId, version })
  }
}
