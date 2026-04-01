export const heroContent = {
  title: 'Rehearse the hardest clinical conversations before they happen.',
  subtitle:
    'Run one difficult case, keep the exchange intact, and review the next pass from what actually happened instead of what the room remembers.',
  kicker: 'Clinical rehearsal for supervision teams',
  primaryCTA: { text: 'Start Practice', href: '/signup' },
  secondaryCTA: { text: 'Watch Demo', href: '/demo-hub' },
  stats: [
    {
      value: 'Run the same case',
      label:
        'Give multiple clinicians the same difficult conversation instead of coaching from one-off recollection.',
    },
    {
      value: 'Keep the record',
      label:
        'Hold the transcript, pacing shifts, and decision points in one place a supervisor can actually teach from.',
    },
    {
      value: 'Coach the retry',
      label:
        'Use the actual exchange to decide what the next pass should do differently.',
    },
  ],
  artifact: {
    eyebrow: 'Live product surface',
    status: 'A real session capture from the product, ready for review.',
    chip: 'Captured in product',
    mode: 'Supervision-ready',
    image: '/images/homepage/training-session-proof.png',
    imageAlt: 'Pixelated Empathy training session interface showing therapist response area and coaching notes panel',
    context: [
      { label: 'What you are seeing', value: 'The actual training surface, captured from the product instead of reconstructed for the homepage' },
      { label: 'Why it matters', value: 'The exchange and review notes stay together, so supervision can stay concrete after the session ends' },
    ],
    outputs: [
      { label: 'Live exchange', value: 'Therapist turns and patient responses stay in one training surface' },
      { label: 'Review lane', value: 'Supervisor notes stay adjacent to the session instead of being reconstructed later' },
      { label: 'Handoff', value: 'The run moves from practice into review without changing mediums' },
    ],
    readout: [
      { label: 'Practice', value: 'Session UI' },
      { label: 'Review', value: 'Notes lane' },
      { label: 'Reuse', value: 'Team coaching' },
    ],
  },
} as const
