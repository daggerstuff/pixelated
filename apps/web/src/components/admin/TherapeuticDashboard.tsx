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

  async function checkHealth() {
    try {
      const status = await therapeuticClient.healthCheck()
      setHealth(status)
    } catch {
      setHealth({ status: 'offline' })
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkHealth()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const runAnalysis = async () => {
    setLoading(true)
    try {
      const [crisis, pii] = await Promise.all([
        therapeuticClient.detectCrisis(inputText),
        therapeuticClient.scrubPII(inputText), // No session ID for test
      ])
      setAnalysis({ crisis, pii })
    } catch (e: unknown) {
      alert('Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl rounded-none border border-border bg-secondary p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">
          Therapeutic AI Dashboard
        </h2>
        <div
          className={`rounded-none px-3 py-1 text-sm font-medium ${
            health?.status === 'healthy'
              ? 'border border-input bg-secondary text-foreground'
              : 'border border-ring bg-card font-semibold text-foreground'
          }`}
        >
          API: {health?.status ?? 'Unknown'}{' '}
          {health?.mode && `(${health.mode})`}
        </div>
      </div>

      <div className="space-y-6">
        {/* Input Section */}
        <div className="rounded-none border border-border bg-card p-4">
          <label
            htmlFor="therapeutic-dashboard-input"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Test Input (Patient Transcript)
          </label>
          <textarea
            id="therapeutic-dashboard-input"
            className="h-32 w-full rounded-none border border-input p-3 focus:border-ring focus:ring-2 focus:ring-ring"
            placeholder="Enter text here... (e.g., 'I am feeling hopeless and want to end it all')"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className="mt-3 flex justify-end">
            <button
              onClick={runAnalysis}
              disabled={loading || !inputText}
              className="rounded-none bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Run Analysis'}
            </button>
          </div>
        </div>

        {/* Results Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Crisis Detection Results */}
          <div className="rounded-none border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
              🚑 Crisis Detection
            </h3>
            {analysis.crisis ? (
              <div className="space-y-3">
                <div
                  className={`rounded-none p-3 ${
                    analysis.crisis.has_crisis_signal
                      ? 'border border-ring bg-card'
                      : 'border border-input bg-secondary'
                  }`}
                >
                  <div className="flex justify-between">
                    <span className="font-medium">Risk Level:</span>
                    <span
                      className={`font-bold uppercase ${
                        analysis.crisis.risk_level === 'imminent'
                          ? 'font-semibold text-foreground'
                          : analysis.crisis.risk_level === 'high'
                            ? 'font-medium text-foreground'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {analysis.crisis.risk_level}
                    </span>
                  </div>
                </div>

                {analysis.crisis.signals.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      Detected Signals
                    </h4>
                    <ul className="space-y-2">
                      {analysis.crisis.signals.map((signal, idx) => (
                        <li
                          key={`signal-${signal.category}-${signal.context}-${signal.id ?? idx}`}
                          className="rounded-none bg-secondary p-2 text-sm"
                        >
                          <span className="font-medium text-foreground">
                            {signal.category}:
                          </span>{' '}
                          {signal.context}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.crisis.action_required && (
                  <div className="mt-2">
                    <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Protocol
                    </h4>
                    <ul className="list-inside list-disc text-sm text-foreground">
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
              <div className="py-4 text-center text-sm italic text-muted-foreground">
                No analysis run yet
              </div>
            )}
          </div>

          {/* PII Scrubbing Results */}
          <div className="rounded-none border border-border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
              🔒 PII Scrubber
            </h3>
            {analysis.pii ? (
              <div className="space-y-3">
                <div className="rounded-none border border-border bg-secondary p-3 font-mono text-sm">
                  {analysis.pii.scrubbed_text}
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Original Length: {analysis.pii.original_length}</span>
                  <span>Scrubbed Length: {analysis.pii.scrubbed_length}</span>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-sm italic text-muted-foreground">
                No analysis run yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
