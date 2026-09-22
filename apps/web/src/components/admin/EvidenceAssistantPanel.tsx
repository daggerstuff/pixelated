import { useEffect, useState, SyntheticEvent } from 'react'

import { useEvidenceAssistant } from '../../hooks/useEvidenceAssistant'
import type { EvidenceCollection } from '../../lib/evidence-assistant/types'

const COLLECTION_OPTIONS: Array<{
  label: string
  value: EvidenceCollection | ''
}> = [
  { label: 'All internal sources', value: '' },
  { label: 'Docs only', value: 'docs' },
  { label: 'Pages only', value: 'pages' },
]

export function EvidenceAssistantPanel() {
  const {
    search,
    loading,
    response,
    error,
    reset,
    cancel,
    groundedAnswerAvailable,
  } = useEvidenceAssistant()
  const [query, setQuery] = useState('')
  const [collection, setCollection] = useState<EvidenceCollection | ''>('')
  const [generateAnswer, setGenerateAnswer] = useState(true)

  const groundedAnswerEnabled = groundedAnswerAvailable ?? true

  if (!groundedAnswerEnabled && generateAnswer) {
    setGenerateAnswer(false)
  }

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      return
    }

    await search({
      query: trimmedQuery,
      collection: collection || undefined,
      generateAnswer,
      limit: 6,
    })
  }

  return (
    <div className="mx-auto max-w-5xl rounded-none border border-border bg-card p-6 text-foreground">
      <div className="mb-6 flex flex-col gap-2">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          Internal Evidence Assistant
        </p>
        <h2 className="text-white text-3xl font-semibold">
          Search private docs and generate grounded answers
        </h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          This admin tool searches Pixelated Empathy&apos;s internal docs and
          page content, then optionally synthesizes an answer with explicit
          citations. It is designed for product, research, compliance, and
          operations work, not patient-facing clinical decisions.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-foreground">
            Question
          </span>
          <textarea
            className="min-h-32 w-full rounded-none border border-input bg-secondary px-4 py-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring"
            aria-label="Question input"
            placeholder="Example: Which internal docs define crisis sensitivity requirements and memory ordering?"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <label className="block md:min-w-56">
            <span className="mb-2 block text-sm font-medium text-foreground">
              Source scope
            </span>
            <select
              className="w-full rounded-none border border-input bg-secondary px-4 py-3 text-sm text-foreground outline-none transition focus:border-ring focus:ring-2 focus:ring-ring"
              aria-label="Source scope"
              value={collection}
              onChange={(event) => {
                const nextCollection = event.target.value
                setCollection(
                  nextCollection === 'docs' || nextCollection === 'pages'
                    ? nextCollection
                    : '',
                )
              }}
            >
              {COLLECTION_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 rounded-none border border-border bg-secondary px-4 py-3 text-sm text-foreground">
            <input
              checked={generateAnswer}
              className="h-4 w-4 rounded-none border-input bg-background text-foreground focus:ring-ring"
              aria-label="Generate grounded answer"
              disabled={!groundedAnswerEnabled}
              type="checkbox"
              onChange={(event) => setGenerateAnswer(event.target.checked)}
            />
            Generate grounded answer
          </label>

          {!groundedAnswerEnabled ? (
            <p className="mt-1 text-xs text-muted-foreground md:mt-0">
              Grounded answers are unavailable: no AI provider is configured.
              Citations only mode is active.
            </p>
          ) : null}

          <div className="flex gap-3">
            {loading ? (
              <button
                className="rounded-none border border-ring px-4 py-3 text-sm text-foreground transition hover:bg-accent"
                type="button"
                onClick={cancel}
              >
                Cancel
              </button>
            ) : null}
            <button
              className="rounded-none border border-border px-4 py-3 text-sm text-foreground transition hover:bg-accent"
              type="button"
              onClick={() => {
                setQuery('')
                setCollection('')
                setGenerateAnswer(true)
                reset()
              }}
            >
              Reset
            </button>
            <button
              className="rounded-none bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
              disabled={loading || !query.trim()}
              type="submit"
            >
              {loading ? 'Searching...' : 'Run evidence search'}
            </button>
          </div>
        </div>
      </form>

      {error ? (
        <div className="mt-6 rounded-none border border-ring bg-card px-4 py-3 text-sm text-foreground">
          {error.message}
        </div>
      ) : null}

      {response ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <section className="rounded-none border border-border bg-secondary p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-white text-lg font-semibold">
                Grounded answer
              </h3>
              <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                {response.providerUsed ?? 'citations only'}
              </span>
            </div>

            <p className="mb-4 text-sm leading-7 text-foreground">
              {response.answer ??
                'No synthesized answer was generated for this search.'}
            </p>

            {response.warnings.length > 0 ? (
              <ul className="space-y-2 rounded-none border border-ring bg-card p-4 text-sm text-foreground">
                {response.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-none border border-border bg-secondary p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-white text-lg font-semibold">Citations</h3>
              <span className="text-sm text-muted-foreground">
                {response.citations.length} source
                {response.citations.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="space-y-3">
              {response.results.map((result, index) => (
                <article
                  key={`${result.url}-${result.title}`}
                  className="rounded-none border border-border bg-card p-4"
                >
                  <div className="mb-2 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-white text-sm font-semibold">
                        [{index + 1}] {result.title}
                      </p>
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                        {result.collection} ·{' '}
                        {result.category ?? 'uncategorized'}
                      </p>
                    </div>
                    <span className="bg-white/5 rounded-full px-2 py-1 text-xs text-muted-foreground">
                      score {result.score}
                    </span>
                  </div>
                  <p className="mb-3 text-sm leading-6 text-muted-foreground">
                    {result.excerpt}
                  </p>
                  <code className="text-xs font-medium text-foreground">
                    {result.url}
                  </code>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
