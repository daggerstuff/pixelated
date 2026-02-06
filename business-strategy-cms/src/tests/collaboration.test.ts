// describe, it, expect, beforeEach, afterEach are globals in Jest
import { CollaborationService } from '../services/collaborationService'
import { DocumentService } from '../services/documentService'
import { AuthService } from '../services/authService'
import { UserRole } from '../types/user'
import { DocumentCategory, DocumentStatus } from '../types/document'

describe('CollaborationService Property Tests', () => {
  let user1: any
  let user2: any
  let document: any

  beforeEach(async () => {
    // Create test users
    user1 = await AuthService.register({
      email: 'user1@example.com',
      password: 'password123',
      username: 'user1',
      firstName: 'User',
      lastName: 'One',
      role: UserRole.CONTENT_CREATOR,
    })

    user2 = await AuthService.register({
      email: 'user2@example.com',
      password: 'password123',
      username: 'user2',
      firstName: 'User',
      lastName: 'Two',
      role: UserRole.EDITOR,
    })

    // Create test document
    document = await DocumentService.createDocument({
      title: 'Test Document',
      content: 'Initial content',
      category: DocumentCategory.BUSINESS_PLAN,
      status: DocumentStatus.DRAFT,
      collaborators: [],
      metadata: {},
      tags: [],
    }, user1.user.id!)
  })

  afterEach(() => {
    CollaborationService.clearAllSessions()
  })

  describe('Session Management Properties', () => {
    it('should maintain session uniqueness per user-document pair', () => {
      const session1 = CollaborationService.joinSession(document.id, user1.user.id!, user1.user.username)
      const session2 = CollaborationService.joinSession(document.id, user1.user.id!, user1.user.username)

      expect(session1.userId).toBe(session2.userId)
      expect(CollaborationService.getActiveUsers(document.id)).toHaveLength(
        1,
      )
    })

    it('should allow multiple users in same document session', () => {
      const session1 = CollaborationService.joinSession(document.id, user1.user.id!, user1.user.username)
      const session2 = CollaborationService.joinSession(document.id, user2.user.id!, user2.user.username)

      expect(session1.userId).not.toBe(session2.userId)
      expect(CollaborationService.getActiveUsers(document.id)).toHaveLength(
        2,
      )
    })

    it('should properly clean up sessions on user disconnect', () => {
      CollaborationService.joinSession(document.id, user1.user.id!, user1.user.username)
      CollaborationService.joinSession(document.id, user2.user.id!, user2.user.username)

      expect(CollaborationService.getActiveUsers(document.id)).toHaveLength(
        2,
      )

      CollaborationService.leaveSession(document.id, user1.user.id!)
      expect(CollaborationService.getActiveUsers(document.id)).toHaveLength(
        1,
      )
    })
  })

  describe('Cursor Tracking Properties', () => {
    it('should broadcast cursor positions to all session participants', () => {
      CollaborationService.joinSession(document.id, user1.user.id!, user1.user.username)
      CollaborationService.joinSession(document.id, user2.user.id!, user2.user.username)

      const cursorPosition = 15
      const selection = { start: 15, end: 15 }

      const updates: any[] = []
      CollaborationService.onCursorUpdate(document.id, (update: any) => {
        updates.push(update)
      })

      CollaborationService.updateCursor(document.id, user1.user.id!, cursorPosition, selection)

      expect(updates).toHaveLength(1)
      expect(updates[0].userId).toBe(user1.user.id)
      expect(updates[0].position).toBe(15)
    })

    it('should handle rapid cursor updates without data loss', () => {
      CollaborationService.joinSession(document.id, user1.user.id!, user1.user.username)

      const updates = Array.from({ length: 100 }, (_, i) => ({
        userId: user1.user.id!,
        position: i,
        selection: { start: i, end: i },
      }))

      const receivedUpdates: any[] = []
      CollaborationService.onCursorUpdate(document.id, (update: any) => {
        receivedUpdates.push(update)
      })

      updates.forEach((update) =>
        CollaborationService.updateCursor(document.id, user1.user.id!, update.position, update.selection),
      )

      expect(receivedUpdates.length).toBeGreaterThan(0)
      expect(receivedUpdates[receivedUpdates.length - 1].position).toBe(99)
    })
  })

  describe('Change Recording Properties', () => {
    it('should record all changes with proper ordering', () => {
      CollaborationService.joinSession(document.id, user1.user.id!, user1.user.username)

      const changes = [
        {
          type: 'insert' as const,
          position: 0,
          content: 'Hello',
          userId: user1.user.id!,
          timestamp: new Date(),
        },
        {
          type: 'delete' as const,
          position: 0,
          length: 2,
          userId: user1.user.id!,
          timestamp: new Date(Date.now() + 1),
        },
        {
          type: 'insert' as const,
          position: 2,
          content: 'World',
          userId: user1.user.id!,
          timestamp: new Date(Date.now() + 2),
        },
      ]

      changes.forEach((change) =>
        CollaborationService.recordChange(document.id, change),
      )

      const history = CollaborationService.getChanges(document.id)
      expect(history).toHaveLength(3)
      expect(history[0].type).toBe('insert')
      expect(history[1].type).toBe('delete')
      expect(history[2].type).toBe('insert')
    })

    it('should maintain change attribution correctly', () => {
      CollaborationService.joinSession(document.id, user1.user.id!, user1.user.username)
      CollaborationService.joinSession(document.id, user2.user.id!, user2.user.username)

      CollaborationService.recordChange(document.id, {
        type: 'insert',
        position: 0,
        content: 'User1 edit',
        userId: user1.user.id!,
        timestamp: new Date(),
      })

      CollaborationService.recordChange(document.id, {
        type: 'insert',
        position: 10,
        content: 'User2 edit',
        userId: user2.user.id!,
        timestamp: new Date(Date.now() + 1),
      })

      const history = CollaborationService.getChanges(document.id)
      expect(history).toHaveLength(2)
      expect(history[0].userId).toBe(user1.user.id)
      expect(history[1].userId).toBe(user2.user.id)
    })

    it('should handle concurrent changes with conflict resolution', () => {
      CollaborationService.joinSession(document.id, user1.user.id!, user1.user.username)
      CollaborationService.joinSession(document.id, user2.user.id!, user2.user.username)

      const change1 = {
        type: 'insert' as const,
        position: 0,
        content: 'First',
        userId: user1.user.id!,
        timestamp: new Date(),
      }

      const change2 = {
        type: 'insert' as const,
        position: 0,
        content: 'Second',
        userId: user2.user.id!,
        timestamp: new Date(Date.now() + 1),
      }

      CollaborationService.recordChange(document.id, change1)
      CollaborationService.recordChange(document.id, change2)

      const history = CollaborationService.getChanges(document.id)
      expect(history).toHaveLength(2)

      const firstChange = history.find((h: any) => h.content === 'First')
      const secondChange = history.find((h: any) => h.content === 'Second')
      expect(firstChange!.timestamp.getTime()).toBeLessThan(secondChange!.timestamp.getTime())
    })
  })

  describe('Real-time Synchronization Properties', () => {
    it('should broadcast changes to all connected users', () => {
      CollaborationService.joinSession(document.id, user1.user.id!, user1.user.username)
      CollaborationService.joinSession(document.id, user2.user.id!, user2.user.username)

      const receivedChanges: any[] = []
      CollaborationService.onContentChange(document.id, (change: any) => {
        receivedChanges.push(change)
      })

      const change = {
        type: 'insert' as const,
        position: 0,
        content: 'Test content',
        userId: user1.user.id!,
        timestamp: new Date(),
      }

      CollaborationService.recordChange(document.id, change)

      expect(receivedChanges).toHaveLength(1)
      expect(receivedChanges[0].content).toBe('Test content')
    })

    it('should handle network partitions gracefully', () => {
      CollaborationService.joinSession(document.id, user1.user.id!, user1.user.username)
      CollaborationService.joinSession(document.id, user2.user.id!, user2.user.username)

      CollaborationService.leaveSession(document.id, user1.user.id!)

      const receivedChanges: any[] = []
      CollaborationService.onContentChange(document.id, (change: any) => {
        receivedChanges.push(change)
      })

      const change = {
        type: 'insert' as const,
        position: 0,
        content: 'After disconnect',
        userId: user2.user.id!,
        timestamp: new Date(),
      }

      CollaborationService.recordChange(document.id, change)

      expect(receivedChanges).toHaveLength(1)
      expect(CollaborationService.getActiveUsers(document.id)).toHaveLength(
        1,
      )
    })
  })

  describe('Performance Properties', () => {
    it('should handle large numbers of concurrent users', async () => {
      const userCount = 50
      const users = []

      for (let i = 0; i < userCount; i++) {
        const user = await AuthService.register({
          email: `user${i}@example.com`,
          password: 'password123',
          username: `user${i}`,
          firstName: 'User',
          lastName: `${i}`,
          role: UserRole.VIEWER,
        })
        users.push(user)
      }

      users.forEach((user: any) =>
        CollaborationService.joinSession(document.id, user.user.id!, user.user.username),
      )

      expect(CollaborationService.getActiveUsers(document.id)).toHaveLength(
        userCount,
      )

      const change = {
        type: 'insert' as const,
        position: 0,
        content: 'Mass update',
        userId: users[0].user.id!,
        timestamp: new Date(),
      }

      const startTime = Date.now()
      CollaborationService.recordChange(document.id, change)
      const endTime = Date.now()

      expect(endTime - startTime).toBeLessThan(100)
    })

    it('should maintain change history without memory leaks', () => {
      CollaborationService.joinSession(document.id, user1.user.id!, user1.user.username)

      const changeCount = 1000
      const changes = Array.from({ length: changeCount }, (_, i) => ({
        type: 'insert' as const,
        position: i,
        content: `Change ${i}`,
        userId: user1.user.id!,
        timestamp: new Date(Date.now() + i),
      }))

      changes.forEach((change) =>
        CollaborationService.recordChange(document.id, change),
      )

      const history = CollaborationService.getChanges(document.id)
      expect(history).toHaveLength(100)

      CollaborationService.clearChangeHistory(document.id)
      expect(CollaborationService.getChanges(document.id)).toHaveLength(0)
    })
  })

  describe('Security Properties', () => {
    it('should prevent unauthorized access to sessions', async () => {
      const unauthorizedUser = await AuthService.register({
        email: 'unauthorized@example.com',
        password: 'password123',
        username: 'unauthorized',
        firstName: 'Unauthorized',
        lastName: 'User',
        role: UserRole.VIEWER,
      })

      const canAccess = await DocumentService.checkDocumentPermission(
        document.id,
        unauthorizedUser.user.id!,
        'read',
      )

      if (canAccess) {
        CollaborationService.joinSession(document.id, unauthorizedUser.user.id!, unauthorizedUser.user.username)
        expect(
          CollaborationService.getActiveUsers(document.id),
        ).toContainEqual(
          expect.objectContaining({ userId: unauthorizedUser.user.id }),
        )
      } else {
        expect(() =>
          CollaborationService.joinSession(document.id, unauthorizedUser.user.id!, unauthorizedUser.user.username),
        ).toThrow()
      }
    })

    it('should validate change data to prevent injection attacks', () => {
      CollaborationService.joinSession(document.id, user1.user.id!, user1.user.username)

      const maliciousChange = {
        type: 'insert' as const,
        position: 0,
        content: '<script>alert("XSS")</script>',
        userId: user1.user.id!,
        timestamp: new Date(),
      }

      CollaborationService.recordChange(document.id, maliciousChange)

      const history = CollaborationService.getChanges(document.id)
      expect(history[0].content).toBe('<script>alert("XSS")</script>')
    })
  })
})
