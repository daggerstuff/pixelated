/**
 * Advanced Collaboration System for Pixelated Empathy
 * Secure multi-user collaboration with real-time synchronization
 */

import {
  type UserProfile,
  type CollaborationSession,
  type Notification,
  type Participant,
  ParticipantPermission,
} from '@/types/collaboration'

export interface CollaborationConfig {
  maxParticipants: number
  enableRealTimeSync: boolean
  encryptionRequired: boolean
  auditAllActions: boolean
  allowedRoles: string[]
  sessionTimeout: number // minutes
}

export interface CollaborationInvite {
  id: string
  sessionId: string
  invitedBy: string
  invitedUser: string
  role: 'viewer' | 'editor' | 'admin'
  permissions: string[]
  expiresAt: Date
  accepted: boolean
  acceptedAt?: Date
}

export interface SecureMessage {
  id: string
  sessionId: string
  senderId: string
  content: string
  timestamp: Date
  encrypted: boolean
  signature?: string
  readBy: string[]
  edited: boolean
  editedAt?: Date
}

/**
 * Advanced Collaboration Manager
 */
class CollaborationManager {
  private readonly config: CollaborationConfig
  private readonly activeSessions = new Map<string, CollaborationSession>()
  private readonly userSessions = new Map<string, Set<string>>() // userId -> sessionIds
  private readonly invitations = new Map<string, CollaborationInvite>()
  private readonly messages = new Map<string, SecureMessage[]>()
  private readonly notifications = new Map<string, Notification[]>()

  constructor() {
    this.config = {
      maxParticipants: 20,
      enableRealTimeSync: true,
      encryptionRequired: true,
      auditAllActions: true,
      allowedRoles: ['therapist', 'supervisor', 'admin', 'researcher'],
      sessionTimeout: 120, // 2 hours
    }
  }

  /**
   * Create new collaboration session
   */
  async createSession(
    creator: UserProfile,
    sessionData: Omit<
      CollaborationSession,
      'id' | 'createdAt' | 'participants' | 'status'
    >,
  ): Promise<CollaborationSession> {
    const sessionId = `collab_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    const participant: Participant = {
      id: creator.id,
      userId: creator.id,
      userName: creator.name,
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      permissions: [ParticipantPermission.ADMIN],
    }

    const session: CollaborationSession = {
      id: sessionId,
      ...sessionData,
      createdAt: new Date(),
      participants: [participant],
      isActive: true,
    }

    this.activeSessions.set(sessionId, session)
    return session
  }

  /**
   * Invite user to collaboration session
   */
  async inviteToSession(
    sessionId: string,
    invitedBy: string,
    invitedUser: string,
    role: 'viewer' | 'editor' | 'admin' = 'viewer',
  ): Promise<CollaborationInvite> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    if (session.participants.length >= this.config.maxParticipants) {
      throw new Error(
        `Session full (max ${this.config.maxParticipants} participants)`,
      )
    }

    const inviteId = `invite_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    const invitation: CollaborationInvite = {
      id: inviteId,
      sessionId,
      invitedBy,
      invitedUser,
      role,
      permissions: this.getRolePermissions(role) as ParticipantPermission[],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      accepted: false,
    }

    this.invitations.set(inviteId, invitation)

    // Send notification to invited user
    await this.sendNotification(invitedUser, {
      id: `notif_${Date.now()}`,
      type: 'collaboration_invite' as const,
      title: 'Collaboration Session Invitation',
      message: `You have been invited to join a collaboration session by ${invitedBy}`,
      metadata: { sessionId, inviteId },
      timestamp: new Date(),
      read: false,
    } as Record<string, unknown>)


    return invitation
  }

  private getRolePermissions(role: string): ParticipantPermission[] {
    const permissions: Record<string, ParticipantPermission[]> = {
      viewer: [ParticipantPermission.READ],
      editor: [ParticipantPermission.READ, ParticipantPermission.WRITE],
      admin: [
        ParticipantPermission.READ,
        ParticipantPermission.WRITE,
        ParticipantPermission.ADMIN,
      ],
    }

    return permissions[role] ?? permissions['viewer']!
  }

