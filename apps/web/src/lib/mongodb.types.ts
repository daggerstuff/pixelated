// Use conditional import to prevent MongoDB from being bundled on client side
type ObjectId = any
import type { Json } from '../types/json'

// MongoDB Document Base Interface
export interface MongoDocument {
  _id: ObjectId
  createdAt: Date
  updatedAt: Date
}

// User Collection Interface
export interface UserDocument extends MongoDocument {
  email: string
  name?: string
  avatar_url?: string
  website?: string
  bio?: string
  azure_id?: string
  role: 'user' | 'admin' | 'therapist'
  metadata?: Json
}

// Profile Collection Interface
export interface ProfileDocument extends MongoDocument {
  userId: ObjectId
  fullName?: string
  avatarUrl?: string
  website?: string
  bio?: string
  isPublic: boolean
  preferences: Json
}

// Session Collection Interface
export interface SessionDocument extends MongoDocument {
  userId: ObjectId
  accessToken: string
  refreshToken?: string
  expiresAt: Date
  ipAddress?: string
  userAgent?: string
  isActive: boolean
}

// Security Events Collection Interface
export interface SecurityEventDocument extends MongoDocument {
  userId?: ObjectId
  eventType:
    | 'login_failed'
    | 'password_changed'
    | 'suspicious_activity'
    | 'account_locked'
  eventData: Json
  ipAddress?: string
  userAgent?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

// AI Metrics Collection Interface
export interface AIMetricsDocument extends MongoDocument {
  timestamp: Date
  model: string
  requestCount: number
  successCount: number
  cachedCount: number
  optimizedCount: number
  totalTokens: number
  requestTokens: number
  responseTokens: number
  totalCostUsd: number
  avgResponseTimeMs: number
  errorCount: number
  errorRate: number
}

// Conversations Collection Interface
export interface ConversationDocument extends MongoDocument {
  userId: ObjectId
  title?: string
  messages: Array<{
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
    metadata?: Json
  }>
  isActive: boolean
  tags?: string[]
  metadata?: Json
}

// User Settings Collection Interface
export interface UserSettingsDocument extends MongoDocument {
  userId: ObjectId
  preferences: Json
  notificationSettings: Json
  privacySettings: Json
  securitySettings: Json
}

// Audit Logs Collection Interface
export interface AuditLogDocument extends MongoDocument {
  userId?: ObjectId
  action: string
  resource: string
  details: Json
  ipAddress?: string
  userAgent?: string
  success: boolean
}

// Crisis Detection Results Collection Interface
export interface CrisisDetectionDocument extends MongoDocument {
  userId: ObjectId
  conversationId: ObjectId
  text: string
  crisisDetected: boolean
  crisisType?: string
  confidence: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  interventionTriggered: boolean
  metadata?: Json
}

// Consent Management Collection Interface
export interface ConsentDocument extends MongoDocument {
  userId: ObjectId
  consentType:
    | 'data_processing'
    | 'marketing_communications'
    | 'analytics'
    | 'research'
  granted: boolean
  version: string
  ipAddress?: string
  revokedAt?: Date
}

// Database Collections Type Map
export interface DatabaseCollections {
  users: UserDocument
  profiles: ProfileDocument
  sessions: SessionDocument
  security_events: SecurityEventDocument
  ai_metrics: AIMetricsDocument
  conversations: ConversationDocument
  user_settings: UserSettingsDocument
  audit_logs: AuditLogDocument
  crisis_detection: CrisisDetectionDocument
  consent_management: ConsentDocument
}

// Helper type for collection names
export type CollectionName = keyof DatabaseCollections

// Helper type for getting document type from collection name
export type DocumentType<T extends CollectionName> = DatabaseCollections[T]
