export const ctaContent = {
  label: 'Run one hard case',
  title: 'Bring one hard case. Decide fast whether the coaching gets sharper.',
  intro:
    'You do not need a long rollout to know whether the workflow helps. Bring one hard conversation, run it once, and judge whether the review got more precise.',
  verdictCopy:
    'Keep it only if supervisors can point to the exact moment to revisit and the next attempt gets cleaner.',
  proofItems: [
    {
      label: 'Bring one case',
      value:
        'Choose one conversation your team already struggles to coach clearly.',
    },
    {
      label: 'Decide from the evidence',
      value:
        'Review one run together and keep it only if the feedback got more specific.',
    },
  ],
  decisionTitle: 'Keep it only if the coaching gets sharper.',
  rubric: [
    'Would you bring this transcript into next week’s supervision?',
    'Did the review reveal one intervention worth changing on the next pass?',
  ],
  primaryCTA: { text: 'Book a pilot', href: '/contact' },
  secondaryCTA: { text: 'Watch the demo', href: '/demo-hub' },
  meta: 'No long rollout required. One difficult case should tell you whether the workflow is clearer.',
} as const
