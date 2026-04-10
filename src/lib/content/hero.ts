export const heroContent = {
  title: 'Turn one hard therapy session into review-ready coaching evidence.',
  subtitle:
    'Run the case once, keep the transcript and coaching lane attached, and show supervisors the exact turn to revisit next week.',
  helperText:
    'Start with the demo. Bring one difficult case only if the review gets more precise.',
  kicker: 'For therapist training teams that need sharper supervision',
  proofPoints: [
    {
      label: 'Keep the turning point',
      text: 'Save the intervention, miss, or repair that changed the room instead of rebuilding it from memory.',
    },
    {
      label: 'Coach from evidence',
      text: 'Review transcript, notes, and coaching rationale in one place so the next move is obvious.',
    },
  ],
  primaryCTA: { text: 'Book a pilot review', href: '/contact' },
  secondaryCTA: { text: 'See the product demo', href: '/demo-hub' },
  artifact: {
    eyebrow: 'Product proof',
    status: 'A session record your team can coach from this week.',
    chip: 'Actual product surface',
    mode: 'Proof before pitch',
    image: '/images/homepage/training-session-proof.png',
    imageAlt:
      'Pixelated Empathy training session interface showing therapist response area and coaching notes panel',
    context: [
      {
        label: 'What stays attached',
        value:
          'The live conversation, saved transcript, and coaching lane remain tied to the same case.',
      },
      {
        label: 'Why it matters',
        value:
          'A supervisor can point to the exact turn that needs work instead of reconstructing the room from memory.',
      },
    ],
    outputs: [
      {
        label: 'Specific next move',
        value: 'Point to the intervention worth revisiting next, not a vague impression.',
      },
      {
        label: 'Shared review surface',
        value: 'Keep transcript and notes attached to one difficult case the whole team can study.',
      },
      {
        label: 'Cleaner retry',
        value: 'Start the next attempt from a visible decision instead of a fuzzy recap.',
      },
    ],
    readout: [
      { label: 'Who it is for', value: 'Clinical training teams' },
      { label: 'What stays', value: 'Transcript + coaching lane' },
      { label: 'What changes', value: 'Sharper supervision' },
    ],
  },
} as const
