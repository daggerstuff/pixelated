export const heroContent = {
  title:
    'Bring one hard case into rehearsal. Keep the record. Coach the retry.',
  subtitle:
    'Run the conversation live, keep the transcript and notes attached, and review the exact turn a supervisor wants to coach.',
  kicker: 'A calmer way to run training and review the same case',
  proofPoints: [
    'Built for supervision teams, clinical educators, and training leads',
    'One shared case, one saved record, one sharper next attempt',
  ],
  primaryCTA: { text: 'Start a pilot', href: '/signup' },
  secondaryCTA: { text: 'View the product demo', href: '/demo-hub' },
  artifact: {
    eyebrow: 'Product proof',
    status: 'One session record the team can review together.',
    chip: 'Shown from the actual product',
    mode: 'Review-ready',
    image: '/images/homepage/training-session-proof.png',
    imageAlt:
      'Pixelated Empathy training session interface showing therapist response area and coaching notes panel',
    context: [
      {
        label: 'What this shows',
        value:
          'The live training surface, the saved transcript, and the adjacent review lane in one place.',
      },
      {
        label: 'Why it matters',
        value:
          'A supervisor can point at the exact turn that needs work instead of rebuilding the session from memory.',
      },
    ],
    outputs: [
      {
        label: 'Shared case',
        value: 'Clinicians can be coached against the same difficult moment.',
      },
      {
        label: 'Saved record',
        value: 'Transcript and notes stay attached to the run.',
      },
      {
        label: 'Cleaner retry',
        value:
          'The next pass starts from a visible intervention, miss, or repair.',
      },
    ],
    readout: [
      { label: 'Who it is for', value: 'Supervision teams' },
      { label: 'What stays', value: 'Transcript + notes' },
      { label: 'What changes', value: 'Sharper retry' },
    ],
  },
} as const
