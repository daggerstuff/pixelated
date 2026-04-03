// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, expect, it, afterEach } from 'vitest'

import TrainingSession from '../TrainingSession'

describe('TrainingSession', () => {
  afterEach(() => cleanup())
  it('renders training session component', () => {
    render(<TrainingSession />)

    expect(screen.getByText('Therapist Training Session')).not.toBeNull()
    expect(screen.getByText('Session State:')).not.toBeNull()
  })

  it('renders session controls', () => {
    render(<TrainingSession />)

    expect(screen.getByText('Start Session')).not.toBeNull()
    expect(screen.getByText('Pause')).not.toBeNull()
    expect(screen.getByText('Resume')).not.toBeNull()
    expect(screen.getByText('End Session')).not.toBeNull()
  })

  it('renders progress bar', () => {
    render(<TrainingSession />)

    expect(screen.getByLabelText('Session Progress')).not.toBeNull()
  })

  it('renders evaluation feedback section', () => {
    render(<TrainingSession />)

    expect(screen.getAllByText('Evaluation Feedback').length).toBeGreaterThan(0)
  })
})
