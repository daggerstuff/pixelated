import React from 'react'

interface EvaluationFeedbackPanelProps {
  feedback: string
  onSubmit: (feedback: string) => void
}

export function EvaluationFeedbackPanel({
  feedback,
  onSubmit,
}: EvaluationFeedbackPanelProps) {
  const [value, setValue] = React.useState(feedback || '')

  return (
    <section
      aria-label="Evaluation Feedback Panel"
      className="evaluation-feedback-panel"
    >
      <h3>Session Feedback</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSubmit(value)
        }}
      >
        <label htmlFor="feedback-input">Feedback</label>
        <textarea
          id="feedback-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          aria-required="true"
        />
        <button type="submit">Submit Feedback</button>
      </form>
    </section>
  )
}
