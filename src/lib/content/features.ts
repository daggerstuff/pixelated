export const featuresContent = {
  label: 'What the platform makes possible',
  title:
    'Give supervisors the exact coaching moment, not a vague impression.',
  copy: 'Every feature serves the same outcome: keep the conversation believable, then make the next supervision meeting faster, clearer, and more specific.',
  proofLabel: 'What teams feel in week one',
  proofItems: [
    'Less time reconstructing what happened from memory.',
    'More confidence pointing to the line, question, or miss that mattered.',
    'One shared case the whole team can learn from instead of five unrelated roleplays.',
  ],
  cards: [
    {
      title: 'Keep the conversation believable',
      description:
        'The practice surface should feel like a room to navigate, not a branching script to memorize.',
      icon: 'chat',
      image: '/images/features/clinician-in-room.png',
    },
    {
      title: 'Pinpoint the turn worth coaching',
      description:
        'The review preserves the moment that changed the room instead of relying on what the clinician remembers after the fact.',
      icon: 'chart',
      image: '/images/features/supervisor-trace.png',
    },
    {
      title: 'Compare one case across a cohort',
      description:
        'Shared cases turn vague supervision into side-by-side coaching because everyone is working against the same difficult moment.',
      icon: 'shield',
      image: '/images/features/shared-case-comparison.png',
    },
  ],


  comparison: {
    label: 'What clearer supervision sounds like',
    title: 'The difference is whether your team can name the moment.',
    body: 'These are the kinds of before-and-after coaching conversations the product is designed to create.',
    items: [
      {
        label: 'Before',
        value: '“I think they rushed it somewhere around the disclosure.”',
      },
      {
        label: 'After',
        value:
          '“At the disclosure, they reassured before checking immediacy.”',
        accent: true,
      },
      {
        label: 'Before',
        value: 'Each trainee gets a different difficulty curve, so the feedback never lines up.',
      },
      {
        label: 'After',
        value:
          'The team compares how multiple clinicians handled the same rupture and why.',
        accent: true,
      },
    ],
  },
} as const
