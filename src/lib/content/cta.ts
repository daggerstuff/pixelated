export const ctaContent = {
  label: 'Run one hard case',
  title: 'Use one difficult session to decide whether this is worth keeping.',
  intro:
    'You do not need a long rollout to know whether the workflow helps. Bring one hard conversation, run it once, and judge whether the review got more precise.',
  verdictCopy:
    'Keep it only if supervisors can point to the exact moment to revisit and the next attempt gets cleaner.',
  proofItems: [
    {
      label: 'Step one',
      value: 'Choose one conversation your team already struggles to coach clearly.',
    },
    {
      label: 'Step two',
      value:
        'Review one run together and judge whether the feedback got more specific.',
    },
    {
      label: 'Step three',
      value:
        'Decide from the evidence, not from a long sales process or a polished demo.',
    },
  ],
  decisionTitle: 'Keep it only if the coaching gets sharper.',
  rubric: [
    'Would you bring this transcript into next week’s supervision?',
    'Did the review reveal one intervention worth changing on the next pass?',
    'Could your team compare two clinicians against the same difficult moment?',
  ],
  primaryCTA: { text: 'Book a pilot review', href: '/contact' },
  secondaryCTA: { text: 'See the product demo', href: '/demo-hub' },
  meta: 'No long rollout required. One difficult case should tell you whether the workflow is clearer.',
} as const
