export const ctaContent = {
  label: 'Run the evaluation',
  title: 'Judge it like a supervision tool, not an AI demo.',
  intro:
    'Take one difficult case, give it to a clinician or trainee, then ask whether the transcript and feedback changed the quality of your next supervisory conversation.',
  verdictCopy:
    'If the platform does not give your team a clearer intervention, a sharper risk read, or a better repair on the second pass, it has not earned a place in training.',
  proofItems: [
    {
      label: 'Evaluation step one',
      value: 'Pick a conversation your team actually struggles to coach.',
    },
    {
      label: 'Evaluation step two',
      value: 'Review the transcript together and mark the turning points.',
    },
    {
      label: 'Evaluation step three',
      value: 'Decide whether the platform made your feedback more specific.',
    },
  ],
  decisionTitle:
    'If you would not use the transcript in real supervision next week, walk away.',
  rubric: [
    'Would you bring this transcript into real supervision?',
    'Did it reveal a missed opening worth coaching?',
    'Would a second pass actually be better because of the review?',
  ],
  primaryCTA: { text: 'Start Practice', href: '/signup' },
  secondaryCTA: { text: 'Talk to Us', href: '/contact' },
  meta:
    'No credit card required for trial. Use one real training case and decide from the review, not the pitch.',
} as const
