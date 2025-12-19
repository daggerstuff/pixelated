// Use conditional import to prevent MongoDB from being bundled on client side
declare class ObjectId {
  constructor(id?: string | number)
  toString(): string
  toHexString(): string
  static isValid(id: unknown): boolean
}

type MongoObjectId = ObjectId

export interface User {
  id: string
  profile: unknown
  _id: MongoObjectId
  email: string
  password: string
  role: 'admin' | 'user' | 'therapist'
  emailVerified: boolean
  fullName?: string
  avatarUrl?: string
  lastLogin?: Date
  preferences?: Record<string, unknown>
  resetToken?: string
  resetTokenExpires?: Date
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  _id: MongoObjectId
  userId: MongoObjectId
  sessionId: string
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

export interface Todo {
  _id?: MongoObjectId
  id?: string
  name: string
  description?: string
  completed: boolean
  userId?: MongoObjectId // For user-specific todos
  createdAt: Date
  updatedAt: Date
}

export interface AIMetrics {
  _id?: MongoObjectId
  id?: string
  userId: MongoObjectId
  sessionId: string
  modelName: string
  requestType: string
  tokensUsed: number
  responseTime: number
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface BiasDetection {
  _id?: MongoObjectId
  id?: string
  userId: MongoObjectId
  sessionId: string
  detectedBias: string
  biasType: string
  confidence: number
  contextSnippet: string
  correctionSuggestion?: string
  timestamp: Date
}

export interface TreatmentPlan {
  _id?: MongoObjectId
  id?: string
  userId: MongoObjectId
  therapistId: MongoObjectId
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
  _id?: MongoObjectId
  id?: string
  userId: MongoObjectId
  sessionId: string
  flagType: 'suicide_risk' | 'self_harm' | 'crisis'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  resolved: boolean
  resolvedAt?: Date
  resolvedBy?: MongoObjectId
  createdAt: Date
}

export interface ConsentManagement {
  _id?: MongoObjectId
  id?: string
  userId: MongoObjectId
  consentType: string
  granted: boolean
  version: string
  grantedAt?: Date
  revokedAt?: Date
  ipAddress?: string
}
