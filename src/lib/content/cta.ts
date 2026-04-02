export const ctaContent = {
  label: 'Pilot it on one real case',
  title: 'Start with one difficult conversation and see whether the review gets sharper.',
  intro:
    'Pick one difficult conversation your team already finds hard to coach. Run it, review it together, and decide from the record instead of the pitch.',
  verdictCopy:
    'The bar is simple: the review should make the next coaching conversation more specific and the next attempt more deliberate.',
  proofItems: [
    {
      label: 'Pilot step one',
      value: 'Choose one conversation your team already struggles to coach.',
    },
    {
      label: 'Pilot step two',
      value: 'Review one run together and judge whether the feedback got more specific.',
    },
    {
      label: 'Pilot step three',
      value: 'Decide whether you want the next supervision cycle to run this way.',
    },
  ],
  decisionTitle:
    'If the evidence is useful, expand the pilot. If it is not, walk away.',
  rubric: [
    'Would you bring this transcript into next week’s supervision?',
    'Did the review reveal one intervention worth changing on the retry?',
  ],
  primaryCTA: { text: 'Bring a Case to Pilot', href: '/signup' },
  secondaryCTA: { text: 'See the Product Demo', href: '/demo-hub' },
  meta:
    'Use one real case, judge the review, and decide from evidence instead of a sales deck.',
} as const
