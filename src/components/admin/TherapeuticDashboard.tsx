import React, { useState, useEffect } from 'react'

import {
  therapeuticClient,
  type CrisisResult,
  type PIIScrubResult,
} from '@/lib/api/therapeutic'

export const TherapeuticDashboard: React.FC = () => {
  type HealthStatus = { status: string; service?: string; mode?: string }

  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [inputText, setInputText] = useState('')
  const [analysis, setAnalysis] = useState<{
    crisis?: CrisisResult
    pii?: PIIScrubResult
  }>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    void checkHealth()
  }, [])

  const checkHealth = async () => {
    try {
      const status = await therapeuticClient.healthCheck()
      setHealth(status)
    } catch {
      setHealth({ status: 'offline' })
    }
  }

  const runAnalysis = async () => {
    setLoading(true)
    try {
      const [crisis, pii] = await Promise.all([
        therapeuticClient.detectCrisis(inputText),
        therapeuticClient.scrubPII(inputText), // No session ID for test
      ])
      setAnalysis({ crisis, pii })
    } catch (e: unknown) {
      console.error(e)
      alert('Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='bg-gray-50 border-gray-100 mx-auto max-w-4xl rounded-xl border p-6 shadow-sm'>
      <div className='mb-6 flex items-center justify-between'>
        <h2 className='text-gray-800 text-2xl font-bold'>
          Therapeutic AI Dashboard
        </h2>
        <div
          className={`rounded-full px-3 py-1 text-sm font-medium ${
            health?.status === 'healthy'
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          API: {health?.status || 'Unknown'}{' '}
          {health?.mode && `(${health.mode})`}
        </div>
      </div>

      <div className='space-y-6'>
        {/* Input Section */}
        <div className='bg-white border-gray-200 rounded-lg border p-4'>
          <label
            htmlFor='therapeutic-dashboard-input'
            className='text-gray-700 mb-2 block text-sm font-medium'
          >
            Test Input (Patient Transcript)
          </label>
          <textarea
            id='therapeutic-dashboard-input'
            className='border-gray-300 focus:ring-blue-500 focus:border-blue-500 h-32 w-full rounded-md border p-3 focus:ring-2'
            placeholder="Enter text here... (e.g., 'I am feeling hopeless and want to end it all')"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className='mt-3 flex justify-end'>
            <button
              onClick={runAnalysis}
              disabled={loading || !inputText}
              className='bg-blue-600 text-white hover:bg-blue-700 rounded-md px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50'
            >
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </div>

        {/* Results Grid */}
        <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
          {/* Crisis Detection Results */}
          <div className='bg-white border-gray-200 rounded-lg border p-4'>
            <h3 className='text-gray-800 mb-3 flex items-center gap-2 text-lg font-semibold'>
              🚑 Crisis Detection
            </h3>
            {analysis.crisis ? (
              <div className='space-y-3'>
                <div
                  className={`rounded-md p-3 ${
                    analysis.crisis.has_crisis_signal
                      ? 'bg-red-50 border-red-200 border'
                      : 'bg-green-50 border-green-200 border'
                  }`}
                >
                  <div className='flex justify-between'>
                    <span className='font-medium'>Risk Level:</span>
                    <span
                      className={`font-bold uppercase ${
                        analysis.crisis.risk_level === 'imminent'
                          ? 'text-red-700'
                          : analysis.crisis.risk_level === 'high'
                            ? 'text-orange-600'
                            : 'text-gray-600'
                      }`}
                    >
                      {analysis.crisis.risk_level}
                    </span>
                  </div>
                </div>

                {analysis.crisis.signals.length > 0 && (
                  <div>
                    <h4 className='text-gray-500 mb-2 text-xs font-semibold uppercase'>
                      Detected Signals
                    </h4>
                    <ul className='space-y-2'>
                      {analysis.crisis.signals.map((signal, idx) => (
                        <li
                          key={`signal-${signal.category}-${signal.context}-${signal.id || idx}`}
                          className='bg-gray-50 rounded p-2 text-sm'
                        >
                          <span className='text-indigo-700 font-medium'>
                            {signal.category}:
                          </span>{' '}
                          {signal.context}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.crisis.action_required && (
                  <div className='mt-2'>
                    <h4 className='text-gray-500 mb-1 text-xs font-semibold uppercase'>
                      Protocol
                    </h4>
                    <ul className='text-gray-700 list-inside list-disc text-sm'>
                      {analysis.crisis.escalation_protocol.map((step) => (
                        <li
                          key={`protocol-step-${step.replace(/\s+/g, '-').toLowerCase()}`}
                        >
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className='text-gray-400 py-4 text-center text-sm italic'>
                No analysis run yet
              </div>
            )}
          </div>

          {/* PII Scrubbing Results */}
          <div className='bg-white border-gray-200 rounded-lg border p-4'>
            <h3 className='text-gray-800 mb-3 flex items-center gap-2 text-lg font-semibold'>
              🔒 PII Scrubber
            </h3>
            {analysis.pii ? (
              <div className='space-y-3'>
                <div className='bg-gray-50 border-gray-200 rounded-md border p-3 font-mono text-sm'>
                  {analysis.pii.scrubbed_text}
                </div>
                <div className='text-gray-500 flex gap-4 text-xs'>
                  <span>Original Length: {analysis.pii.original_length}</span>
                  <span>Scrubbed Length: {analysis.pii.scrubbed_length}</span>
                </div>
              </div>
            ) : (
              <div className='text-gray-400 py-4 text-center text-sm italic'>
                No analysis run yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
