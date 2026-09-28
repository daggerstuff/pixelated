import { motion } from 'framer-motion'
import React from 'react'

import { type BookMetadata } from '../../lib/api/research'

interface ResultCardProps {
  result: BookMetadata
}

const ResultCardHeader = ({
  therapeutic_relevance_score,
}: {
  therapeutic_relevance_score?: number
}) => (
  <div className="relative flex h-32 items-center justify-center overflow-hidden bg-secondary">
    {/* Relevance Score Badge */}
    {therapeutic_relevance_score !== undefined &&
      therapeutic_relevance_score !== null && (
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-none border border-border bg-secondary px-2 py-1">
          <span className="font-mono text-xs text-foreground">
            {therapeutic_relevance_score.toFixed(2)}
          </span>
        </div>
      )}
  </div>
)

const ResultCardMetadata = ({
  source,
  publication_year,
}: {
  source?: string
  publication_year?: number
}) => (
  <div className="mb-3 flex gap-2 text-xs">
    <span className="rounded border border-input bg-secondary px-2 py-1 capitalize text-foreground">
      {(source ?? 'unknown').replace('_', ' ')}
    </span>
    {(publication_year ?? 0) > 0 && (
      <span className="rounded border border-input bg-secondary px-2 py-1 text-foreground">
        {publication_year}
      </span>
    )}
  </div>
)

const ResultCardActions = ({ url }: { url?: string }) => (
  <div className="border-border/50 mt-auto flex gap-2 border-t pt-4">
    {url ? (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-foreground transition-colors hover:text-muted-foreground"
      >
        View Details
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    ) : (
      <button
        className="cursor-not-allowed text-xs font-medium uppercase tracking-wide text-muted-foreground"
        disabled
      >
        Details Unavailable
      </button>
    )}

    <div className="flex-grow"></div>
    <button
      className="text-muted-foreground transition-colors hover:text-foreground"
      title="Save to favorites"
      aria-label="Save to favorites"
    >
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
        />
      </svg>
    </button>
  </div>
)

export default React.memo(function ResultCard({ result }: ResultCardProps) {
  const {
    title,
    authors,
    publication_year,
    source,
    therapeutic_relevance_score,
    url,
  } = result

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className="result-card hover:border-ring/30 group flex h-full flex-col overflow-hidden rounded-none border border-border bg-secondary transition-colors"
    >
      <ResultCardHeader
        therapeutic_relevance_score={therapeutic_relevance_score}
      />

      <div className="flex flex-grow flex-col p-5">
        <ResultCardMetadata
          source={source}
          publication_year={publication_year}
        />

        <h3 className="mb-2 line-clamp-2 text-lg font-bold leading-tight text-foreground transition-colors group-hover:text-foreground">
          {title}
        </h3>

        <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
          {authors.join(', ')}
        </p>

        <ResultCardActions url={url} />
      </div>
    </motion.div>
  )
})
