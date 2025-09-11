import { render, screen } from '@testing-library/react'
import { ComparativeProgressDisplay } from '../ComparativeProgressDisplay'

describe('ComparativeProgressDisplay', () => {
  it('renders comparative progress heading', () => {
    render(<ComparativeProgressDisplay />)
    expect(
      screen.getByText(/Comparative Progress Display/i),
    ).toBeInTheDocument()
  })
})