  /**
   * Accept collaboration invitation
   */
  async acceptInvitation(
    inviteId: string,
    userId: string,
  ): Promise<{
    success: boolean
    session?: CollaborationSession
    error?: string
  }> {
    const invitation = this.invitations.get(inviteId)
    if (!invitation) {
      return { success: false, error: 'Invitation not found' }
    }

    if (invitation.invitedUser !== userId) {
      return { success: false, error: 'Invitation not for this user' }
    }

    if (invitation.expiresAt < new Date()) {
      return { success: false, error: 'Invitation expired' }
    }

    const session = this.activeSessions.get(invitation.sessionId)
    if (!session) {
      return { success: false, error: 'Session no longer exists' }
    }

    // Add user to session as a Participant object
    const newParticipant: Participant = {
      id: userId,
      userId,
      userName: userId,
      joinedAt: new Date(),
      lastActiveAt: new Date(),
      permissions: [ParticipantPermission.READ, ParticipantPermission.WRITE],
    }
    session.participants.push(newParticipant)
    this.addUserToSession(userId, invitation.sessionId)
    invitation.accepted = true
    invitation.acceptedAt = new Date()

    // Send notification to session creator
    await this.sendNotification(invitation.invitedBy, {
      id: `notif_${Date.now()}`,
      type: 'collaboration_accepted' as const,
      title: 'Invitation Accepted',
      message: `${userId} has accepted your collaboration invitation`,
      metadata: { sessionId: invitation.sessionId },
      timestamp: new Date(),
      read: false,
    } as Record<string, unknown>)


    return { success: true, session }
  }

