// RecommendationServiceDemo.tsx: Interactive demo for RecommendationService API
import React, { useState } from 'react'
import RecommendationDisplay from '../../components/ai/RecommendationDisplay'
import { v4 as uuidv4 } from 'uuid'

interface ClientProfile {
  id: string
  name: string
  background: string
  risk: 'none' | 'moderate' | 'high'
  culturalFactors: string[]
}

interface DemoRecommendation {
  id: string
  title: string
  description: string
  priority: string
  [key: string]: any
}

// Example profiles for demonstration
const demoClients: ClientProfile[] = [
  {
    id: uuidv4(),
    name: 'Alex Johnson',
    background: 'Tech professional, high workplace stress, meditates sometimes',
    risk: 'moderate',
    culturalFactors: ['Western', 'Urban', 'Tech-savvy']
  },
  {
    id: uuidv4(),
    name: 'Maya Patel',
    background: 'Student, first-gen immigrant, struggles with family expectations',
    risk: 'none',
    culturalFactors: ['South Asian', 'Second Language Learner']
  },
  {
    id: uuidv4(),
    name: 'Jordan Lee',
    background: 'Artist, history of depression, social withdrawal lately',
    risk: 'high',
    culturalFactors: ['LGBTQ+', 'Urban']
  }
]

const demoIndications = [
  'Chronic stress',
  'Sleep problems',
  'Depression',
  'Anxiety',
  'Pain management'
]

export default function RecommendationServiceDemo() {
  const [client, setClient] = useState<ClientProfile>(demoClients[0])
  const [indications, setIndications] = useState<string[]>([demoIndications[0]])
  const [showPersonalization, setShowPersonalization] = useState(true)
  const [showEfficacy, setShowEfficacy] = useState(true)
  const [showAlternatives, setShowAlternatives] = useState(true)
  const [recommendations, setRecommendations] = useState<DemoRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [session, setSession] = useState<string | null>(null) // for future auth/demo

  const handleClientChange = (clientId: string) => {
    const found = demoClients.find(c => c.id === clientId)
    if (found) setClient(found)
  }

  const handleIndicationToggle = (name: string) => {
    setIndications(prev =>
      prev.includes(name) ? prev.filter(i => i !== name) : [...prev, name]
    )
  }

  const handleRequestRecommendations = async () => {
    setLoading(true)
    setError(null)
    setRecommendations([])

    // For real demo, clientId should be UUID; generate if not present
    const clientId = client.id || uuidv4()
    try {
      const resp = await fetch('/api/ai/recommendations/enhanced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          indications,
          includePersonalization: showPersonalization,
          includeEfficacyStats: showEfficacy,
          includeAlternativeApproaches: showAlternatives,
          maxMediaRecommendations: 3
        })
      })
      const data = await resp.json()
      if (data.success) {
        setRecommendations(data.data.recommendations)
      } else {
        setError(data.error || 'Unable to fetch recommendations')
      }
    } catch (err: any) {
      setError(err?.message || 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  function exportRecommendations() {
    if (!recommendations?.length) return
    const blob = new Blob([JSON.stringify(recommendations, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recommendations-${client.name.replace(/\s+/g, '_')}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem' }}>
      <h1>RecommendationService Interactive Demo</h1>
      <p>
        This demo lets you generate recommendations for predefined client profiles and custom scenarios. Adjust settings and click 'Generate' to see dynamic, real results from the RecommendationService.
      </p>

      <section style={{ margin: '2rem 0' }}>
        <h2>Step 1: Select Client Profile</h2>
        <div>
          <select value={client.id} onChange={e => handleClientChange(e.target.value)}>
            {demoClients.map(cli => (
              <option value={cli.id} key={cli.id}>
                {cli.name} - {cli.background}
              </option>
            ))}
          </select>
          <button
            style={{ marginLeft: 12 }}
            type="button"
            onClick={() => {
              // Pick a random client
              const idx = Math.floor(Math.random() * demoClients.length)
              setClient(demoClients[idx])
            }}
          >
            Random Client
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 14 }}>
          <b>Background:</b> {client.background} <br />
          <b>Risk:</b> {client.risk} <br />
          <b>Cultural Factors:</b> {client.culturalFactors.join(', ')}
        </div>
      </section>

      <section style={{ margin: '2rem 0' }}>
        <h2>Step 2: Indications Presented</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {demoIndications.map(name => (
            <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="checkbox"
                checked={indications.includes(name)}
                onChange={() => handleIndicationToggle(name)}
              />
              {name}
            </label>
          ))}
        </div>
      </section>

      <section style={{ margin: '2rem 0' }}>
        <h2>Step 3: Options (Real-Time Controls)</h2>
        <label>
          <input
            type="checkbox"
            checked={showPersonalization}
            onChange={() => setShowPersonalization(v => !v)}
          />
          Personalization Details
        </label>
        <label style={{ marginLeft: 20 }}>
          <input
            type="checkbox"
            checked={showEfficacy}
            onChange={() => setShowEfficacy(v => !v)}
          />
          Efficacy Stats
        </label>
        <label style={{ marginLeft: 20 }}>
          <input
            type="checkbox"
            checked={showAlternatives}
            onChange={() => setShowAlternatives(v => !v)}
          />
          Alternatives
        </label>
      </section>

      <section style={{ margin: '2rem 0' }}>
        <button type="button" onClick={handleRequestRecommendations} disabled={loading}>
          {loading ? 'Loading...' : 'Generate Recommendations'}
        </button>
        <button
          type="button"
          style={{ marginLeft: 20 }}
          onClick={exportRecommendations}
          disabled={!recommendations?.length}
        >
          Export Results
        </button>
      </section>

      {error && (
        <div style={{ color: 'red', margin: '1rem 0' }}>
          <b>Error:</b> {error}
        </div>
      )}

      <section>
        <h2>Generated Recommendations</h2>
        <RecommendationDisplay recommendations={recommendations as any} />
      </section>
    </div>
  )
}