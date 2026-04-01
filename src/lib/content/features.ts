export const featuresContent = {
  label: 'Practice workflow',
  title: 'Built to make supervision sharper, not just louder.',
  copy:
    'The goal is not more AI novelty. It is cleaner clinical rehearsal, clearer supervision, and a record of what actually happened in the room.',
  proofLabel: 'What supervisors can point to',
  proofItems: [
    'Where the clinician pushed too quickly after disclosure',
    'Which question opened the patient up instead of closing them down',
    'How the same scenario changed across multiple trainees',
  ],
  cards: [
    {
      title: 'Run the hard conversation, not a script tree',
      description:
        'Sessions respond to tone, pacing, and judgment so trainees can feel what happens when a patient withdraws, escalates, deflects, or tests the room.',
      icon: 'chat',
    },
    {
      title: 'Review what changed the exchange',
      description:
        'Feedback calls out missed openings, pacing mistakes, escalation points, and the interventions that either stabilized or destabilized the moment.',
      icon: 'chart',
    },
    {
      title: 'Coach against the same case across a team',
      description:
        'Supervisors can replay the same scenario with different clinicians and compare decisions against one shared transcript trail.',
      icon: 'shield',
    },
  ],
  comparison: {
    label: 'What changes in supervision',
    title: 'Move from retrospective opinion to something your team can point at.',
    body:
      'The value is not that the rehearsal feels interesting. The value is that supervisors can show what changed the exchange, what failed, and what should be different on the next run.',
    items: [
      {
        label: 'Without a reviewable artifact',
        value: '“I think the clinician got rushed here.”',
      },
      {
        label: 'With Pixelated Empathy',
        value: '“At the disclosure, they moved to reassurance before checking immediacy.”',
        accent: true,
      },
      {
        label: 'Without a shared case',
        value: 'Each trainee gets different difficulty, so coaching stays fuzzy.',
      },
      {
        label: 'With a replayable case',
        value: 'The team compares how multiple clinicians handled the same rupture.',
        accent: true,
      },
    ],
  },
} as const
