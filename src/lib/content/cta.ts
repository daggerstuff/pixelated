export const ctaContent = {
  label: 'Pilot it on one real case',
  title: 'Pilot one difficult case and judge the review on its own merits.',
  intro:
    'Pick one difficult conversation your team already finds hard to coach. Run it once, review it together, and decide from the record instead of the pitch.',
  verdictCopy:
    'The bar is simple: the review should make the next supervision conversation more specific and the next attempt more deliberate.',
  proofItems: [
    {
      label: 'Step one',
      value: 'Choose one conversation your team already struggles to coach.',
    },
    {
      label: 'Step two',
      value:
        'Review one run together and judge whether the feedback got more specific.',
    },
    {
      label: 'Step three',
      value:
        'Decide whether you want the next supervision cycle to run this way.',
    },
  ],
  decisionTitle: 'If the review helps, expand the pilot. If it does not, stop.',
  rubric: [
    'Would you bring this transcript into next week’s supervision?',
    'Did the review reveal one intervention worth changing on the retry?',
  ],
  primaryCTA: { text: 'Bring a Case to Pilot', href: '/signup' },
  secondaryCTA: { text: 'Talk to Us', href: '/contact' },
  meta: 'Use one real case, judge the review, and decide from evidence instead of a sales deck.',
} as const
