import { io, Socket } from 'socket.io-client'
import { DocumentChangeEvent } from './socketService.js'

interface SocketAuth {
  token: string
}

interface DocumentJoinedEvent {
  document: {
    id: string
    title: string
    content: string
    ownerId: string
    collaborators: string[]
    createdAt: string
    updatedAt: string
    version: number
    isPublic: boolean
  }
  collaborators: Array<{
    id: string
    userId: string
    socketId: string
    cursor?: { line: number; column: number }
    lastActivity: string
  }>
}

interface UserEvent {
  userId: string
  collaborators: Array<{
    id: string
    userId: string
    socketId: string
    cursor?: { line: number; column: number }
    lastActivity: string
  }>
}

interface CursorUpdateEvent {
  userId: string
  cursor: { line: number; column: number }
}

interface DocumentSavedEvent {
  version: number
  updatedAt: string
}

export class WebSocketClient {
  private socket: Socket | null = null
  private token: string
  private documentId: string | null = null

  constructor(token: string) {
    this.token = token
  }

  connect(): void {
    const serverUrl =
      import.meta.env.PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001'
    this.socket = io(serverUrl, {
      auth: { token: this.token },
      transports: ['websocket'],
    })

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server')
    })

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server')
    })

    this.socket.on('error', (error: { message: string }) => {
      console.error('WebSocket error:', error.message)
    })
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  joinDocument(documentId: string): Promise<DocumentJoinedEvent> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'))
        return
      }

      this.documentId = documentId
      this.socket.emit('join-document', { documentId })

      this.socket.once('document-joined', (data: DocumentJoinedEvent) => {
        resolve(data)
      })

      this.socket.once('error', (error: { message: string }) => {
        reject(new Error(error.message))
      })
    })
  }

  sendDocumentChange(change: DocumentChangeEvent, version: number): void {
    if (!this.socket || !this.documentId) {
      console.warn('Cannot send change: not connected or no document joined')
      return
    }

    this.socket.emit('document-change', {
      documentId: this.documentId,
      change,
      version,
    })
  }

  updateCursor(line: number, column: number): void {
    if (!this.socket || !this.documentId) {
      return
    }

    this.socket.emit('cursor-update', {
      documentId: this.documentId,
      cursor: { line, column },
    })
  }

  saveDocument(content: string, version: number): void {
    if (!this.socket || !this.documentId) {
      return
    }

    this.socket.emit('save-document', {
      documentId: this.documentId,
      content,
      version,
    })
  }

  onDocumentJoined(callback: (data: DocumentJoinedEvent) => void): void {
    if (this.socket) {
      this.socket.on('document-joined', callback)
    }
  }

  onUserJoined(callback: (data: UserEvent) => void): void {
    if (this.socket) {
      this.socket.on('user-joined', callback)
    }
  }

  onUserLeft(callback: (data: UserEvent) => void): void {
    if (this.socket) {
      this.socket.on('user-left', callback)
    }
  }

  onRemoteChange(
    callback: (data: {
      change: DocumentChangeEvent
      version: number
      userId: string
    }) => void,
  ): void {
    if (this.socket) {
      this.socket.on('remote-change', callback)
    }
  }

  onCursorUpdated(callback: (data: CursorUpdateEvent) => void): void {
    if (this.socket) {
      this.socket.on('cursor-updated', callback)
    }
  }

  onDocumentSaved(callback: (data: DocumentSavedEvent) => void): void {
    if (this.socket) {
      this.socket.on('document-saved', callback)
    }
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (this.socket) {
      this.socket.off(event, callback)
    }
  }

  get isConnected(): boolean {
    return this.socket?.connected || false
  }
}
