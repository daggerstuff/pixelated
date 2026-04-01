export const ctaContent = {
  label: 'Pilot it with one real case',
  title: 'Pilot one difficult case and decide from the review.',
  intro:
    'Pick one difficult conversation your team already finds hard to coach. Run it, review it together, and decide whether the supervision gets sharper.',
  verdictCopy:
    'If the review does not produce a clearer intervention or stronger next pass, it has not earned a place in training.',
  proofItems: [
    {
      label: 'Step one',
      value: 'Pick one conversation your team already struggles to coach.',
    },
    {
      label: 'Step two',
      value: 'Review the run together and decide whether the feedback got more specific.',
    },
  ],
  decisionTitle:
    'If you would not bring the review into supervision next week, do not buy it.',
  rubric: [
    'Would you bring this transcript into real supervision?',
    'Did it reveal one missed opening worth coaching?',
  ],
  primaryCTA: { text: 'Start Practice', href: '/signup' },
  secondaryCTA: { text: 'Talk to Us', href: '/contact' },
  meta:
    'No credit card required for trial. Use one real case and decide from the review.',
} as const