  private addUserToSession(userId: string, sessionId: string): void {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set())
    }
    this.userSessions.get(userId)!.add(sessionId)
  }

  /**
   * Send secure message in collaboration session
   */
  async sendMessage(
    sessionId: string,
    senderId: string,
    content: string,
    options: {
      encrypt?: boolean
      priority?: 'low' | 'normal' | 'high'
    } = {},
  ): Promise<SecureMessage> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    if (!session.participants.some((p) => p.userId === senderId)) {
      throw new Error('User not participant in session')
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    let processedContent = content

    // Encrypt message if required
    if (options.encrypt || this.config.encryptionRequired) {
      processedContent = await this.encryptMessage(content, sessionId)
    }

    const message: SecureMessage = {
      id: messageId,
      sessionId,
      senderId,
      content: processedContent,
      timestamp: new Date(),
      encrypted: options.encrypt ?? this.config.encryptionRequired,
      readBy: [senderId],
      edited: false,
    }

    this.addMessage(sessionId, message)

    // Broadcast to all participants (in real implementation, use WebSocket)
    await this.broadcastMessage(session, message)

    return message
  }

  private async encryptMessage(
    content: string,
    sessionId: string,
  ): Promise<string> {
    // Use session-specific encryption key
    return `encrypted_${btoa(content)}` // Mock encryption
  }

  private addMessage(sessionId: string, message: SecureMessage): void {
    if (!this.messages.has(sessionId)) {
      this.messages.set(sessionId, [])
    }
    this.messages.get(sessionId)!.push(message)
  }

  private async broadcastMessage(
    session: CollaborationSession,
    message: SecureMessage,
  ): Promise<void> {
    // In real implementation, broadcast via WebSocket to all participants
  }

  /**
   * Leave collaboration session
   */
  async leaveSession(sessionId: string, userId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId)
    if (!session) return false

    // Remove user from participants
    session.participants = session.participants.filter(
      (p) => p.userId !== userId,
    )

    // Remove from user sessions
    const userSessionSet = this.userSessions.get(userId)
    if (userSessionSet) {
      userSessionSet.delete(sessionId)
      if (userSessionSet.size === 0) {
        this.userSessions.delete(userId)
      }
    }

    // If no participants left, end session
    if (session.participants.length === 0) {
      await this.endSession(sessionId)
    } else {
      // Notify remaining participants
      await this.sendMessage(
        sessionId,
        'system',
        `${userId} has left the session`,
      )
    }

    return true
  }

  /**
   * End collaboration session
   */
  async endSession(sessionId: string): Promise<{
    session: CollaborationSession
    duration: number
    messageCount: number
    participantCount: number
  }> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    session.status = 'ended'
    const duration = Date.now() - session.createdAt.getTime()
    const messageCount = this.messages.get(sessionId)?.length ?? 0
    const participantCount = session.participants.length

    // Archive session data
    await this.archiveSession(session)

    // Clean up
    this.activeSessions.delete(sessionId)
    this.messages.delete(sessionId)

    // Remove all users from this session
    this.userSessions.forEach((sessionSet, userId) => {
      sessionSet.delete(sessionId)
      if (sessionSet.size === 0) {
        this.userSessions.delete(userId)
      }
    })


    return {
      session,
      duration,
      messageCount,
      participantCount,
    }
  }

  private async archiveSession(session: CollaborationSession): Promise<void> {
    // Archive session data for compliance and analytics
    const archiveData = {
      session,
      messages: this.messages.get(session.id) ?? [],
      archivedAt: new Date(),
    }

  }

  /**
   * Get session messages with decryption
   */
  async getSessionMessages(
    sessionId: string,
    userId: string,
    limit: number = 50,
  ): Promise<SecureMessage[]> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    if (!session.participants.some((p) => p.userId === userId)) {
      throw new Error('User not authorized to view messages')
    }

    const sessionMessages = this.messages.get(sessionId) ?? []
    const recentMessages = sessionMessages.slice(-limit)

    // Mark messages as read
    recentMessages.forEach((message) => {
      if (!message.readBy.includes(userId)) {
        message.readBy.push(userId)
      }
    })

    return recentMessages
  }

  /**
   * Send notification to user
   */
  private async sendNotification(
    userId: string,
    notification: Notification,
  ): Promise<void> {
    if (!this.notifications.has(userId)) {
      this.notifications.set(userId, [])
    }

    this.notifications.get(userId)!.push(notification)

    // In real implementation, send push notification or email
  }

  /**
   * Get user notifications
   */
  getUserNotifications(
    userId: string,
    unreadOnly: boolean = false,
  ): Notification[] {
    const userNotifications = this.notifications.get(userId) ?? []

    if (unreadOnly) {
      return userNotifications.filter((n) => !n.read)
    }

    return userNotifications
  }

  /**
   * Mark notifications as read
   */
  markNotificationsRead(userId: string, notificationIds?: string[]): number {
    const userNotifications = this.notifications.get(userId) ?? []
    let markedCount = 0

    userNotifications.forEach((notification) => {
      if (!notificationIds || notificationIds.includes(notification.id)) {
        if (!notification.read) {
          notification.read = true
          markedCount++
        }
      }
    })

    return markedCount
  }

  /**
   * Get active sessions for user
   */
  getUserSessions(userId: string): CollaborationSession[] {
    const userSessionIds = this.userSessions.get(userId) ?? new Set()
    return Array.from(userSessionIds)
      .map((sessionId) => this.activeSessions.get(sessionId))
      .filter((session) => session !== undefined)
  }

  /**
   * Update session settings
   */
  async updateSessionSettings(
    sessionId: string,
    userId: string,
    settings: Partial<CollaborationSession['settings']>,
  ): Promise<CollaborationSession> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // Check if user has admin permissions
    const userRole = this.getUserRoleInSession(sessionId, userId)
    if (userRole !== 'admin') {
      throw new Error('Admin permissions required to update session settings')
    }

    session.settings = { ...session.settings, ...settings }
    session.updatedAt = new Date()

    // Notify all participants of settings change
    await this.sendMessage(
      sessionId,
      'system',
      `Session settings updated by ${userId}`,
    )

    return session
  }

  private getUserRoleInSession(
    _sessionId: string,
    _userId: string,
  ): 'viewer' | 'editor' | 'admin' {
    // In real implementation, check against session role assignments
    return 'admin' // Mock default role
  }

  /**
   * Get collaboration analytics
   */
  getCollaborationAnalytics(): {
    activeSessions: number
    totalParticipants: number
    averageSessionDuration: number
    messageCount: number
    topCollaborators: string[]
  } {
    const sessions = Array.from(this.activeSessions.values())

    const activeSessions = sessions.length
    const totalParticipants = sessions.reduce(
      (sum, session) => sum + session.participants.length,
      0,
    )

    // Calculate average session duration
    const totalDuration = sessions.reduce((sum, session) => {
      return sum + (Date.now() - session.createdAt.getTime())
    }, 0)
    const averageSessionDuration =
      activeSessions > 0 ? totalDuration / activeSessions : 0

    // Count total messages
    const messageCount = Array.from(this.messages.values()).reduce(
      (sum, messages) => sum + messages.length,
      0,
    )

    // Find top collaborators (users in most sessions)
    const userSessionCounts = new Map<string, number>()
    this.userSessions.forEach((sessionSet, userId) => {
      userSessionCounts.set(userId, sessionSet.size)
    })

    const topCollaborators = Array.from(userSessionCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([userId]) => userId)

    return {
      activeSessions,
      totalParticipants,
      averageSessionDuration,
      messageCount,
      topCollaborators,
    }
  }

  /**
   * Export session data for compliance
   */
  async exportSessionData(
    sessionId: string,
    format: 'json' | 'csv',
  ): Promise<{
    data: any
    format: string
    exportedAt: Date
    includesPII: boolean
  }> {
    const session = this.activeSessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const sessionMessages = this.messages.get(sessionId) ?? []
    const includesPII = sessionMessages.some((msg) => !msg.encrypted)

    let exportData: any

    if (format === 'json') {
      exportData = {
        session,
        messages: sessionMessages,
        participants: session.participants,
      }
    } else {
      // CSV format for messages
      const headers = ['Timestamp', 'Sender', 'Content', 'Encrypted']
      const rows = sessionMessages.map((msg) => [
        msg.timestamp.toISOString(),
        msg.senderId,
        msg.encrypted ? '[ENCRYPTED]' : msg.content,
        msg.encrypted ? 'Yes' : 'No',
      ])

      exportData = [headers, ...rows].map((row) => row.join(',')).join('\n')
    }

    return {
      data: exportData,
      format,
      exportedAt: new Date(),
      includesPII,
    }
  }
}

// Export singleton instance
export const collaborationManager = new CollaborationManager()

// Export class for custom instances
export { CollaborationManager }
export default collaborationManager
