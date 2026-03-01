import React, { useState } from 'react'

import { type BookMetadata } from '@/lib/api/research'

interface ExportPanelProps {
  results: BookMetadata[]
  isOpen: boolean
  onClose: () => void
}

type ExportFormat = 'json' | 'csv' | 'bibtex' | 'ris'

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
        r.publication_year || '',
        `"${(r.publisher || '').replace(/"/g, '""')}"`,
        r.source || '',
        r.doi || '',
        r.therapeutic_relevance_score || '',
      ])
      content = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
      mimeType = 'text/csv'
      extension = 'csv'
    } else if (format === 'bibtex') {
      content = results
        .map((r, i) => {
          const key = `${r.authors[0]?.split(' ').pop() || 'Unknown'}${r.publication_year || '0000'}${i}`
          return `@book{${key},
  title = {${r.title}},
  author = {${r.authors.join(' and ')}},
  year = {${r.publication_year || ''}},
  publisher = {${r.publisher || ''}},
  doi = {${r.doi || ''}},
  url = {${r.url || ''}}
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

    // Optional: Close panel after export
    // onClose();
  }

  return (
    <div className='fixed inset-0 z-50 flex justify-end'>
      {/* Backdrop */}
      <div
        className='bg-black/50 absolute inset-0 backdrop-blur-sm'
        onClick={onClose}
      ></div>

      {/* Panel */}
      <div className='bg-slate-900 border-slate-700 animate-slide-in-right relative flex h-full w-full max-w-md flex-col border-l shadow-2xl'>
        <div className='border-slate-800 flex items-center justify-between border-b p-6'>
          <h2 className='text-white text-xl font-bold'>Export Results</h2>
          <button onClick={onClose} className='text-slate-400 hover:text-white'>
            <svg
              className='h-6 w-6'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M6 18L18 6M6 6l12 12'
              />
            </svg>
          </button>
        </div>

        <div className='flex-grow space-y-8 p-6'>
          <div className='bg-slate-800/50 border-slate-700 rounded-lg border p-4'>
            <p className='text-slate-300'>
              Ready to export{' '}
              <span className='text-pink-400 font-bold'>{results.length}</span>{' '}
              items.
            </p>
          </div>

          {/* Format Selection */}
          <div>
            <label className='text-slate-300 mb-3 block text-sm font-medium'>
              Export Format
            </label>
            <div className='grid grid-cols-2 gap-3'>
              {(['json', 'csv', 'bibtex', 'ris'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                    format === f
                      ? 'bg-pink-600/20 border-pink-500 text-pink-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div>
            <label className='text-slate-300 mb-3 block text-sm font-medium'>
              Options
            </label>
            <div className='space-y-3'>
              <div className='flex items-center'>
                <input
                  type='checkbox'
                  id='filename'
                  className='border-slate-600 bg-slate-800 text-pink-600 focus:ring-pink-500 h-4 w-4 rounded'
                  checked={includeAbstract}
                  onChange={(e) => setIncludeAbstract(e.target.checked)}
                />
                <label
                  htmlFor='filename'
                  className='text-slate-300 ml-2 text-sm'
                >
                  Include Abstracts (if available)
                </label>
              </div>
            </div>
          </div>

          {/* Filename */}
          <div>
            <label className='text-slate-300 mb-2 block text-sm font-medium'>
              Filename
            </label>
            <div className='bg-slate-800 border-slate-700 flex overflow-hidden rounded-lg border'>
              <input
                type='text'
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                className='bg-transparent text-white w-full border-none px-3 py-2 focus:ring-0'
              />
              <span className='text-slate-500 bg-slate-900 border-slate-700 border-l px-3 py-2'>
                .{format === 'bibtex' ? 'bib' : format}
              </span>
            </div>
          </div>
        </div>

        <div className='border-slate-800 bg-slate-900 border-t p-6'>
          <button
            onClick={handleExport}
            className='bg-pink-600 hover:bg-pink-700 text-white flex w-full items-center justify-center gap-2 rounded-lg py-3 font-bold transition-colors'
          >
            <svg
              className='h-5 w-5'
              fill='none'
              viewBox='0 0 24 24'
              stroke='currentColor'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
              />
            </svg>
            Download File
          </button>
        </div>
      </div>
    </div>
  )
}
