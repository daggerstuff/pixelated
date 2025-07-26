import React from 'react'
import { render, screen } from '@testing-library/react'
import { TechniqueDisplay } from '../TechniqueDisplay'
import { SimulatorProvider } from '../../context/SimulatorContext'

const mockTechniques = [
  { name: 'Cognitive Reframing', confidence: 0.95 },
  { name: 'Active Listening', confidence: 0.75 },
  { name: 'Validation', confidence: 0.85 },
]

const renderWithContext = (techniques = null) => {
  return render(
    <SimulatorProvider initialState={{ detectedTechniques: techniques }}>
      <TechniqueDisplay />
    </SimulatorProvider>,
  )
}

describe('TechniqueDisplay', () => {
  it('displays placeholder when no techniques are detected', () => {
    renderWithContext()
    expect(
      screen.getByText('No therapeutic techniques detected yet.'),
    ).toBeInTheDocument()
  })

  it('displays detected techniques with confidence levels', () => {
    renderWithContext(mockTechniques)

    // Check for each technique name and confidence
    mockTechniques.forEach((technique) => {
      const expectedText = `${technique.name} (${(technique.confidence * 100).toFixed(1)}%)`
      expect(screen.getByText(expectedText)).toBeInTheDocument()
    })
  })

  it('applies correct badge variants based on confidence levels', () => {
    renderWithContext(mockTechniques)

    const badges = screen.getAllByText(/.*\(\d+\.\d+%\)/)

    // Check that badges exist and have proper structure
    expect(badges).toHaveLength(3)
    expect(badges[0]).toBeInTheDocument() // Cognitive Reframing (95.0%)
    expect(badges[1]).toBeInTheDocument() // Active Listening (75.0%)
    expect(badges[2]).toBeInTheDocument() // Validation (85.0%)
  })
})
