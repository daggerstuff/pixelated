import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { EvaluationFeedbackPanel } from './EvaluationFeedbackPanel'

describe('EvaluationFeedbackPanel', () => {
  it('renders feedback input and submits', () => {
    const handleSubmit = vi.fn()
    render(<EvaluationFeedbackPanel feedback="" onSubmit={handleSubmit} />)
    const textarea = screen.getByRole('textbox', { name: /Feedback/i })
    fireEvent.change(textarea, { target: { value: 'Great session!' } })
    fireEvent.click(screen.getByRole('button', { name: /Submit Feedback/i }))
    expect(handleSubmit).toHaveBeenCalledWith('Great session!')
  })
})
