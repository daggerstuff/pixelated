import React from 'react'

import { Badge } from '../../components/ui/badge'
import { useSimulator } from '../context/SimulatorContext'

export const TechniqueDisplay: React.FC = () => {
  const { state } = useSimulator()
  const { detectedTechniques } = state

  if (!detectedTechniques || detectedTechniques.length === 0) {
    return (
      <div className='rounded-lg border p-4'>
        <h2 className='mb-2 text-lg font-semibold'>Detected Techniques</h2>
        <p className='text-muted-foreground'>
          No therapeutic techniques detected yet.
        </p>
      </div>
    )
  }

  return (
    <div className='rounded-lg border p-4'>
      <h2 className='mb-4 text-lg font-semibold'>Detected Techniques</h2>
      <div className='flex flex-wrap gap-2'>
        {detectedTechniques.map((technique) => (
          <Badge
            key={technique.name}
            variant={technique.confidence > 0.8 ? 'default' : 'secondary'}
            className='text-sm'
          >
            {technique.name} ({(technique.confidence * 100).toFixed(1)}%)
          </Badge>
        ))}
      </div>
    </div>
  )
}
