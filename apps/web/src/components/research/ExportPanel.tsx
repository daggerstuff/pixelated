import { useState } from 'react'

import { type BookMetadata } from '@/lib/api/research'

interface ExportPanelProps {
  results: BookMetadata[]
  isOpen: boolean
  onClose: () => void
}

type ExportFormat = 'json' | 'csv' | 'bibtex' | 'ris'

/**
 * Text configuration for ExportPanel.
 * Centralizes strings for easier future i18n implementation.
 */
const TEXT = {
  title: 'Export Results',
  closeAriaLabel: 'Close export panel',
  backdropAriaLabel: 'Close export panel',
  readyMessage: (count: number) => `Ready to export ${count} items.`,
  formatLegend: 'Export Format',
  optionsLegend: 'Options',
  includeAbstracts: 'Include Abstracts (if available)',
  filenameLabel: 'Filename',
  downloadButton: 'Download File',
}

export default function ExportPanel({
  results,
  isOpen,
  onClose,
}: ExportPanelProps) {
  const [format, setFormat] = useState<ExportFormat>('json')
  const [filename, setFilename] = useState('academic-sourcing-results')
  const [includeAbstract, setIncludeAbstract] = useState(true)

  if (!isOpen) return null

  const handleExport = async () => {
    // Basic client-side export generation
    let content = ''
    let mimeType = 'text/plain'
    let extension = 'txt'

    if (format === 'json') {
      content = JSON.stringify(results, null, 2)
      mimeType = 'application/json'
      extension = 'json'
    } else if (format === 'csv') {
      // Simple CSV generation
      const headers = [
        'Title',
        'Authors',
        'Year',
        'Publisher',
        'Source',
        'DOI',
        'Score',
      ]
      const rows = results.map((r) => [
        `"${r.title.replace(/"/g, '""')}"`,
        `"${r.authors.join('; ').replace(/"/g, '""')}"`,
        r.publication_year ?? '',
        `"${(r.publisher ?? '').replace(/"/g, '""')}"`,
        r.source ?? '',
        r.doi ?? '',
        r.therapeutic_relevance_score || '',
      ])
      content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
      mimeType = 'text/csv'
      extension = 'csv'
    } else if (format === 'bibtex') {
      content = results
        .map((r, i) => {
          const key = `${r.authors[0]?.split(' ').pop() ?? 'Unknown'}${r.publication_year ?? '0000'}${i}`
          return `@book{${key},
  title = {${r.title}},
  author = {${r.authors.join(' and ')}},
  year = {${r.publication_year ?? ''}},
  publisher = {${r.publisher ?? ''}},
  doi = {${r.doi ?? ''}},
  url = {${r.url ?? ''}}
}`
        })
        .join('\n\n')
      mimeType = 'application/x-bibtex'
      extension = 'bib'
    }

    // Trigger download
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.${extension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop - Semantic button for native accessibility (Review suggestion) */}
      <button
        type="button"
        className="bg-foreground/60 absolute inset-0 h-full w-full cursor-default appearance-none border-0 p-0"
        onClick={onClose}
        aria-label={TEXT.backdropAriaLabel}
      />

      {/* Panel */}
      <div className="animate-slide-in-right relative flex h-full w-full max-w-md flex-col border-l border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-6">
          <h2 className="text-xl font-bold text-foreground">{TEXT.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-none text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={TEXT.closeAriaLabel}
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-grow space-y-8 p-6">
          <div className="rounded-none border border-border bg-secondary p-4">
            <p className="text-foreground">
              {TEXT.readyMessage(results.length)}
            </p>
          </div>

          {/* Format Selection - Use fieldset for semantic grouping (Review suggestion) */}
          <fieldset>
            <legend className="mb-3 block text-sm font-medium text-foreground">
              {TEXT.formatLegend}
            </legend>
            <div
              className="grid grid-cols-2 gap-3"
              role="radiogroup"
              aria-label={TEXT.formatLegend}
            >
              {(['json', 'csv', 'bibtex', 'ris'] as const).map((f) => (
                <button
                  type="button"
                  key={f}
                  role="radio"
                  onClick={() => setFormat(f)}
                  aria-checked={format === f}
                  className={`rounded-none border px-4 py-3 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-ring ${
                    format === f
                      ? 'border-ring bg-secondary font-semibold text-foreground'
                      : 'border-border bg-secondary text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </fieldset>

          {/* Options */}
          <fieldset>
            <legend className="mb-3 block text-sm font-medium text-foreground">
              {TEXT.optionsLegend}
            </legend>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="include-abstract"
                  className="h-4 w-4 rounded border-input bg-secondary text-primary focus:ring-ring"
                  checked={includeAbstract}
                  onChange={(e) => setIncludeAbstract(e.target.checked)}
                />
                <label
                  htmlFor="include-abstract"
                  className="ml-2 cursor-pointer text-sm text-foreground"
                >
                  {TEXT.includeAbstracts}
                </label>
              </div>
            </div>
          </fieldset>

          {/* Filename */}
          <div>
            <label
              htmlFor="export-filename"
              className="mb-2 block text-sm font-medium text-foreground"
            >
              {TEXT.filenameLabel}
            </label>
            <div className="flex overflow-hidden rounded-none border border-border bg-secondary focus-within:ring-2 focus-within:ring-ring">
              <input
                id="export-filename"
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className="bg-transparent w-full border-none px-3 py-2 text-foreground outline-none focus:ring-0"
              />
              <span className="border-l border-border bg-background px-3 py-2 text-muted-foreground">
                .{format === 'bibtex' ? 'bib' : format}
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-background p-6">
          <button
            type="button"
            onClick={handleExport}
            className="flex w-full items-center justify-center gap-2 rounded-none bg-primary py-3 font-bold text-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
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
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            {TEXT.downloadButton}
          </button>
        </div>
      </div>
    </div>
  )
}
