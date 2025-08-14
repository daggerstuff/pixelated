import React from 'react'

export interface ResultsExportDemoProps {
  className?: string
}

export function ResultsExportDemo({ className }: ResultsExportDemoProps) {
  return (
    <div className={className}>
      <h3>Results Export Demo</h3>
      <p>Export functionality demo component</p>
    </div>
  )
}

export default ResultsExportDemo
