/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SessionTimeline, type SessionProgressData } from './SessionTimeline'

const sessions: SessionProgressData[] = [
  {
    id: 'one',
    label: 'Session 1',
    allianceScore: 6.5,
    events: [
      {
        turn: 1,
        type: 'intervention',
        label: 'Therapist intervention delivered',
      },
    ],
    beliefs: [
      {
        belief: 'I can ask for support',
        confidence: 0.7,
        turn: 1,
        interventionCorrelated: true,
      },
    ],
    defenses: [{ mechanism: 'Intellectualization', intensity: 3, turn: 1 }],
    goals: [],
  },
  {
    id: 'two',
    label: 'Session 2',
    allianceScore: 7.5,
    events: [],
    beliefs: [],
    defenses: [],
    goals: [],
    milestones: ['First genuine disclosure'],
  },
]

describe('SessionTimeline', () => {
  it('renders timeline, belief, defense, and multi-session metrics', () => {
    render(<SessionTimeline sessions={sessions} activeSessionId="one" />)

    expect(
      screen.getByRole('heading', { name: 'Session progress' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Therapist intervention delivered'),
    ).toBeInTheDocument()
    expect(screen.getByText('I can ask for support')).toBeInTheDocument()
    expect(screen.getByText('First genuine disclosure')).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: 'Defense intensity by turn' }),
    ).toBeInTheDocument()
  })

  it('adds and scores goals through the supplied change handler', () => {
    const onGoalsChange = vi.fn()
    render(
      <SessionTimeline
        sessions={sessions}
        activeSessionId="one"
        onGoalsChange={onGoalsChange}
      />,
    )

    fireEvent.change(screen.getByLabelText('New session goal'), {
      target: { value: 'Practice reflective listening' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(onGoalsChange).toHaveBeenCalledWith(
      'one',
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Practice reflective listening',
          score: 0,
        }),
      ]),
    )
  })
})
