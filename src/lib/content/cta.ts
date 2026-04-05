export const ctaContent = {
  label: 'Test it on one difficult case',
  title:
    'Pilot one case. Judge the record. Keep it only if it sharpens supervision.',
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
  decisionTitle:
    'Keep it if the review gets more specific. Stop if it does not.',
  rubric: [
    'Would you bring this transcript into next week’s supervision?',
    'Did the review reveal one intervention worth changing on the retry?',
  ],
  primaryCTA: { text: 'Start a pilot', href: '/signup' },
  secondaryCTA: { text: 'Talk to Us', href: '/contact' },
  meta: 'One case is enough to tell whether the product makes supervision more concrete.',
} as const
