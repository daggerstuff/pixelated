import React from 'react'
import { type DatasetMetadata } from '@/lib/api/research'
import DatasetCard from './DatasetCard'

interface DatasetResultsListProps {
  results: DatasetMetadata[]
}

/**
 * Memoized list of dataset results to prevent unnecessary re-renders
 * when parent state (like search query) changes without affecting the results.
 */
const DatasetResultsList = React.memo(function DatasetResultsList({ 
  results 
}: DatasetResultsListProps) {
  if (results.length === 0) return null

  return (
    <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
      {results.map((dataset, index) => (
        <DatasetCard key={dataset.url} dataset={dataset} index={index} />
      ))}
    </div>
  )
})

export default DatasetResultsList
