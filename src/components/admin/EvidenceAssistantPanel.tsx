import { useEffect, useState } from 'react'

import { useEvidenceAssistant } from '@/hooks/useEvidenceAssistant'
import type { EvidenceCollection } from '@/lib/evidence-assistant/types'

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
    <div className='border-white/10 bg-slate-950/70 text-white shadow-slate-950/30 mx-auto max-w-5xl rounded-2xl border p-6 shadow-2xl'>
      <div className='mb-6 flex flex-col gap-2'>
        <p className='text-cyan-300/80 text-sm uppercase tracking-[0.3em]'>
          Internal Evidence Assistant
        </p>
        <h2 className='text-white text-3xl font-semibold'>
          Search private docs and generate grounded answers
        </h2>
        <p className='text-slate-300 max-w-3xl text-sm'>
          This admin tool searches Pixelated Empathy&apos;s internal docs and
          page content, then optionally synthesizes an answer with explicit
          citations. It is designed for product, research, compliance, and
          operations work, not patient-facing clinical decisions.
        </p>
      </div>

      <form className='space-y-4' onSubmit={handleSubmit}>
        <label className='block'>
          <span className='text-slate-200 mb-2 block text-sm font-medium'>
            Question
          </span>
          <textarea
            className='border-white/10 bg-slate-900/80 text-white focus:border-cyan-400/60 focus:ring-cyan-400/20 min-h-32 w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2'
            aria-label='Question input'
            placeholder='Example: Which internal docs define crisis sensitivity requirements and memory ordering?'
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
          <label className='block md:min-w-56'>
            <span className='text-slate-200 mb-2 block text-sm font-medium'>
              Source scope
            </span>
            <select
              className='border-white/10 bg-slate-900/80 text-white focus:border-cyan-400/60 focus:ring-cyan-400/20 w-full rounded-xl border px-4 py-3 text-sm outline-none transition focus:ring-2'
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

          <label className='border-white/10 bg-slate-900/70 text-slate-200 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm'>
            <input
              checked={generateAnswer}
              className='border-white/20 bg-slate-950 text-cyan-400 focus:ring-cyan-400/30 h-4 w-4 rounded'
              aria-label='Generate grounded answer'
              disabled={!groundedAnswerEnabled}
              type='checkbox'
              onChange={(event) => setGenerateAnswer(event.target.checked)}
            />
            Generate grounded answer
          </label>

          {!groundedAnswerEnabled ? (
            <p className='text-amber-200 mt-1 text-xs md:mt-0'>
              Grounded answers are unavailable: no AI provider is configured.
              Citations only mode is active.
            </p>
          ) : null}

          <div className='flex gap-3'>
            {loading ? (
              <button
                className='border-cyan-400/50 text-cyan-200 hover:border-cyan-300 hover:bg-cyan-300/10 rounded-xl border px-4 py-3 text-sm transition'
                type='button'
                onClick={cancel}
              >
                Cancel
              </button>
            ) : null}
            <button
              className='border-white/10 text-slate-200 hover:border-white/20 hover:bg-white/5 rounded-xl border px-4 py-3 text-sm transition'
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
              className='bg-cyan-400 text-slate-950 hover:bg-cyan-300 disabled:bg-cyan-900/40 disabled:text-slate-400 rounded-xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed'
              disabled={loading || !query.trim()}
              type='submit'
            >
              {loading ? 'Searching...' : 'Run evidence search'}
            </button>
          </div>
        </div>
      </form>

      {error ? (
        <div className='border-rose-400/30 bg-rose-500/10 text-rose-200 mt-6 rounded-xl border px-4 py-3 text-sm'>
          {error.message}
        </div>
      ) : null}

      {response ? (
        <div className='mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]'>
          <section className='border-white/10 bg-slate-900/70 rounded-2xl border p-5'>
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='text-white text-lg font-semibold'>
                Grounded answer
              </h3>
              <span className='text-slate-400 text-xs uppercase tracking-[0.2em]'>
                {response.providerUsed ?? 'citations only'}
              </span>
            </div>

            <p className='text-slate-200 mb-4 text-sm leading-7'>
              {response.answer ??
                'No synthesized answer was generated for this search.'}
            </p>

            {response.warnings.length > 0 ? (
              <ul className='border-amber-400/30 bg-amber-500/10 text-amber-100 space-y-2 rounded-xl border p-4 text-sm'>
                {response.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className='border-white/10 bg-slate-900/70 rounded-2xl border p-5'>
            <div className='mb-4 flex items-center justify-between'>
              <h3 className='text-white text-lg font-semibold'>Citations</h3>
              <span className='text-slate-400 text-sm'>
                {response.citations.length} source
                {response.citations.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className='space-y-3'>
              {response.results.map((result, index) => (
                <article
                  key={`${result.url}-${result.title}`}
                  className='border-white/8 bg-slate-950/70 rounded-xl border p-4'
                >
                  <div className='mb-2 flex items-start justify-between gap-4'>
                    <div>
                      <p className='text-white text-sm font-semibold'>
                        [{index + 1}] {result.title}
                      </p>
                      <p className='text-slate-500 text-xs uppercase tracking-[0.2em]'>
                        {result.collection} ·{' '}
                        {result.category ?? 'uncategorized'}
                      </p>
                    </div>
                    <span className='bg-white/5 text-slate-300 rounded-full px-2 py-1 text-xs'>
                      score {result.score}
                    </span>
                  </div>
                  <p className='text-slate-300 mb-3 text-sm leading-6'>
                    {result.excerpt}
                  </p>
                  <code className='text-cyan-200 text-xs'>{result.url}</code>
                </article>
              ))}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
