export const heroContent = {
  title: 'Coach the moment that changed the room.',
  subtitle:
    'Run one difficult therapy case, keep the transcript and review lane attached, and give supervisors a concrete next move instead of a fuzzy recap.',
  helperText:
    'Start with the demo. Bring a real case only if the review becomes sharper in the very next supervision.',
  kicker: 'For clinical training teams that need sharper supervision',
  proofPoints: [
    {
      label: 'Keep the turning point',
      text: 'Save the intervention, miss, or repair that changed the room instead of rebuilding it from memory.',
    },
    {
      label: 'Coach from evidence',
      text: 'Review transcript, notes, and rationale together so the next move is specific before the room gets fuzzy.',
    },
  ],
  primaryCTA: { text: 'Watch the demo', href: '/demo-hub' },
  secondaryCTA: { text: 'Book a pilot', href: '/contact' },
  artifact: {
    eyebrow: 'Product proof',
    status: 'A review record your team can coach from next week.',
    chip: 'Product surface',
    mode: 'Proof before pitch',
    image: '/images/homepage/training-session-proof.png',
    imageAlt:
      'Pixelated Empathy training session interface showing therapist response area and coaching notes panel',
    context: [
      {
        label: 'What stays attached',
        value:
          'The live conversation, saved transcript, and coaching lane stay tied to the same case.',
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
