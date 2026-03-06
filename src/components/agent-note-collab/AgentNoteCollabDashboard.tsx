import { useEffect, useMemo, useState } from 'react'

const phaseOrder = [
  'Observe',
  'Propose',
  'Counter',
  'Synthesize',
  'Handoff',
] as const

type TurnPhase = (typeof phaseOrder)[number]

type NoteTurnSummary = {
  turnId: string
  artifactId: string
  phase: TurnPhase | (string & {})
  role: string
  agentId: string
  confidence: number
  assumptions: string[]
  openQuestions: string[]
  decision: string
  evidence: string[]
  requestedAction: string
  createdAt: string
  updatedAt: string
}

type SynthesisPayload = {
  synthesis?: {
    summaryText?: string
    turnCount?: number
    latestDecision?: string
  }
  turnCount?: number
  openQuestions?: string[]
}

type SynthesisState = {
  loading: boolean
  data?: SynthesisPayload
  error?: string
}

type TurnGroup = {
  artifactId: string
  turns: NoteTurnSummary[]
  latestTurn: NoteTurnSummary | null
  latestPhase: string
  totalTurns: number
  openQuestions: string[]
}

type ApiTurnListResponse = {
  ok: boolean
  data?: {
    turns: NoteTurnSummary[]
    count?: number
  }
  message?: string
}

type ApiSynthesisResponse = {
  ok: boolean
  data?: SynthesisPayload
  code?: string
  message?: string
}

const getPhaseProgress = (phase: string): number => {
  const index = phaseOrder.indexOf(phase as TurnPhase)
  if (index < 0) {
    return 0
  }

  return Math.round(((index + 1) / phaseOrder.length) * 100)
}

const sortByTimestamp = (left: NoteTurnSummary, right: NoteTurnSummary) =>
  new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()

const buildTurnGroups = (turns: NoteTurnSummary[]): Map<string, TurnGroup> => {
  const groupedTurns = new Map<string, TurnGroup>()

  for (const turn of turns) {
    const existing = groupedTurns.get(turn.artifactId)
    if (!existing) {
      groupedTurns.set(turn.artifactId, {
        artifactId: turn.artifactId,
        turns: [turn],
        latestTurn: turn,
        latestPhase: turn.phase,
        totalTurns: 1,
        openQuestions: [...turn.openQuestions],
      })
      continue
    }

    existing.turns.push(turn)
    existing.totalTurns += 1
    if (new Date(turn.updatedAt).getTime() > new Date(existing.latestTurn?.updatedAt ?? 0).getTime()) {
      existing.latestTurn = turn
      existing.latestPhase = turn.phase
      existing.openQuestions = [...turn.openQuestions]
    }
  }

  return groupedTurns
}

