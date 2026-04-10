import { useEffect, useState } from 'react'

import { useEvidenceAssistant } from '@/hooks/useEvidenceAssistant'
import type { EvidenceCollection } from '@/lib/evidence-assistant/types'

const COLLECTION_OPTIONS: Array<{ label: string; value: EvidenceCollection | '' }> = [
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

  useEffect(() => {
    if (!groundedAnswerEnabled && generateAnswer) {
      setGenerateAnswer(false)
    }
  }, [groundedAnswerEnabled, generateAnswer])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
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
    <div className='mx-auto max-w-5xl rounded-2xl border border-white/10 bg-slate-950/70 p-6 text-white shadow-2xl shadow-slate-950/30'>
      <div className='mb-6 flex flex-col gap-2'>
        <p className='text-sm uppercase tracking-[0.3em] text-cyan-300/80'>
          Internal Evidence Assistant
        </p>
        <h2 className='text-3xl font-semibold text-white'>
          Search private docs and generate grounded answers
        </h2>
        <p className='max-w-3xl text-sm text-slate-300'>
          This admin tool searches Pixelated Empathy&apos;s internal docs and page
          content, then optionally synthesizes an answer with explicit citations.
          It is designed for product, research, compliance, and operations work,
          not patient-facing clinical decisions.
        </p>
      </div>

      <form className='space-y-4' onSubmit={handleSubmit}>
        <label className='block'>
          <span className='mb-2 block text-sm font-medium text-slate-200'>
            Question
          </span>
          <textarea
            className='min-h-32 w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20'
            aria-label='Question input'
            placeholder='Example: Which internal docs define crisis sensitivity requirements and memory ordering?'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
          <label className='block md:min-w-56'>
            <span className='mb-2 block text-sm font-medium text-slate-200'>
              Source scope
            </span>
            <select
              className='w-full rounded-xl border border-white/10 bg-slate-900/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20'
              aria-label='Source scope'
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

          <label className='flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-slate-200'>
            <input
              checked={generateAnswer}
              className='h-4 w-4 rounded border-white/20 bg-slate-950 text-cyan-400 focus:ring-cyan-400/30'
              aria-label='Generate grounded answer'
              disabled={!groundedAnswerEnabled}
              type='checkbox'
              onChange={(event) => setGenerateAnswer(event.target.checked)}
            />
            Generate grounded answer
          </label>

          {!groundedAnswerEnabled ? (
            <p className='mt-1 text-xs text-amber-200 md:mt-0'>
              Grounded answers are unavailable: no AI provider is configured. Citations
              only mode is active.
            </p>
          ) : null}

          <div className='flex gap-3'>
            {loading ? (
              <button
                className='rounded-xl border border-cyan-400/50 px-4 py-3 text-sm text-cyan-200 transition hover:border-cyan-300 hover:bg-cyan-300/10'
                type='button'
                onClick={cancel}
              >
                Cancel
              </button>
            ) : null}
            <button
              className='rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/5'
              type='button'
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
              className='rounded-xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-900/40 disabled:text-slate-400'
              disabled={loading || !query.trim()}
              type='submit'
            >
              {loading ? 'Searching...' : 'Run evidence search'}
            </button>
          </div>
        </div>
      </form>

      {error ? (
        <div className='mt-6 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200'>
          {error.message}
        </div>
      ) : null}

      {response ? (
        <div className='mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]'>
          <section className='rounded-2xl border border-white/10 bg-slate-900/70 p-5'>
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='text-lg font-semibold text-white'>Grounded answer</h3>
              <span className='text-xs uppercase tracking-[0.2em] text-slate-400'>
                {response.providerUsed ?? 'citations only'}
              </span>
            </div>

            <p className='mb-4 text-sm leading-7 text-slate-200'>
              {response.answer ?? 'No synthesized answer was generated for this search.'}
            </p>

            {response.warnings.length > 0 ? (
              <ul className='space-y-2 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100'>
                {response.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className='rounded-2xl border border-white/10 bg-slate-900/70 p-5'>
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='text-lg font-semibold text-white'>Citations</h3>
              <span className='text-sm text-slate-400'>
                {response.citations.length} source{response.citations.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className='space-y-3'>
              {response.results.map((result, index) => (
                <article
                  key={`${result.url}-${result.title}`}
                  className='rounded-xl border border-white/8 bg-slate-950/70 p-4'
                >
                  <div className='mb-2 flex items-start justify-between gap-4'>
                    <div>
                      <p className='text-sm font-semibold text-white'>
                        [{index + 1}] {result.title}
                      </p>
                      <p className='text-xs uppercase tracking-[0.2em] text-slate-500'>
                        {result.collection} · {result.category ?? 'uncategorized'}
                      </p>
                    </div>
                    <span className='rounded-full bg-white/5 px-2 py-1 text-xs text-slate-300'>
                      score {result.score}
                    </span>
                  </div>
                  <p className='mb-3 text-sm leading-6 text-slate-300'>
                    {result.excerpt}
                  </p>
                  <code className='text-xs text-cyan-200'>{result.url}</code>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
