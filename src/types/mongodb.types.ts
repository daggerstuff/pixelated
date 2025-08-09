import { ObjectId } from 'mongodb'

export interface User {
  id: string
  profile: unknown
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

export interface Todo {
  _id?: ObjectId
  id?: string
  name: string
  description?: string
  completed: boolean
  userId?: ObjectId // For user-specific todos
  createdAt: Date
  updatedAt: Date
}

export interface AIMetrics {
  _id?: ObjectId
  id?: string
  userId: ObjectId
  sessionId: string
  modelName: string
  requestType: string
  tokensUsed: number
  responseTime: number
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface BiasDetection {
  _id?: ObjectId
  id?: string
  userId: ObjectId
  sessionId: string
  detectedBias: string
  biasType: string
  confidence: number
  contextSnippet: string
  correctionSuggestion?: string
  timestamp: Date
}

export interface TreatmentPlan {
  _id?: ObjectId
  id?: string
  userId: ObjectId
  therapistId: ObjectId
  title: string
  description: string
  goals: string[]
  interventions: string[]
  status: 'active' | 'completed' | 'paused'
  startDate: Date
  endDate?: Date
  createdAt: Date
  updatedAt: Date
}

export interface CrisisSessionFlag {
  _id?: ObjectId
  id?: string
  userId: ObjectId
  sessionId: string
  flagType: 'suicide_risk' | 'self_harm' | 'crisis'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: ObjectId
  createdAt: Date
}

export interface ConsentManagement {
  _id?: ObjectId
  id?: string
  userId: ObjectId
  consentType: string
  granted: boolean
  version: string
  grantedAt?: Date
  revokedAt?: Date
  ipAddress?: string
}
