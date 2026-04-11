import mongoose, {
  Model,
  Schema,
  Types,
  Document as MongooseDocument,
} from 'mongoose'

import {
  Document as DocumentType,
  DocumentCategory,
  DocumentStatus,
  DocumentVersion,
} from '@/types/document'

export interface DocumentJson extends Omit<DocumentType, 'id'> {
  _id?: Types.ObjectId
  __v?: number
  id: string
}

export interface DocumentDocument
  extends Omit<DocumentType, 'id'>, MongooseDocument {
  id: string
  toJSON(): DocumentJson
}

const documentSchema = new Schema<DocumentDocument>(
  {
    title: { type: String, required: true, index: true },
    content: { type: String, required: true },
    summary: { type: String },
    category: {
      type: String,
      enum: Object.values(DocumentCategory),
      required: true,
      index: true,
    },
    tags: [{ type: String, index: true }],
    status: {
      type: String,
      enum: Object.values(DocumentStatus),
      default: DocumentStatus.DRAFT,
      index: true,
    },
    authorId: { type: String, required: true, index: true },
    collaborators: [{ type: String, index: true }],
    version: { type: Number, default: 1 },
    parentDocumentId: { type: String, index: true },
    publishedAt: { type: Date },
    metadata: {
      wordCount: { type: Number },
      readingTime: { type: Number },
      lastEditedBy: { type: String },
      fileSize: { type: Number },
      mimeType: { type: String },
      customFields: { type: Map, of: Schema.Types.Mixed },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: MongooseDocument, ret: DocumentJson) => {
        const objectId = ret._id
        if (objectId) {
          ret.id = objectId.toString()
        }
        delete ret._id
        delete ret.__v
        return ret
      },
    },
  },
)

// Index for search
documentSchema.index({ title: 'text', content: 'text', summary: 'text' })

const existingDocumentModel = mongoose.models['Document'] as
  | Model<DocumentDocument>
  | undefined

export const DocumentModelMongoose: Model<DocumentDocument> =
  existingDocumentModel ??
  mongoose.model<DocumentDocument>('Document', documentSchema)

export interface DocumentVersionDocument
  extends Omit<DocumentVersion, 'id'>, MongooseDocument {
  id: string
}

// Document Version Schema
const documentVersionSchema = new Schema<DocumentVersionDocument>(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: 'Document',
      required: true,
      index: true,
    },
    version: { type: Number, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    summary: { type: String },
    authorId: { type: String, required: true },
    changeSummary: { type: String },
    diff: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
)

documentVersionSchema.index({ documentId: 1, version: -1 })

const existingDocumentVersionModel = mongoose.models['DocumentVersion'] as
  | Model<DocumentVersionDocument>
  | undefined

export const DocumentVersionModel: Model<DocumentVersionDocument> =
  existingDocumentVersionModel ??
  mongoose.model<DocumentVersionDocument>(
    'DocumentVersion',
    documentVersionSchema,
  )
