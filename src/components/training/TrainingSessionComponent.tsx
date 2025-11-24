import { useState, useEffect, useRef } from 'react'
import { useConversationMemory } from '../../hooks/useMemory'
import { useAuth } from '../../hooks/useAuth'

// Basic UI scaffold for therapist training session
const initialClientMessage =
  'Hello, I am your client. How can you help me today?'

export function TrainingSessionComponent() {
  const { user } = useAuth()
  // Use authenticated user ID, fallback to demo user for development/testing
  const userId = user?.id || 'demo-therapist'
  const sessionId = 'session-1'
  const [therapistResponse, setTherapistResponse] = useState('')
  const [conversation, setConversation] = useState([
    { role: 'client', message: initialClientMessage },
  ])
  const [evaluation, setEvaluation] = useState<string | null>(null)
  const [coachingNotes, setCoachingNotes] = useState<Array<{ authorId: string, content: string, timestamp: string }>>([])

  // Fishbowl Mode State
  const [role, setRole] = useState<'trainee' | 'observer'>('trainee')
  const ws = useRef<WebSocket | null>(null)
  // Use refs to avoid stale closures in WebSocket handlers
  const roleRef = useRef<'trainee' | 'observer'>(role)
  const userIdRef = useRef<string>(userId)
  // Track authentication state
  const isAuthenticatedRef = useRef<boolean>(false)
  // Track messages we've added locally to prevent duplicates from WebSocket echoes
  // Key format: `${userId}:${role}:${content}` - tracks locally added messages
  const locallyAddedMessages = useRef<Set<string>>(new Set())

  // Keep refs in sync with state
  useEffect(() => {
    roleRef.current = role
  }, [role])

  useEffect(() => {
    userIdRef.current = userId
  }, [userId])

  const memory = useConversationMemory(userId, sessionId)

  useEffect(() => {
    // Load conversation history from memory
    memory.getConversationHistory().then((history) => {
      if (history && history.length > 0) {
        setConversation(
          history.map((m) => ({
            role: m.metadata?.role || 'client',
            message: m.content,
          })),
        )
      }
    })
  }, [memory])

  // WebSocket Connection - only reconnect when sessionId or userId changes, not when role changes
  useEffect(() => {
    // Clear deduplication set when reconnecting (new session or user)
    locallyAddedMessages.current.clear()
    // Reset authentication state on reconnect
    isAuthenticatedRef.current = false

    // Get WebSocket URL from environment variable, fallback to localhost for development
    const wsUrl = import.meta.env.PUBLIC_TRAINING_WS_URL || 'ws://localhost:8084'
    const websocket = new WebSocket(wsUrl)
    ws.current = websocket

    websocket.onopen = () => {
      console.log('Connected to Training Server')

      // First, authenticate with the server
      // In development, we can send a simple token (or empty string)
      // In production, this should be a real JWT/session token
      const authToken = '' // TODO: Get actual auth token from auth context
      websocket.send(JSON.stringify({
        type: 'authenticate',
        payload: {
          token: authToken
        }
      }))
    }

    websocket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        // Handle authentication response
        if (msg.type === 'authenticated') {
          console.log('Authenticated with Training Server', msg.payload)
          isAuthenticatedRef.current = true
          // After authentication, join the session
          const currentRole = roleRef.current
          const currentUserId = userIdRef.current
          websocket.send(JSON.stringify({
            type: 'join_session',
            payload: {
              sessionId,
              role: currentRole,
              userId: currentUserId
            }
          }))
          return
        }

        // Handle session join confirmation
        if (msg.type === 'session_joined') {
          console.log('Joined session', msg.payload)
          return
        }

        // Handle errors
        if (msg.type === 'error') {
          console.error('WebSocket error:', msg.payload.message)
          return
        }

        if (msg.type === 'session_message') {
          const messageContent = msg.payload.content
          const messageRole = msg.payload.role
          const messageUserId = msg.payload.userId

          // Create a deduplication key: userId + role + content
          // This identifies unique messages regardless of timestamp
          const messageKey = `${messageUserId}:${messageRole}:${messageContent}`

          // Skip if we've already added this message locally (prevents duplicate from echo)
          if (locallyAddedMessages.current.has(messageKey)) {
            return
          }

          // Use refs to get current values, avoiding stale closures
          const currentRole = roleRef.current

          // For observers: always add messages (they don't update local state themselves)
          // For trainees: add all messages that pass the deduplication check
          // The deduplication key (checked above) already prevents duplicates from own messages
          // This allows multiple trainees with the same userId to see each other's messages
          if (currentRole === 'observer') {
            setConversation(prev => [...prev, { role: messageRole, message: messageContent }])
          } else {
            // Trainee: add message if it passed deduplication check (not a duplicate of own message)
            setConversation(prev => [...prev, { role: messageRole, message: messageContent }])
          }
        }

        if (msg.type === 'coaching_note') {
          const noteContent = msg.payload.content
          const noteAuthorId = msg.payload.authorId

          // Create a deduplication key: authorId + type + content
          // This identifies unique coaching notes regardless of timestamp
          const noteKey = `${noteAuthorId}:coaching_note:${noteContent}`

          // Skip if we've already added this note locally (prevents duplicate from echo)
          // This handles both our own notes (added before sending) and any network duplicates
          if (locallyAddedMessages.current.has(noteKey)) {
            return
          }

          // Add the note to state (it's either from another observer or a new note we haven't seen)
          setCoachingNotes(prev => [...prev, msg.payload])
        }
      } catch (e) {
        console.error('Error parsing WS message', e)
      }
    }

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    websocket.onclose = () => {
      console.log('WebSocket connection closed')
    }

    return () => {
      // Cleanup: close the WebSocket connection when effect re-runs or component unmounts
      if (websocket.readyState === WebSocket.OPEN || websocket.readyState === WebSocket.CONNECTING) {
        websocket.close()
      }
      ws.current = null
    }
  }, [sessionId, userId]) // Removed 'role' from dependencies to prevent reconnection loops

  // Handle role changes by sending a new join_session message without reconnecting
  useEffect(() => {
    // Clear the deduplication set when role changes to prevent false-positive filtering
    // This ensures messages aren't incorrectly filtered after role switches
    locallyAddedMessages.current.clear()

    // Reset conversation state when role changes to prevent mixing trainee and observer contexts
    // Observers should see the live session conversation (populated by WebSocket)
    // Trainees will rebuild their conversation through interaction
    setConversation([{ role: 'client', message: initialClientMessage }])
    setEvaluation(null) // Clear evaluation feedback when switching roles

    // When role changes, rejoin the session with the new role
    if (ws.current?.readyState === WebSocket.OPEN && isAuthenticatedRef.current) {
      // If already authenticated, just send join_session with new role
      const currentUserId = userIdRef.current
      ws.current.send(JSON.stringify({
        type: 'join_session',
        payload: {
          sessionId,
          role: roleRef.current,
          userId: currentUserId
        }
      }))
    } else if (ws.current?.readyState === WebSocket.OPEN) {
      // If not authenticated, authenticate first (join will happen in auth handler)
      const authToken = '' // TODO: Get actual auth token from auth context
      ws.current.send(JSON.stringify({
        type: 'authenticate',
        payload: {
          token: authToken
        }
      }))
    }
  }, [role, sessionId]) // Only send join_session when role changes, don't reconnect

  const handleResponse = async () => {
    // Use refs to get current values
    const currentRole = roleRef.current
    const currentUserId = userIdRef.current

    if (currentRole === 'observer') {
      // Observers send coaching notes
      if (!therapistResponse.trim()) return

      // Mark this note as locally added to prevent duplicate from WebSocket echo
      // Key format matches what we check in the WebSocket message handler
      const noteKey = `${currentUserId}:coaching_note:${therapistResponse}`
      locallyAddedMessages.current.add(noteKey)

      // Add note to local state immediately so it appears in UI right away
      // The WebSocket echo will be skipped due to the deduplication key
      setCoachingNotes(prev => [...prev, {
        authorId: currentUserId,
        content: therapistResponse,
        timestamp: new Date().toISOString()
      }])

      ws.current?.send(JSON.stringify({
        type: 'coaching_note',
        payload: { content: therapistResponse }
      }))
      setTherapistResponse('')
      return
    }

    // Trainee Logic
    const therapistMessage = { role: 'therapist' as const, message: therapistResponse }
    setConversation([
      ...conversation,
      therapistMessage,
    ])
    await memory.addMessage(therapistResponse, 'user')

    // Mark this message as locally added to prevent duplicate from WebSocket echo
    // Key format matches what we check in the WebSocket message handler
    const messageKey = `${currentUserId}:therapist:${therapistResponse}`
    locallyAddedMessages.current.add(messageKey)

    // Broadcast to WS (server will add its own timestamp)
    ws.current?.send(JSON.stringify({
      type: 'session_message',
      payload: { content: therapistResponse, role: 'therapist' }
    }))

    // Prepare session object for bias detection
    const sessionPayload = {
      session: {
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        participantDemographics: { userId: currentUserId },
        scenario: 'therapist-training',
        content: [
          ...conversation,
          { role: 'therapist', message: therapistResponse },
        ],
        metadata: {},
      },
    }

    interface BiasAnalysisResult {
      overallScore: number
      riskLevel: string
      recommendations?: string[]
    }

    // Call bias detection API
    let biasResult: BiasAnalysisResult | null = null
    try {
      const res = await fetch('/api/bias-detection/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionPayload),
      })
      if (res.ok) {
        const data = await res.json()
        if (data && data.success && data.data) {
          biasResult = data.data
        }
      }
    } catch (err) {
      console.error('Bias analysis failed:', err)
      // fallback: no bias result
    }

    // Show bias analysis feedback
    if (biasResult) {
      setEvaluation(
        `Bias Score: ${biasResult.overallScore} | Risk Level: ${biasResult.riskLevel}\nRecommendations: ${biasResult.recommendations?.join(', ')}`,
      )
    } else {
      setEvaluation('Bias analysis unavailable.')
    }

    // Fetch next client message from real backend
    let nextClientMsg = 'Thank you for your response.'
    try {
      const payload = {
        messages: [
          ...conversation.map((entry) => ({
            role: entry.role,
            content: entry.message,
          })),
          { role: 'user', content: therapistResponse },
        ],
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.2',
        temperature: 0.7,
        maxResponseTokens: 256,
      }
      const res = await fetch('/api/ai/response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) {
        const data = await res.json()
        if (data && data.content) {
          nextClientMsg = data.content
        }
      }
    } catch (err) {
      console.error('AI response generation failed:', err)
      // fallback to static reply
    }

    // Update local state
    const clientMessage = { role: 'client' as const, message: nextClientMsg }
    setConversation((prev) => [
      ...prev,
      clientMessage,
    ])
    await memory.addMessage(nextClientMsg, 'assistant')

    // Mark this message as locally added to prevent duplicate from WebSocket echo
    // Key format matches what we check in the WebSocket message handler
    // Note: AI messages are sent by the trainee, so they use the trainee's userId
    // Reuse currentUserId from the top of the function
    const clientMessageKey = `${currentUserId}:client:${nextClientMsg}`
    locallyAddedMessages.current.add(clientMessageKey)

    // Broadcast AI response to WS (server will add its own timestamp)
    ws.current?.send(JSON.stringify({
      type: 'session_message',
      payload: { content: nextClientMsg, role: 'client' }
    }))

    setTherapistResponse('')
  }

  return (
    <div className="max-w-4xl mx-auto p-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            Therapist Training Session
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setRole('trainee')}
              className={`px-3 py-1 rounded text-sm ${role === 'trainee' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Trainee
            </button>
            <button
              onClick={() => setRole('observer')}
              className={`px-3 py-1 rounded text-sm ${role === 'observer' ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300'}`}
            >
              Observer
            </button>
          </div>
        </div>

        <div className="mb-6 space-y-4 max-h-96 overflow-y-auto">
          {conversation.map((entry, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-lg ${entry.role === 'client'
                ? 'bg-blue-500/20 border-l-4 border-blue-500'
                : 'bg-green-500/20 border-l-4 border-green-500'
                }`}
            >
              <div className="font-semibold text-sm text-gray-300 mb-1">
                {entry.role === 'client' ? 'Client' : 'Therapist'}
              </div>
              <div className="text-white">{entry.message}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <textarea
            value={therapistResponse}
            onChange={(e) => setTherapistResponse(e.target.value)}
            rows={3}
            className={`w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${role === 'observer' ? 'focus:ring-purple-500' : 'focus:ring-blue-500'}`}
            placeholder={role === 'observer' ? "Add a coaching note..." : "Type your therapeutic response..."}
          />

          <button
            onClick={handleResponse}
            disabled={!therapistResponse.trim()}
            className={`w-full py-3 px-6 font-medium rounded-lg transition-colors text-white ${role === 'observer'
              ? 'bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600'
              : 'bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600'
              }`}
          >
            {role === 'observer' ? 'Send Note' : 'Send Response'}
          </button>
        </div>

        {evaluation && (
          <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
            <div className="font-semibold text-yellow-300 mb-2">AI Feedback</div>
            <div className="text-white whitespace-pre-line">{evaluation}</div>
          </div>
        )}
      </div>

      {/* Sidebar for Coaching Notes */}
      <div className="md:col-span-1 bg-black/20 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-purple-300 mb-4">Coaching Notes</h3>
        {coachingNotes.length === 0 ? (
          <div className="text-gray-400 text-sm italic">No notes yet.</div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {coachingNotes.map((note, i) => (
              <div key={i} className="bg-purple-900/30 border border-purple-500/30 p-3 rounded text-sm">
                <div className="text-purple-200 mb-1">{note.content}</div>
                <div className="text-purple-400/50 text-xs">{new Date(note.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
