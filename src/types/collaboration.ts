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
