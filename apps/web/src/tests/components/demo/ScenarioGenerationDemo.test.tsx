import { render, screen } from '@testing-library/react'

import ScenarioGenerationDemo from '../../../components/demo/ScenarioGenerationDemo'

describe('ScenarioGenerationDemo', () => {
  it('renders without crashing', () => {
    render(<ScenarioGenerationDemo />)
    expect(screen.getByText('Select Scenario Type')).toBeInTheDocument()
    expect(screen.getByText('Anxiety Disorder')).toBeInTheDocument()
    expect(screen.getByText('Generate Clinical Scenario')).toBeInTheDocument()
  })
})