export default function AgentNoteCollabDashboard() {
  const [turns, setTurns] = useState<NoteTurnSummary[]>([])
  const [artifactFilter, setArtifactFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [synthesisByArtifact, setSynthesisByArtifact] = useState<
    Record<string, SynthesisState>
  >({})

  useEffect(() => {
    const loadTurns = async () => {
      setLoading(true)
      setError(undefined)

      try {
        const response = await fetch('/api/agent-notes/turns')
        const body = (await response.json()) as ApiTurnListResponse

        if (!response.ok || !body.ok) {
          setError(body.message ?? 'Failed to load collaboration turns.')
          setTurns([])
          return
        }

        setTurns(body.data?.turns ?? [])
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : 'An unexpected error occurred.')
        setTurns([])
      } finally {
        setLoading(false)
      }
    }

    void loadTurns()
  }, [])

  const groups = useMemo(() => {
    const filtered = turns.filter((turn) =>
      artifactFilter
        ? turn.artifactId.toLowerCase().includes(artifactFilter.toLowerCase())
        : true,
    )

    const grouped = buildTurnGroups(filtered)
    const rows = [...grouped.values()].sort((left, right) =>
      sortByTimestamp(left.latestTurn!, right.latestTurn!),
    )

    return rows
  }, [artifactFilter, turns])

  const unresolvedCount = groups.filter((group) => group.openQuestions.length > 0).length

  const handleLoadSynthesis = async (artifactId: string) => {
    setSynthesisByArtifact((prev) => ({
      ...prev,
      [artifactId]: { loading: true },
    }))

    try {
      const response = await fetch('/api/agent-notes/syntheses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          artifactId,
          maxTurns: 25,
          includeResolvedOpenQuestions: false,
        }),
      })

      const body = (await response.json()) as ApiSynthesisResponse
      if (!response.ok || !body.ok || !body.data) {
        setSynthesisByArtifact((prev) => ({
          ...prev,
          [artifactId]: {
            loading: false,
            error: body.message ?? 'Failed to build synthesis.',
          },
        }))
        return
      }

      setSynthesisByArtifact((prev) => ({
        ...prev,
        [artifactId]: {
          loading: false,
          data: body.data,
        },
      }))
    } catch (requestError: unknown) {
      setSynthesisByArtifact((prev) => ({
        ...prev,
        [artifactId]: {
          loading: false,
          error:
            requestError instanceof Error
              ? requestError.message
              : 'An unexpected error occurred.',
        },
      }))
    }
  }

  return (
    <div className='space-y-6'>
      <section className='rounded-lg border p-4'>
        <h1 className='text-2xl font-bold'>Agent Note Collaboration</h1>
        <p className='text-sm text-muted-foreground mt-1'>
          Review unresolved questions, phase progression, and turn summaries before handoff.
        </p>
      </section>

      <section className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
        <div className='rounded-lg border p-4'>
          <p className='text-sm text-muted-foreground'>Artifact Coverage</p>
          <p className='text-2xl font-semibold mt-1'>{groups.length}</p>
        </div>
        <div className='rounded-lg border p-4'>
          <p className='text-sm text-muted-foreground'>Unresolved Threads</p>
          <p className='text-2xl font-semibold mt-1'>{unresolvedCount}</p>
        </div>
        <div className='rounded-lg border p-4'>
          <p className='text-sm text-muted-foreground'>Total Turns</p>
          <p className='text-2xl font-semibold mt-1'>{turns.length}</p>
        </div>
      </section>

      <section className='rounded-lg border p-4'>
        <label
          htmlFor='artifact-filter'
          className='mb-2 block text-sm font-medium text-muted-foreground'
        >
          Filter by Artifact ID
        </label>
        <input
          id='artifact-filter'
          value={artifactFilter}
          onChange={(event) => setArtifactFilter(event.target.value)}
          className='w-full rounded border border-border bg-background px-3 py-2'
          placeholder='e.g. artifact://feature-001'
        />
      </section>

      {loading && <p className='text-sm text-muted-foreground'>Loading collaboration state...</p>}

      {error && (
        <p className='text-sm rounded border border-red-500/50 bg-red-950/20 p-3 text-red-300'>
          {error}
        </p>
      )}

      {!loading && !error && groups.length === 0 && (
        <p className='text-sm text-muted-foreground'>
          No turns are available for this filter yet.
        </p>
      )}

      <div className='space-y-4'>
        {groups.map((group) => {
          const state = synthesisByArtifact[group.artifactId]
          const progress = getPhaseProgress(group.latestPhase)

          return (
            <article
              key={group.artifactId}
              className='rounded-lg border p-4'
            >
              <div className='flex flex-col gap-2'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <h2 className='text-lg font-semibold'>{group.artifactId}</h2>
                    <p className='text-sm text-muted-foreground'>
                      {group.totalTurns} total turns · latest phase: {group.latestPhase}
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={() => {
                      void handleLoadSynthesis(group.artifactId)
                    }}
                    className='rounded bg-primary px-3 py-1 text-primary-foreground text-sm disabled:opacity-60'
                    disabled={state?.loading}
                  >
                    {state?.loading ? 'Building…' : 'Generate Synthesis'}
                  </button>
                </div>

                <div>
                  <div className='mb-1 flex justify-between text-xs text-muted-foreground'>
                    <span>Phase Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className='h-2 w-full overflow-hidden rounded bg-muted'>
                    <div
                      className='h-full bg-primary transition-[width]'
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <p className='text-sm text-muted-foreground'>
                  Open Questions: {group.openQuestions.length}
                </p>

                {group.openQuestions.length > 0 && (
                  <ul className='list-disc space-y-1 pl-6 text-sm'>
                    {group.openQuestions.slice(0, 3).map((question) => (
                      <li key={`${group.artifactId}-${question}`}>{question}</li>
                    ))}
                  </ul>
                )}

                {group.openQuestions.length > 3 && (
                  <p className='text-xs text-muted-foreground'>
                    +{group.openQuestions.length - 3} more open questions
                  </p>
                )}

                {state?.error && (
                  <p className='text-sm text-red-300'>{state.error}</p>
                )}

                {state?.data && (
                  <div className='rounded bg-card p-3 text-sm'>
                    <p className='font-semibold'>Synthesis</p>
                    <p>{state.data.synthesis?.summaryText ?? 'No summary text returned.'}</p>
                    <p className='text-muted-foreground mt-2'>
                      Turn window: {state.data.turnCount ?? 0}
                    </p>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
