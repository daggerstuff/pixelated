import React from 'react'
import { useSimulator } from '../context/SimulatorContext'
import { Badge } from '../../components/ui/badge'

export const TechniqueDisplay: React.FC = () => {
  const { state } = useSimulator()
  const { detectedTechniques } = state

  if (!detectedTechniques || detectedTechniques.length === 0) {
    return (
      <div className="p-4 border rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Detected Techniques</h2>
        <p className="text-muted-foreground">
          No therapeutic techniques detected yet.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 border rounded-lg">
      <h2 className="text-lg font-semibold mb-4">Detected Techniques</h2>
      <div className="flex flex-wrap gap-2">
        {detectedTechniques.map((technique) => (
          <Badge
            key={technique.name}
            variant={technique.confidence > 0.8 ? 'default' : 'secondary'}
            className="text-sm"
          >
            {technique.name} ({(technique.confidence * 100).toFixed(1)}%)
          </Badge>
        ))}
      </div>
    </div>
  )
}
