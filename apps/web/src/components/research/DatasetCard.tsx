import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import React from 'react'

import { type DatasetMetadata } from '@/lib/api/research'

interface DatasetCardProps {
  dataset: DatasetMetadata
  index?: number
}

const DatasetHeader = ({ dataset }: { dataset: DatasetMetadata }) => {
  const { name, source, quality_score, downloads } = dataset
  return (
    <div className="relative z-10 mb-3 flex items-start justify-between">
      <div className="flex flex-col">
        <div className="mb-1 flex items-center gap-2">
          <span className="rounded-none border border-border bg-card px-2 py-0.5 text-xs uppercase tracking-wider text-muted-foreground">
            {source}
          </span>
          {quality_score > 0.7 && (
            <motion.span
              initial={{ scale: 0.9 }}
              animate={{ scale: [0.9, 1.1, 1] }}
              className="flex items-center gap-1 rounded-none border border-input bg-secondary px-2 py-0.5 text-xs text-foreground"
            >
              <Sparkles className="h-4 w-4" /> High Quality
            </motion.span>
          )}
        </div>
        <h3
          className="line-clamp-1 text-lg font-bold text-foreground transition-colors group-hover:text-foreground"
          title={name}
        >
          {name}
        </h3>
      </div>
      <div className="flex items-center gap-1 rounded bg-secondary px-2 py-1 text-muted-foreground">
        <span className="text-xs">⬇️</span>
        <span className="font-mono text-xs">{downloads.toLocaleString()}</span>
      </div>
    </div>
  )
}

const DatasetStats = ({
  avg_turns,
  therapeutic_relevance,
}: {
  avg_turns?: number
  therapeutic_relevance?: number
}) => (
  <div className="mb-4 grid grid-cols-2 gap-2 rounded-none bg-secondary p-3 text-xs text-foreground">
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Avg Turns
      </span>
      <span>
        {typeof avg_turns === 'number' ? avg_turns.toFixed(1) : 'N/A'}
      </span>
    </div>
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Relevance
      </span>
      <div className="mt-1 h-1.5 w-full rounded-none bg-secondary">
        <div
          className="h-1.5 rounded-none bg-primary"
          style={{ width: `${(therapeutic_relevance ?? 0) * 100}%` }}
        ></div>
      </div>
    </div>
  </div>
)

const DatasetTags = ({ tags }: { tags?: string[] }) => (
  <div className="mt-auto flex flex-wrap gap-2">
    {tags?.slice(0, 3).map((tag) => (
      <span
        key={tag}
        className="rounded border border-border bg-card px-2 py-1 text-xs text-muted-foreground"
      >
        #{tag}
      </span>
    ))}
    {tags && tags.length > 3 && (
      <span className="rounded px-2 py-1 text-xs text-muted-foreground">
        +{tags.length - 3}
      </span>
    )}
  </div>
)

export default React.memo(function DatasetCard({
  dataset,
  index = 0,
}: DatasetCardProps) {
  const { url, description, avg_turns, therapeutic_relevance, tags } = dataset

  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.3 }}
      whileHover={{ y: -8, scale: 1.02, transition: { duration: 0.2 } }}
      whileFocus={{ scale: 1.02 }}
      className="hover:border-ring/50 focus:border-transparent group relative block h-full cursor-pointer rounded-none border border-border bg-card p-5 outline-none transition-all focus:ring-2 focus:ring-ring"
    >
      <DatasetHeader dataset={dataset} />

      <p className="mb-4 line-clamp-3 flex-grow text-sm text-muted-foreground">
        {description || 'No description provided.'}
      </p>

      <DatasetStats
        avg_turns={avg_turns}
        therapeutic_relevance={therapeutic_relevance}
      />

      <DatasetTags tags={tags} />
    </motion.a>
  )
})
