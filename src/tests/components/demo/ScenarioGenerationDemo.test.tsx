import { render, screen } from '@testing-library/react'
import ScenarioGenerationDemo from '../components/demo/ScenarioGenerationDemo'

describe('ScenarioGenerationDemo', () => {
  it('renders without crashing', () => {
    render(<ScenarioGenerationDemo />)
    expect(screen.getByText('Scenario Generation Showcase')).toBeInTheDocument()
  })
})
