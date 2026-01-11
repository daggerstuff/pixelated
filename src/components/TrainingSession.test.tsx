// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import TrainingSession from './TrainingSession'

describe('TrainingSession', () => {
  it('renders session controls and initial state', () => {
    render(<TrainingSession />)
    expect(screen.getByText('Therapist Training Session')).toBeInTheDocument()
    expect(screen.getByText('Session State:')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Start Session/i })).toBeEnabled()
  })

  it('starts session and updates state', () => {
    render(<TrainingSession />)
    const startBtn = screen.getByRole('button', { name: /Start Session/i })
    fireEvent.click(startBtn)
    const stateP = screen.getByText(/Session State:/)
    const strong = stateP.querySelector('strong')
    expect(strong).toBeInTheDocument()
    expect(strong?.textContent).toBe('active')
  })

  it('pauses and resumes session', () => {
    render(<TrainingSession />)
    fireEvent.click(screen.getByRole('button', { name: /Start Session/i }))
    fireEvent.click(screen.getByRole('button', { name: /Pause/i }))
    const stateP = screen.getByText(/Session State:/)
    const strong = stateP.querySelector('strong')
    expect(strong).toBeInTheDocument()
    expect(strong?.textContent).toBe('paused')
    fireEvent.click(screen.getByRole('button', { name: /Resume/i }))
    const stateP2 = screen.getByText(/Session State:/)
    const strong2 = stateP2.querySelector('strong')
    expect(strong2).toBeInTheDocument()
    expect(strong2?.textContent).toBe('active')
  })

  it('ends session', () => {
    render(<TrainingSession />)
    fireEvent.click(screen.getByRole('button', { name: /Start Session/i }))
    fireEvent.click(screen.getByRole('button', { name: /End Session/i }))
    const stateP = screen.getByText(/Session State:/)
    const strong = stateP.querySelector('strong')
    expect(strong).toBeInTheDocument()
    expect(strong?.textContent).toBe('ended')
  })
})
