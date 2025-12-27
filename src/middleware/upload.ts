import multer from 'multer'
import { Request } from 'express'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'

interface UploadConfig {
  maxSize?: number
  allowedTypes?: string[]
  destination?: string
}

const storage = multer.memoryStorage()

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'text/markdown',
    'application/json',
    'application/xml',
  ]

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`))
  }
}

export const createUploadMiddleware = (config: UploadConfig = {}) => {
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: config.maxSize || 10 * 1024 * 1024, // 10MB default
    },
  })
}

export const uploadConfig = {
  documents: createUploadMiddleware({
    maxSize: 50 * 1024 * 1024, // 50MB for documents
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'text/markdown',
    ],
  }),

  images: createUploadMiddleware({
    maxSize: 5 * 1024 * 1024, // 5MB for images
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  }),

  businessFiles: createUploadMiddleware({
    maxSize: 100 * 1024 * 1024, // 100MB for business files
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'text/markdown',
      'application/json',
      'application/xml',
    ],
  }),
}

export const generateFileName = (originalName: string): string => {
  const extension = path.extname(originalName)
  const nameWithoutExt = path.basename(originalName, extension)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const cleanName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_')
  return `${cleanName}_${timestamp}${extension}`
}
