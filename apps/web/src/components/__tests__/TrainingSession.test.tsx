// @vitest-environment jsdom
import { render, screen, cleanup } from '@testing-library/react'
import { describe, expect, it, afterEach, vi } from 'vitest'

import TrainingSession from '../TrainingSession'

import '@testing-library/jest-dom/vitest'

vi.mock('../../hooks/useConversationMemory', () => ({
  useConversationMemory: () => ({
    memory: {
      history: [],
      context: {},
      sessionState: 'idle' as const,
      progress: 0,
      progressSnapshots: [],
      progressMetrics: {
        totalMessages: 0,
        therapistMessages: 0,
        clientMessages: 0,
        responsesCount: 0,
        sessionDuration: 0,
        activeTime: 0,
        skillScores: {},
        responseTime: 0,
        conversationFlow: 0,
        milestonesReached: [],
      },
    },
    progress: 0,
    progressSnapshots: [],
    progressMetrics: {
      totalMessages: 0,
      therapistMessages: 0,
      clientMessages: 0,
      responsesCount: 0,
      sessionDuration: 0,
      activeTime: 0,
      skillScores: {},
      responseTime: 0,
      conversationFlow: 0,
      milestonesReached: [],
    },
    addMessage: vi.fn(),
    setSessionState: vi.fn(),
    setProgress: vi.fn(),
    addProgressSnapshot: vi.fn(),
    updateSkillScore: vi.fn(),
    updateConversationFlow: vi.fn(),
    addMilestone: vi.fn(),
    resetSession: vi.fn(),
    setMemory: vi.fn(),
  }),
}))

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
    expect(
      screen.queryAllByLabelText('Evaluation Feedback').length,
    ).toBeGreaterThan(0)
  })
})
