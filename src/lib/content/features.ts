export const featuresContent = {
  label: 'What the platform makes possible',
  title: 'The product only earns its place when the next move becomes obvious.',
  copy: 'Each part of the workflow exists to preserve the difficult turn, surface the coaching decision, and make the next review more concrete than memory ever could.',
  proofLabel: 'What a useful first week looks like',
  proofItems: [
    'Less time reconstructing what happened from memory.',
    'More confidence pointing to the line, question, or miss that mattered.',
    'One shared case the whole team can learn from instead of five unrelated roleplays.',
  ],
  cards: [
    {
      title: 'Keep the practice surface believable',
      description:
        'The experience stays close to a live room so the clinician responds to the case instead of gaming a script.',
      icon: 'chat',
    },
    {
      title: 'Pinpoint the turn worth coaching',
      description:
        'The review keeps the exact exchange that changed the room, so supervision can focus on one concrete next move.',
      icon: 'chart',
    },
    {
      title: 'Compare judgment across the same case',
      description:
        'Shared cases turn fuzzy supervision into side-by-side coaching because everyone is working against the same difficult moment.',
      icon: 'shield',
    },
  ],
  comparison: {
    label: 'What clearer supervision sounds like',
    title: 'The difference is whether your team can name the moment.',
    body: 'Weak supervision circles around the session. Strong supervision points to the exact turn that changes the next attempt.',
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
