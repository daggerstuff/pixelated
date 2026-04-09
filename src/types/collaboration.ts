// Collaboration types

export interface CollaborationSession {
  id: string
  roomId: string
  participants: Participant[]
  createdAt: Date
  updatedAt: Date
  isActive: boolean
}

export interface Participant {
  id: string
  userId: string
  userName: string
  joinedAt: Date
  lastActiveAt: Date
  permissions: ParticipantPermission[]
}

export enum ParticipantPermission {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin',
}

export interface CollaborationMessage {
  id: string
  sessionId: string
  senderId: string
  type: 'text' | 'cursor' | 'selection' | 'comment'
  content: unknown
  timestamp: Date
}

// User profile for collaboration
export interface UserProfile {
  id: string
  name: string
  email: string
  avatar?: string
  role?: string
  department?: string
  createdAt?: Date
  updatedAt?: Date
  preferences?: Record<string, unknown>
}

// Notification for collaboration
export interface Notification {
  id: string
  userId: string
  type: 'mention' | 'assignment' | 'comment' | 'update' | 'alert'
  title: string
  message: string
  read: boolean
  timestamp: Date
  link?: string
  metadata?: Record<string, unknown>
}
