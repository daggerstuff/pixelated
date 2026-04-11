import {
  Document,
  DocumentSearchFilters,
  DocumentVersion,
} from '@/types/document'

import {
  DocumentDocument,
  DocumentJson,
  DocumentModelMongoose,
  DocumentVersionDocument,
  DocumentVersionModel,
} from './DocumentMongoose'

type DocumentCreateInput = Omit<
  Document,
  'id' | 'createdAt' | 'updatedAt' | 'version'
>
type DocumentVersionCreateInput = Omit<
  DocumentVersion,
  'id' | 'createdAt' | 'summary'
> & {
  summary?: string | undefined
}

function toDocument(doc: DocumentDocument): Document {
  const json: DocumentJson = doc.toJSON()
  return json
}

function buildVersionPayload(
  versionData: DocumentVersionCreateInput,
): DocumentVersionCreateInput {
  const { summary, ...rest } = versionData
  return summary !== undefined ? { ...rest, summary } : rest
}

export class DocumentModel {
  static async create(
    documentData: DocumentCreateInput,
  ): Promise<Document> {
    const doc = await DocumentModelMongoose.create({
      ...documentData,
      version: 1,
    })

    const document = toDocument(doc)

    // Create initial version
    await this.createVersion(
      buildVersionPayload({
        documentId: document.id,
        version: 1,
        title: document.title,
        content: document.content,
        summary: document.summary,
        authorId: document.authorId,
        changeSummary: 'Initial document creation',
      }),
    )

    return document
  }

  static async findById(id: string): Promise<Document | null> {
    const doc = await DocumentModelMongoose.findById(id)
    return doc ? toDocument(doc) : null
  }

  static async findAll(filters?: DocumentSearchFilters): Promise<Document[]> {
    const query: Record<string, unknown> = {}

    if (filters) {
      if (filters.authorId) query['authorId'] = filters.authorId
      if (filters.category) query['category'] = filters.category
      if (filters.status) query['status'] = filters.status
      if (filters.tags && filters.tags.length > 0) {
        query['tags'] = { $in: filters.tags }
      }
      if (filters.searchTerm) {
        query['$text'] = { $search: filters.searchTerm }
      }
    }

    const docs = await DocumentModelMongoose.find(query).sort({ updatedAt: -1 })
    return docs.map((doc) => toDocument(doc))
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

    const document = toDocument(updatedDoc)

    // Create new version
    await this.createVersion(
      buildVersionPayload({
        documentId: id,
        version: document.version,
        title: document.title,
        content: document.content,
        summary: document.summary,
        authorId: document.metadata.lastEditedBy,
        changeSummary: updates.content ? 'Content updated' : 'Metadata updated',
      }),
    )

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
    return doc ? toDocument(doc) : null
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
    return doc ? toDocument(doc) : null
  }

  static async createVersion(
    versionData: DocumentVersionCreateInput,
  ): Promise<DocumentVersionDocument> {
    const version = new DocumentVersionModel(versionData)
    return version.save()
  }

  static async getVersions(documentId: string): Promise<DocumentVersionDocument[]> {
    return DocumentVersionModel.find({ documentId }).sort({ version: -1 })
  }

  static async getVersion(
    documentId: string,
    version: number,
  ): Promise<DocumentVersionDocument | null> {
    return DocumentVersionModel.findOne({ documentId, version })
  }
}
