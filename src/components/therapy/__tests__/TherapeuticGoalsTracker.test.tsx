import { render, screen } from '@testing-library/react'
import { TherapeuticGoalsTracker } from '../TherapeuticGoalsTracker'

describe('TherapeuticGoalsTracker', () => {
  it('renders tracker heading', () => {
    render(<TherapeuticGoalsTracker />)
    expect(screen.getByText(/Therapeutic Goals Tracker/i)).toBeInTheDocument()
  })
})
