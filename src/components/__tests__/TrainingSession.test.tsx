// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, expect, it, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'

import TrainingSession from '../TrainingSession'

describe('TrainingSession', () => {
  afterEach(() => cleanup())
  
  it('renders training session component', () => {
    render(<TrainingSession />)

    expect(screen.getByText('Therapist Training Session')).toBeInTheDocument()
    expect(screen.getByText(/Session State:/i)).toBeInTheDocument()
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

    // Using queryAllByLabelText since multiple elements (section and label) share the same name
    expect(screen.queryAllByLabelText('Evaluation Feedback').length).toBeGreaterThan(0)
  })
})
