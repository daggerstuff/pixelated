import { useState, useEffect, useRef } from 'react'
import { useConversationMemory } from '../../hooks/useMemory'

// Basic UI scaffold for therapist training session
const initialClientMessage =
  'Hello, I am your client. How can you help me today?'

export function TrainingSessionComponent() {
  // For demo, use static user/session
  const userId = 'demo-therapist'
  const sessionId = 'session-1'
  const [therapistResponse, setTherapistResponse] = useState('')
  const [conversation, setConversation] = useState([
    { role: 'client', message: initialClientMessage },
  ])
  const [evaluation, setEvaluation] = useState<string | null>(null)
  const [coachingNotes, setCoachingNotes] = useState<Array<{authorId: string, content: string, timestamp: string}>>([])

  // Fishbowl Mode State
  const [role, setRole] = useState<'trainee' | 'observer'>('trainee')
  const ws = useRef<WebSocket | null>(null)

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

  // WebSocket Connection
  useEffect(() => {
    // In production, this URL should be configurable
    ws.current = new WebSocket('ws://localhost:8084')

    ws.current.onopen = () => {
      console.log('Connected to Training Server')
      ws.current?.send(JSON.stringify({
        type: 'join_session',
        payload: { sessionId, role, userId: role === 'observer' ? 'demo-observer' : userId }
      }))
    }

    ws.current.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        if (msg.type === 'session_message') {
           // Only update if we don't have this message already (basic dedup)
           // For now, rely on local update for sender, and WS for observer
           if (role === 'observer' || msg.payload.userId !== userId) {
             setConversation(prev => [...prev, { role: msg.payload.role, message: msg.payload.content }])
           }
        }

        if (msg.type === 'coaching_note') {
          setCoachingNotes(prev => [...prev, msg.payload])
        }
      } catch (e) {
        console.error('Error parsing WS message', e)
      }
    }

    return () => {
      ws.current?.close()
    }
  }, [role, sessionId, userId])

  const handleResponse = async () => {
    if (role === 'observer') {
      // Observers send coaching notes
      if (!therapistResponse.trim()) return

      ws.current?.send(JSON.stringify({
        type: 'coaching_note',
        payload: { content: therapistResponse }
      }))
      setTherapistResponse('')
      return
    }

    // Trainee Logic
    setConversation([
      ...conversation,
      { role: 'therapist', message: therapistResponse },
    ])
    await memory.addMessage(therapistResponse, 'user')

    // Broadcast to WS
    ws.current?.send(JSON.stringify({
      type: 'session_message',
      payload: { content: therapistResponse, role: 'therapist' }
    }))

    // Prepare session object for bias detection
    const sessionPayload = {
      session: {
        sessionId: sessionId,
        timestamp: new Date().toISOString(),
        participantDemographics: { userId },
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
      // fallback to static reply
    }

    // Update local state
    setConversation((prev) => [
      ...prev,
      { role: 'client', message: nextClientMsg },
    ])
    await memory.addMessage(nextClientMsg, 'assistant')

    // Broadcast AI response to WS
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
              className={`p-4 rounded-lg ${
                entry.role === 'client'
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
            className={`w-full py-3 px-6 font-medium rounded-lg transition-colors text-white ${
              role === 'observer'
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
