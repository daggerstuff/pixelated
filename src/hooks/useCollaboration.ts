import { useState, useEffect, useCallback, useRef } from 'react'
import { WebSocketClient } from '../services/websocketClient.js'
import { DocumentChangeEvent } from '../services/socketService.js'

interface UseCollaborationProps {
  token: string
  documentId: string
  initialContent: string
  onContentChange: (content: string) => void
}

interface Collaborator {
  id: string
  userId: string
  cursor?: { line: number; column: number }
  lastActivity: string
}

interface UseCollaborationReturn {
  content: string
  version: number
  collaborators: Collaborator[]
  cursors: Record<string, { line: number; column: number }>
  isConnected: boolean
  isSaving: boolean
  error: string | null

  // Actions
  updateContent: (newContent: string) => void
  updateCursor: (line: number, column: number) => void
  saveDocument: () => void
  applyRemoteChange: (change: DocumentChangeEvent) => void
}

export function useCollaboration({
  token,
  documentId,
  initialContent,
  onContentChange,
}: UseCollaborationProps): UseCollaborationReturn {
  const [content, setContent] = useState(initialContent)
  const [version, setVersion] = useState(1)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [cursors, setCursors] = useState<
    Record<string, { line: number; column: number }>
  >({})
  const [isConnected, setIsConnected] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<WebSocketClient | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize WebSocket connection
  useEffect(() => {
    if (!token || !documentId) return

    const socket = new WebSocketClient(token)
    socketRef.current = socket

    socket.onDocumentJoined((data) => {
      setContent(data.document.content)
      setVersion(data.document.version)
      setCollaborators(data.collaborators)
      setIsConnected(true)
      setError(null)
    })

    socket.onUserJoined((data) => {
      setCollaborators(data.collaborators)
    })

    socket.onUserLeft((data) => {
      setCollaborators(data.collaborators)
      // Remove cursor for disconnected user
      const newCursors = { ...cursors }
      delete newCursors[data.userId]
      setCursors(newCursors)
    })

    socket.onRemoteChange((data) => {
      // Apply remote changes to content
      const newContent = applyChange(content, data.change)
      setContent(newContent)
      setVersion(data.version)
      onContentChange(newContent)
    })

    socket.onCursorUpdated((data) => {
      setCursors((prev) => ({
        ...prev,
        [data.userId]: data.cursor,
      }))
    })

    socket.onDocumentSaved((data) => {
      setVersion(data.version)
      setIsSaving(false)
    })

    socket.connect()
    socket.joinDocument(documentId)

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, documentId])

  // Auto-save functionality
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && isConnected) {
        setIsSaving(true)
        socketRef.current.saveDocument(content, version)
      }
    }, 2000) // Auto-save after 2 seconds of inactivity

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [content, version, isConnected])

  const updateContent = useCallback(
    (newContent: string) => {
      setContent(newContent)

      // Send change to server
      if (socketRef.current && isConnected) {
        const change: DocumentChangeEvent = {
          type: 'insert',
          position: { line: 0, column: 0 },
          content: newContent,
          userId: 'current', // This will be replaced by server
        }
        socketRef.current.sendDocumentChange(change, version)
      }
    },
    [version, isConnected],
  )

  const updateCursor = useCallback(
    (line: number, column: number) => {
      if (socketRef.current && isConnected) {
        socketRef.current.updateCursor(line, column)
      }
    },
    [isConnected],
  )

  const saveDocument = useCallback(() => {
    if (socketRef.current && isConnected) {
      setIsSaving(true)
      socketRef.current.saveDocument(content, version)
    }
  }, [content, version, isConnected])

  const applyRemoteChange = useCallback((change: DocumentChangeEvent) => {
    // This would be used for more complex change application
    // For now, we'll let the remote change handler do it
  }, [])

  return {
    content,
    version,
    collaborators,
    cursors,
    isConnected,
    isSaving,
    error,
    updateContent,
    updateCursor,
    saveDocument,
    applyRemoteChange,
  }
}

// Helper function to apply document changes
function applyChange(content: string, change: DocumentChangeEvent): string {
  const lines = content.split('\n')

  switch (change.type) {
    case 'insert':
      if (change.content) {
        const line = lines[change.position.line] || ''
        const before = line.substring(0, change.position.column)
        const after = line.substring(change.position.column)
        lines[change.position.line] = before + change.content + after
      }
      break
    case 'delete':
      // Handle delete operations
      break
    case 'format':
      // Handle format operations
      break
  }

  return lines.join('\n')
}
