import { ObjectId } from 'mongodb'

export interface User {
  _id: ObjectId
  email: string
  password: string
  role: 'admin' | 'user' | 'therapist'
  emailVerified: boolean
  fullName?: string
  avatarUrl?: string
  lastLogin?: Date
  preferences?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  _id: ObjectId
  userId: ObjectId
  sessionId: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}
