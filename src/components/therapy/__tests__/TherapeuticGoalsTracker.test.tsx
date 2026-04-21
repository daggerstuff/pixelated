import { render, screen } from '@testing-library/react'

import { TherapeuticGoalsTracker } from '../TherapeuticGoalsTracker'

describe('TherapeuticGoalsTracker', () => {
  it('renders tracker heading', () => {
    render(
      <TherapeuticGoalsTracker
        patientModel={undefined as unknown as never}
        currentSession={undefined as unknown as never}
        therapistInterventions={[]}
      />,
    )
    expect(screen.getByText(/Therapeutic Goals Tracker/i)).toBeInTheDocument()
  })
})
