export const featuresContent = {
  label: 'What the platform adds',
  title:
    'Keep the room believable, then hand supervisors a record worth coaching.',
  copy: 'The product has two jobs: hold the clinician inside a believable conversation, then preserve the specific turn a supervisor needs to coach next.',
  proofLabel: 'What the team gets',
  proofItems: [
    'A training surface that behaves more like a room than a script.',
    'A review path that preserves pacing, disclosure, and intervention turns.',
    'A shared case teams can use to compare judgment across clinicians.',
  ],
  cards: [
    {
      title: 'Keep the clinician in the room',
      description:
        'The practice surface should feel like a conversation to navigate, not a branching script to memorize.',
      icon: 'chat',
    },
    {
      title: 'Show the supervisor what changed it',
      description:
        'The review needs to preserve the moment that changed the room, not just the clinician memory of it.',
      icon: 'chart',
    },
    {
      title: 'Compare one case across people',
      description:
        'Shared cases turn vague supervision into side-by-side coaching because everyone is working against the same difficult moment.',
      icon: 'shield',
    },
  ],
  comparison: {
    label: 'What supervision becomes',
    title: 'Move from vague impressions to visible intervention decisions.',
    body: 'The point is not novelty. The point is that a supervisor can point to a turn in the exchange and explain what should change next time.',
    items: [
      {
        label: 'Without a reviewable artifact',
        value: '“I think they got rushed here.”',
      },
      {
        label: 'With Pixelated Empathy',
        value:
          '“At the disclosure, they moved to reassurance before checking immediacy.”',
        accent: true,
      },
      {
        label: 'Without a shared case',
        value:
          'Each trainee gets a different difficulty curve, so coaching stays fuzzy.',
      },
      {
        label: 'With a replayable case',
        value:
          'The team compares how multiple clinicians handled the same rupture.',
        accent: true,
      },
    ],
  },
} as const
