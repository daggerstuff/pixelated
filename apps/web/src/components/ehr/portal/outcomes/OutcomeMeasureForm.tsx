import {
  AlertTriangle,
  CheckCircle,
  ClipboardCheck,
  Clock,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

type MeasureType = 'phq-9' | 'gad-7' | 'oq-45'

interface MeasureInfo {
  measureType: MeasureType
  displayName: string
  maxScore: number
}

interface ErrorResponse {
  error: { code: string; message: string }
}

interface SubmitResult {
  data: {
    response: {
      id: string
      resourceType: 'QuestionnaireResponse'
      status: string
      authored: string
    }
    observation: {
      id: string
      resourceType: 'Observation'
      valueQuantity: { value: number }
      interpretation?: Array<{
        coding: Array<{ code: string; display?: string }>
      }>
    }
    score: {
      measureType: MeasureType
      totalScore: number
      maxScore: number
      severity: string
      administeredAt: string
      alertFlag: boolean
      alertReason?: string
      changeFromPrevious?: number
    }
  }
}

const MEASURE_OPTIONS: Array<{
  value: MeasureType
  label: string
  description: string
}> = [
  {
    value: 'phq-9',
    label: 'PHQ-9',
    description: 'Patient Health Questionnaire (9 items)',
  },
  {
    value: 'gad-7',
    label: 'GAD-7',
    description: 'Generalized Anxiety Disorder (7 items)',
  },
  {
    value: 'oq-45',
    label: 'OQ-45',
    description: 'Outcome Questionnaire (45 items)',
  },
]

const PHQ9_QUESTIONS = [
  'Little interest or pleasure in doing things',
  'Feeling down, depressed, or hopeless',
  'Trouble falling/staying asleep, or sleeping too much',
  'Feeling tired or having little energy',
  'Poor appetite or overeating',
  'Feeling bad about yourself — or that you are a failure',
  'Trouble concentrating on things, such as reading or watching TV',
  'Moving or speaking so slowly others notice — or the opposite, being fidgety/restless',
  'Thoughts that you would be better off dead, or of hurting yourself in some way',
]

const GAD7_QUESTIONS = [
  'Feeling nervous, anxious, or on edge',
  'Not being able to stop or control worrying',
  'Worrying too much about different things',
  'Trouble relaxing',
  'Being so restless that it is hard to sit still',
  'Becoming easily annoyed or irritable',
  'Feeling afraid as if something awful might happen',
]

const OQ45_QUESTIONS = [
  'I get along well with others',
  'I feel close to people around me',
  'I feel like a failure',
  'I feel satisfied with my life',
  'I feel socially accepted',
  'I feel tense',
  'I feel like I have no friends',
  'I feel that I am a likeable person',
  'I feel open and talkative',
  'I feel that I can count on others',
  'I feel hopeless about the future',
  'I feel that I am having a lot of trouble getting along with others',
  'I feel that my life is meaningful',
  'I feel afraid',
  'I feel that people respect and esteem me',
  'I feel that I have no reason to live',
  'I feel confused',
  'I feel that I am not useful to others',
  'I feel that others would be better off without me',
  'I feel that my relationships with others are meaningful',
  'I feel like a bad person',
  'I feel that I am not worthwhile',
  'I feel that I am a burden to others',
  'I feel that I am thoughtful and considerate of others',
  'I feel that I give as much as I take in my relationships',
  'I feel that I have a good future ahead of me',
  'I feel like a disappointment to others',
  'I feel that I am a competent person',
  'I feel that I am a good listener',
  'I feel that I am in control of my life',
  'I feel that I function well in situations that are important to me',
  'I feel that others take advantage of me',
  'I feel that my life is heading in a good direction',
  'I feel that I can handle whatever problems come my way',
  'I feel that I am doing a good job at handling my responsibilities',
  'I feel that I am making progress in my life',
  'I feel that I can be open and honest with others',
  'I feel that I can ask others for help when I need it',
  'I feel that I am a strong person',
  'I feel that I am learning to deal with my problems effectively',
  'I feel that I am dealing with my problems well',
  'I feel that I can overcome any obstacles that stand in my way',
  'I feel that I am growing as a person',
  'I feel that I am in a good place in my life',
  'I feel that I am capable of making positive changes in my life',
]

const SEVERITY_COLORS: Record<string, string> = {
  'minimal': 'var(--np-success, #22c55e)',
  'mild': 'var(--np-success, #22c55e)',
  'moderate': 'var(--np-muted)',
  'moderately-severe': 'var(--np-danger, #ef4444)',
  'severe': 'var(--np-danger, #ef4444)',
}

function getQuestions(measure: MeasureType): string[] {
  if (measure === 'phq-9') return PHQ9_QUESTIONS
  if (measure === 'gad-7') return GAD7_QUESTIONS
  return OQ45_QUESTIONS
}

function getAnswerOptions(
  measure: MeasureType,
): Array<{ value: number; label: string }> {
  if (measure === 'oq-45') {
    return [
      { value: 0, label: 'Never' },
      { value: 1, label: 'Rarely' },
      { value: 2, label: 'Sometimes' },
      { value: 3, label: 'Frequently' },
      { value: 4, label: 'Almost always' },
    ]
  }
  return [
    { value: 0, label: 'Not at all' },
    { value: 1, label: 'Several days' },
    { value: 2, label: 'More than half the days' },
    { value: 3, label: 'Nearly every day' },
  ]
}

function formatLink(measure: MeasureType, index: number): string {
  const prefix =
    measure === 'phq-9' ? 'phq9' : measure === 'gad-7' ? 'gad7' : 'oq45'
  return `${prefix}-${String(index + 1).padStart(2, '0')}`
}

export function OutcomeMeasureForm() {
  const [measures, setMeasures] = useState<MeasureInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMeasure, setSelectedMeasure] = useState<MeasureType | null>(
    null,
  )
  const [responses, setResponses] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<SubmitResult['data'] | null>(
    null,
  )
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/ehr/v1/outcomes')
        if (!cancelled && !res.ok) {
          const err = (await res.json()) as ErrorResponse
          throw new Error(
            err.error?.message ?? 'Failed to load available measures',
          )
        }
        if (!cancelled) {
          const result = (await res.json()) as { data: MeasureInfo[] }
          if (!cancelled) setMeasures(result.data)
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : 'Failed to load measures',
          )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSelectMeasure = (measure: MeasureType) => {
    setSelectedMeasure(measure)
    setResponses({})
    setSubmitResult(null)
    setSubmitError(null)
  }

  const handleAnswer = (linkId: string, value: number) => {
    setResponses((prev) => ({ ...prev, [linkId]: value }))
  }

  const handleSubmit = useCallback(async () => {
    if (!selectedMeasure) return
    const questions = getQuestions(selectedMeasure)
    const allAnswered = questions.every((_, idx) => {
      const linkId = formatLink(selectedMeasure, idx)
      return linkId in responses
    })
    if (!allAnswered) {
      setSubmitError('Please answer all questions before submitting.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/ehr/v1/outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: 'me',
          measureType: selectedMeasure,
          responses,
        }),
      })
      if (!res.ok) {
        const err = (await res.json()) as ErrorResponse
        throw new Error(err.error?.message ?? 'Failed to submit measure')
      }
      const result = (await res.json()) as SubmitResult
      setSubmitResult(result.data)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setSubmitting(false)
    }
  }, [selectedMeasure, responses])

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          color: 'var(--np-muted)',
        }}
      >
        <div
          style={{
            width: '1.25rem',
            height: '1.25rem',
            border: '2px solid var(--np-line)',
            borderTopColor: 'var(--np-text)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ marginLeft: '0.75rem' }}>Loading outcome measures…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          padding: '1rem',
          color: 'var(--np-danger, #ef4444)',
          background: 'var(--np-surface)',
          borderRadius: '0.5rem',
          border: '1px solid var(--np-line)',
        }}
      >
        <AlertTriangle
          size={20}
          style={{ verticalAlign: 'middle', marginRight: '0.5rem' }}
        />
        {error}
      </div>
    )
  }

  if (submitResult) {
    const severityColor =
      SEVERITY_COLORS[submitResult.score.severity] ?? 'var(--np-muted)'
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          padding: '1.5rem',
          background: 'var(--np-surface)',
          borderRadius: '0.75rem',
          border: '1px solid var(--np-line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CheckCircle
            size={24}
            style={{ color: 'var(--np-success, #22c55e)' }}
          />
          <h3
            style={{
              margin: 0,
              color: 'var(--np-text)',
              fontSize: '1.125rem',
              fontWeight: 600,
            }}
          >
            Measure Submitted
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'var(--np-muted)', fontSize: '0.8125rem' }}>
              Score
            </span>
            <span
              style={{
                color: 'var(--np-text)',
                fontSize: '1.5rem',
                fontWeight: 700,
              }}
            >
              {submitResult.score.totalScore} / {submitResult.score.maxScore}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'var(--np-muted)', fontSize: '0.8125rem' }}>
              Severity
            </span>
            <span
              style={{
                color: severityColor,
                fontSize: '1.125rem',
                fontWeight: 600,
                textTransform: 'capitalize',
              }}
            >
              {submitResult.score.severity}
            </span>
          </div>
          {submitResult.score.changeFromPrevious !== undefined && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'var(--np-muted)', fontSize: '0.8125rem' }}>
                Change
              </span>
              <span
                style={{
                  color: 'var(--np-text)',
                  fontSize: '1.125rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                {submitResult.score.changeFromPrevious > 0 ? (
                  <TrendingUp
                    size={16}
                    style={{ color: 'var(--np-danger, #ef4444)' }}
                  />
                ) : submitResult.score.changeFromPrevious < 0 ? (
                  <TrendingDown
                    size={16}
                    style={{ color: 'var(--np-success, #22c55e)' }}
                  />
                ) : null}
                {submitResult.score.changeFromPrevious > 0 ? '+' : ''}
                {submitResult.score.changeFromPrevious}
              </span>
            </div>
          )}
        </div>
        {submitResult.score.alertFlag && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              padding: '0.75rem',
              background: 'var(--np-bg)',
              borderRadius: '0.5rem',
              border: '1px solid var(--np-danger, #ef4444)',
            }}
          >
            <AlertTriangle
              size={18}
              style={{
                color: 'var(--np-danger, #ef4444)',
                flexShrink: 0,
                marginTop: '0.125rem',
              }}
            />
            <span style={{ color: 'var(--np-text)', fontSize: '0.875rem' }}>
              {submitResult.score.alertReason ??
                'Significant change detected from previous administration.'}
            </span>
          </div>
        )}
        <button
          onClick={() => {
            setSubmitResult(null)
            setSelectedMeasure(null)
            setResponses({})
          }}
          style={{
            alignSelf: 'flex-start',
            padding: '0.5rem 1rem',
            background: 'var(--np-elevated)',
            color: 'var(--np-text)',
            border: '1px solid var(--np-line)',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          Take Another Measure
        </button>
      </div>
    )
  }

  if (!selectedMeasure) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          padding: '1.5rem',
          background: 'var(--np-surface)',
          borderRadius: '0.75rem',
          border: '1px solid var(--np-line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ClipboardCheck size={20} style={{ color: 'var(--np-text)' }} />
          <h3
            style={{
              margin: 0,
              color: 'var(--np-text)',
              fontSize: '1.125rem',
              fontWeight: 600,
            }}
          >
            Outcome Measures
          </h3>
        </div>
        <p
          style={{ margin: 0, color: 'var(--np-muted)', fontSize: '0.875rem' }}
        >
          Select a standardized questionnaire to complete. Your responses are
          scored and tracked over time to help monitor progress.
        </p>
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
        >
          {measures.map((m) => {
            const option = MEASURE_OPTIONS.find(
              (o) => o.value === m.measureType,
            )
            return (
              <button
                key={m.measureType}
                onClick={() => handleSelectMeasure(m.measureType)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  background: 'var(--np-bg)',
                  color: 'var(--np-text)',
                  border: '1px solid var(--np-line)',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                    {option?.label ?? m.displayName}
                  </span>
                  <span
                    style={{ color: 'var(--np-muted)', fontSize: '0.8125rem' }}
                  >
                    {option?.description ?? m.displayName}
                  </span>
                </div>
                <ClipboardCheck
                  size={18}
                  style={{ color: 'var(--np-muted)', flexShrink: 0 }}
                />
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const questions = getQuestions(selectedMeasure)
  const answerOptions = getAnswerOptions(selectedMeasure)
  const answeredCount = Object.keys(responses).length

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1.5rem',
        background: 'var(--np-surface)',
        borderRadius: '0.75rem',
        border: '1px solid var(--np-line)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ClipboardCheck size={20} style={{ color: 'var(--np-text)' }} />
          <h3
            style={{
              margin: 0,
              color: 'var(--np-text)',
              fontSize: '1.125rem',
              fontWeight: 600,
            }}
          >
            {MEASURE_OPTIONS.find((o) => o.value === selectedMeasure)?.label ??
              selectedMeasure}
          </h3>
        </div>
        <button
          onClick={() => {
            setSelectedMeasure(null)
            setResponses({})
            setSubmitError(null)
          }}
          style={{
            padding: '0.25rem 0.75rem',
            background: 'transparent',
            color: 'var(--np-muted)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.8125rem',
          }}
        >
          ← Back
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          color: 'var(--np-muted)',
          fontSize: '0.8125rem',
        }}
      >
        <Clock size={14} />
        <span>
          {answeredCount} of {questions.length} answered
        </span>
      </div>
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}
      >
        {questions.map((q, idx) => {
          const linkId = formatLink(selectedMeasure, idx)
          const selected = responses[linkId]
          return (
            <div
              key={linkId}
              style={{
                padding: '0.75rem',
                background: 'var(--np-bg)',
                borderRadius: '0.5rem',
                border: `1px solid ${selected !== undefined ? 'var(--np-success, #22c55e)' : 'var(--np-line)'}`,
              }}
            >
              <p
                style={{
                  margin: '0 0 0.625rem 0',
                  color: 'var(--np-text)',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                <span
                  style={{ color: 'var(--np-muted)', marginRight: '0.5rem' }}
                >
                  {idx + 1}.
                </span>
                {q}
              </p>
              <div
                style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}
              >
                {answerOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleAnswer(linkId, opt.value)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      background:
                        selected === opt.value
                          ? 'var(--np-elevated)'
                          : 'transparent',
                      color:
                        selected === opt.value
                          ? 'var(--np-text)'
                          : 'var(--np-muted)',
                      border: `1px solid ${selected === opt.value ? 'var(--np-success, #22c55e)' : 'var(--np-line)'}`,
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      fontWeight: selected === opt.value ? 600 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {submitError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.625rem',
            color: 'var(--np-danger, #ef4444)',
            background: 'var(--np-bg)',
            borderRadius: '0.375rem',
            fontSize: '0.8125rem',
          }}
        >
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          {submitError}
        </div>
      )}
      <button
        disabled={submitting || answeredCount < questions.length}
        onClick={() => void handleSubmit()}
        style={{
          padding: '0.75rem 1.5rem',
          background:
            answeredCount < questions.length || submitting
              ? 'var(--np-elevated)'
              : 'var(--np-text)',
          color:
            answeredCount < questions.length || submitting
              ? 'var(--np-muted)'
              : 'var(--np-bg)',
          border: '1px solid var(--np-line)',
          borderRadius: '0.5rem',
          cursor:
            answeredCount < questions.length || submitting
              ? 'not-allowed'
              : 'pointer',
          fontSize: '0.9375rem',
          fontWeight: 600,
          alignSelf: 'flex-start',
        }}
      >
        {submitting ? 'Submitting…' : 'Submit Measure'}
      </button>
    </div>
  )
}
