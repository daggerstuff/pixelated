import { useState, useEffect } from 'react'
import { useConversationMemory } from '../hooks/useMemory'

// Basic UI scaffold for therapist training session
const initialClientMessage =
  'Hello, I am your client. How can you help me today?'

export default function TrainingSession() {
  // For demo, use static user/session
  const userId = 'demo-therapist'
  const sessionId = 'session-1'
  // Removed unused clientMessage state
  const [therapistResponse, setTherapistResponse] = useState('')
  const [conversation, setConversation] = useState([
    { role: 'client', message: initialClientMessage },
  ])
  const [evaluation, setEvaluation] = useState<string | null>(null)
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
  }, [])

  // ...existing code...

  const handleResponse = async () => {
    setConversation([
      ...conversation,
      { role: 'therapist', message: therapistResponse },
    ])
    await memory.addMessage(therapistResponse, 'user')

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

    // Fetch next client message from real backend (unchanged)
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
    setConversation((prev) => [
      ...prev,
      { role: 'client', message: nextClientMsg },
    ])
    await memory.addMessage(nextClientMsg, 'assistant')
    setTherapistResponse('')
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 32 }}>
      <h2>Therapist Training Session</h2>
      <div style={{ marginBottom: 24 }}>
        {conversation.map((entry, idx) => (
          <div key={idx} style={{ marginBottom: 8 }}>
            <strong>{entry.role === 'client' ? 'Client' : 'Therapist'}:</strong>{' '}
            {entry.message}
          </div>
        ))}
      </div>
      <textarea
        value={therapistResponse}
        onChange={(e) => setTherapistResponse(e.target.value)}
        rows={3}
        style={{ width: '100%', marginBottom: 12 }}
        placeholder="Type your response..."
      />
      <button onClick={handleResponse} disabled={!therapistResponse.trim()}>
        Send Response
      </button>
      {evaluation && (
        <div style={{ marginTop: 16, fontWeight: 'bold' }}>{evaluation}</div>
      )}
    </div>
  )
}
