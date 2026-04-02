export const heroContent = {
  title: 'Bring one hard case into rehearsal. Leave with coaching evidence.',
  subtitle:
    'Pixelated Empathy lets supervision teams run a difficult session, preserve the exchange, and direct the next attempt from something more credible than memory.',
  kicker: 'Clinical rehearsal for supervision teams',
  proofPoints: [
    'Persistent transcript',
    'Shared case across clinicians',
    'Supervisor notes tied to the session',
  ],
  primaryCTA: { text: 'Bring a Case to Pilot', href: '/signup' },
  secondaryCTA: { text: 'See the Product Demo', href: '/demo-hub' },
  stats: [
    {
      value: 'One case',
      label:
        'Keep the difficulty constant so the team compares judgment instead of different scenarios.',
    },
    {
      value: 'One record',
      label:
        'Hold the transcript and review notes in one surface the supervisor can teach from.',
    },
    {
      value: 'One retry',
      label:
        'Direct the next pass from a visible miss, opening, or repair instead of vague recall.',
    },
  ],
  artifact: {
    eyebrow: 'In-product proof',
    status: 'The actual session surface teams can review together.',
    chip: 'Captured in product',
    mode: 'Ready to coach',
    image: '/images/homepage/training-session-proof.png',
    imageAlt: 'Pixelated Empathy training session interface showing therapist response area and coaching notes panel',
    context: [
      { label: 'What you are seeing', value: 'The real training surface, shown as a product capture instead of a staged mockup.' },
      { label: 'Why teams care', value: 'The exchange and coaching notes stay together, so the supervisor can point at the exact turn that needs work.' },
    ],
    outputs: [
      { label: 'Live exchange', value: 'Therapist turns and patient responses stay in one session view.' },
      { label: 'Review lane', value: 'Supervisor notes stay adjacent instead of being rebuilt later.' },
      { label: 'Handoff', value: 'The run moves into review without changing mediums.' },
    ],
    readout: [
      { label: 'Practice', value: 'Shared case' },
      { label: 'Review', value: 'Evidence lane' },
      { label: 'Outcome', value: 'Clearer retry' },
    ],
  },
} as const
