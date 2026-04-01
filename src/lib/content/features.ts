export const featuresContent = {
  label: 'What the platform adds',
  title: 'One surface for practice, another for the supervisor who has to judge it.',
  copy:
    'The product has two distinct jobs: keep the clinician inside a believable conversation, then give the supervisor a review surface specific enough to teach from.',
  proofLabel: 'What the team gets back',
  proofItems: [
    'A training surface that behaves more like a room than a script',
    'A review path that preserves pacing, disclosure, and intervention turns',
    'A shared case teams can use to compare judgment across clinicians',
  ],
  cards: [
    {
      title: 'Let the clinician stay in the room',
      description:
        'The practice surface should feel like a conversation to navigate, not a branching script to memorize.',
      icon: 'chat',
    },
    {
      title: 'Let the supervisor see what changed it',
      description:
        'The review needs to preserve the moment that changed the room, not just the clinician’s memory of it.',
      icon: 'chart',
    },
    {
      title: 'Let the team compare one case across people',
      description:
        'Shared cases turn vague supervision into side-by-side coaching because everyone is working against the same difficult moment.',
      icon: 'shield',
    },
  ],
  comparison: {
    label: 'What the supervisor’s job becomes',
    title: 'Move from retrospective opinion to visible intervention decisions.',
    body:
      'The point is not novelty. The point is that a supervisor can point to a turn in the exchange and explain what should change next time.',
    items: [
      {
        label: 'Without a reviewable artifact',
        value: '“I think they got rushed here.”',
      },
      {
        label: 'With Pixelated Empathy',
        value: '“At the disclosure, they moved to reassurance before checking immediacy.”',
        accent: true,
      },
      {
        label: 'Without a shared case',
        value: 'Each trainee gets a different difficulty curve, so coaching stays fuzzy.',
      },
      {
        label: 'With a replayable case',
        value: 'The team compares how multiple clinicians handled the same rupture.',
        accent: true,
      },
    ],
  },
} as const
