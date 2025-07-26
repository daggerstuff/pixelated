import React, { useState } from 'react'
import { ChartWidget } from '@/components/analytics/ChartWidget'

interface ForecastForm {
  sessionId: string
  clientId: string
  therapistId: string
  startTime: string
  status: string
  securityLevel: string
  emotionAnalysisEnabled: boolean
  desiredOutcomes: string
}

interface ForecastResult {
  technique: string
  score: number
  rationale: string
}

const initialForm: ForecastForm = {
  sessionId: '',
  clientId: '',
  therapistId: '',
  startTime: '',
  status: 'active',
  securityLevel: 'standard',
  emotionAnalysisEnabled: true,
  desiredOutcomes: '',
}

const TreatmentForecastForm: React.FC = () => {
  const [form, setForm] = useState<ForecastForm>(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<ForecastResult[] | null>(null)

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setForm((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }))
    } else {
      setForm((prev) => ({
        ...prev,
        [name]: value,
      }))
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const payload = {
        session: {
          sessionId: form.sessionId,
          clientId: form.clientId,
          therapistId: form.therapistId,
          startTime: form.startTime,
          status: form.status,
          securityLevel: form.securityLevel,
          emotionAnalysisEnabled: form.emotionAnalysisEnabled,
        },
        chatSession: {},
        recentEmotionState: null,
        recentInterventions: [],
        desiredOutcomes: form.desiredOutcomes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }
      const res = await fetch('/api/analytics/treatment-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to fetch forecast')
        setLoading(false)
        return
      }
      setResults(data.data.forecasts)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="sessionId" className="block font-medium">
            Session ID
          </label>
          <input
            id="sessionId"
            name="sessionId"
            value={form.sessionId}
            onChange={handleChange}
            required
            className="input input-bordered w-full"
          />
        </div>
        <div>
          <label htmlFor="clientId" className="block font-medium">
            Client ID
          </label>
          <input
            id="clientId"
            name="clientId"
            value={form.clientId}
            onChange={handleChange}
            required
            className="input input-bordered w-full"
          />
        </div>
        <div>
          <label htmlFor="therapistId" className="block font-medium">
            Therapist ID
          </label>
          <input
            id="therapistId"
            name="therapistId"
            value={form.therapistId}
            onChange={handleChange}
            required
            className="input input-bordered w-full"
          />
        </div>
        <div>
          <label htmlFor="startTime" className="block font-medium">
            Start Time
          </label>
          <input
            id="startTime"
            name="startTime"
            type="datetime-local"
            value={form.startTime}
            onChange={handleChange}
            required
            className="input input-bordered w-full"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="status" className="block font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            value={form.status}
            onChange={handleChange}
            className="input input-bordered w-full"
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
            <option value="emergency">Emergency</option>
          </select>
        </div>
        <div>
          <label htmlFor="securityLevel" className="block font-medium">
            Security Level
          </label>
          <select
            id="securityLevel"
            name="securityLevel"
            value={form.securityLevel}
            onChange={handleChange}
            className="input input-bordered w-full"
          >
            <option value="standard">Standard</option>
            <option value="hipaa">HIPAA</option>
            <option value="fhe">FHE</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="emotionAnalysisEnabled" className="block font-medium">
          Enable Emotion Analysis
        </label>
        <input
          id="emotionAnalysisEnabled"
          name="emotionAnalysisEnabled"
          type="checkbox"
          checked={form.emotionAnalysisEnabled}
          onChange={handleChange}
          className="checkbox"
        />
      </div>
      <div>
        <label htmlFor="desiredOutcomes" className="block font-medium">
          Desired Outcomes{' '}
          <span className="text-xs text-gray-500">(comma-separated)</span>
        </label>
        <input
          id="desiredOutcomes"
          name="desiredOutcomes"
          value={form.desiredOutcomes}
          onChange={handleChange}
          required
          className="input input-bordered w-full"
          placeholder="e.g., reduce anxiety, improve sleep"
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary w-full"
        disabled={loading}
      >
        {loading ? 'Forecasting...' : 'Get Forecast'}
      </button>
      {error && <div className="alert alert-error mt-4">{error}</div>}
      {results && (
        <section className="mt-8">
          <h2 className="text-2xl font-semibold mb-2">Forecast Results</h2>
          <ChartWidget
            title="Predicted Efficacy by Technique"
            chartType="bar"
            labels={results.map((r) => r.technique)}
            series={[
              { name: 'Predicted Efficacy', data: results.map((r) => r.score) },
            ]}
            height={300}
          />
          <ul className="mt-4 space-y-2">
            {results.map((r) => (
              <li key={r.technique} className="bg-gray-50 rounded p-3 border">
                <strong>{r.technique}</strong>: {Math.round(r.score * 100)}%
                efficacy
                <br />
                <span className="text-xs text-gray-600">{r.rationale}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </form>
  )
}

export default TreatmentForecastForm
