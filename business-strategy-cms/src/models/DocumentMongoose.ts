import mongoose, { Schema, Document as MongooseDocument } from 'mongoose'
import {
    Document as DocumentType,
    DocumentCategory,
    DocumentStatus,
} from '@/types/document'

export interface DocumentDocument extends Omit<DocumentType, 'id'>, MongooseDocument {
    id: string
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
            transform: (_doc, ret) => {
                ret.id = ret._id.toString()
                delete (ret as any)._id
                delete (ret as any).__v
                return ret
            },
        },
    },
)

// Index for search
documentSchema.index({ title: 'text', content: 'text', summary: 'text' })

export const DocumentModelMongoose = mongoose.model<DocumentDocument>(
    'Document',
    documentSchema,
)

// Document Version Schema
const documentVersionSchema = new Schema(
    {
        documentId: { type: Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
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

export const DocumentVersionModel = mongoose.model(
    'DocumentVersion',
    documentVersionSchema,
)
