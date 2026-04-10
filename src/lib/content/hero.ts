export const heroContent = {
  title: 'Turn your hardest therapy sessions into sharper supervision.',
  subtitle:
    'Run one realistic case, capture the exact moment the room shifts, and coach from a transcript your team can point to together.',
  helperText:
    'See the product demo first. Bring one difficult case only when the workflow feels right.',
  kicker: 'For therapist training teams that need clearer feedback fast',
  proofPoints: [
    {
      label: 'Catch the moment',
      text: 'Save the intervention, miss, or repair that changed the room.',
    },
    {
      label: 'Coach from evidence',
      text: 'Review transcript, notes, and decision points instead of memory.',
    },
    {
      label: 'Compare judgment',
      text: 'Put multiple clinicians through the same hard case and see what changed.',
    },
  ],
  primaryCTA: { text: 'Book a pilot review', href: '/contact' },
  secondaryCTA: { text: 'See the product demo', href: '/demo-hub' },
  artifact: {
    eyebrow: 'Product proof',
    status: 'A review-ready session record your team can coach from this week.',
    chip: 'Actual product surface',
    mode: 'Proof before pitch',
    image: '/images/homepage/training-session-proof.png',
    imageAlt:
      'Pixelated Empathy training session interface showing therapist response area and coaching notes panel',
    context: [
      {
        label: 'What your team sees',
        value:
          'The live conversation, saved transcript, and coaching lane stay attached in one surface.',
      },
      {
        label: 'Why it lands',
        value:
          'A supervisor can point to the exact turn that needs work instead of rebuilding the session from memory.',
      },
    ],
    outputs: [
      {
        label: 'Specific feedback',
        value: 'Supervisors can coach the exact intervention to revisit next.',
      },
      {
        label: 'Shared reference',
        value: 'Transcript and notes stay attached to the same difficult case.',
      },
      {
        label: 'Cleaner next attempt',
        value:
          'The retry starts from a visible decision, not a vague impression.',
      },
    ],
    readout: [
      { label: 'Who it is for', value: 'Clinical training teams' },
      { label: 'What stays', value: 'Transcript + coaching notes' },
      { label: 'What changes', value: 'Sharper supervision' },
    ],
  },
} as const
