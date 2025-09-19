import { useState, useEffect } from 'react'
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
    <div className="max-w-2xl mx-auto p-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl">
      <h2 className="text-2xl font-bold text-white mb-6">Therapist Training Session</h2>
      
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
          className="w-full p-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type your therapeutic response..."
        />
        
        <button 
          onClick={handleResponse} 
          disabled={!therapistResponse.trim()}
          className="w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          Send Response
        </button>
      </div>

      {evaluation && (
        <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
          <div className="font-semibold text-yellow-300 mb-2">AI Feedback</div>
          <div className="text-white whitespace-pre-line">{evaluation}</div>
        </div>
      )}
    </div>
  )
}