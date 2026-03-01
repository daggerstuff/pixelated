// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import TrainingSession from '../TrainingSession'

describe('TrainingSession', () => {
  it('renders training session component', () => {
    render(<TrainingSession />)

    expect(screen.getByText('Therapist Training Session')).toBeInTheDocument()
    expect(screen.getByText('Session State:')).toBeInTheDocument()
  })

  it('renders session controls', () => {
    render(<TrainingSession />)

    expect(screen.getByText('Start Session')).toBeInTheDocument()
    expect(screen.getByText('Pause')).toBeInTheDocument()
    expect(screen.getByText('Resume')).toBeInTheDocument()
    expect(screen.getByText('End Session')).toBeInTheDocument()
  })

  it('renders progress bar', () => {
    render(<TrainingSession />)

    expect(screen.getByLabelText('Session Progress')).toBeInTheDocument()
  })

  it('renders evaluation feedback section', () => {
    render(<TrainingSession />)

    expect(screen.getByText('Evaluation Feedback')).toBeInTheDocument()
  })
})
