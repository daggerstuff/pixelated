export const scenariosContent = {
  label: 'What you can practice',
  title: 'Train for the moments clinicians do not get to rehearse in public.',
  cards: [
    {
      kicker: 'Escalation',
      title: 'Crisis and risk conversations',
      body: 'Practice suicidality screening, de-escalation, safety planning, and how to stay clinically grounded when the room changes fast.',
    },
    {
      kicker: 'Complex Dynamics',
      title: 'Trauma, shutdown, anger, and rupture',
      body: 'Work through avoidance, dysregulation, mistrust, emotional withdrawal, and the conversational repairs that determine whether a client stays engaged.',
    },
    {
      kicker: 'Supervision',
      title: 'Repeatable training for teams',
      body: 'Give trainees the same hard scenario, compare decisions, and coach against real transcripts instead of vague recollections after the fact.',
    },
  ],
  proofBand: {
    label: 'Why teams keep it in the loop',
    title: 'It gives supervision something concrete to point at.',
    body:
      'Instead of debating vague impressions after a difficult roleplay, teams can replay the exchange, mark the turning points, and compare how different clinicians handled the same moment.',
    items: [
      { label: 'Replay the same scenario', value: 'Across trainees, not just once' },
      { label: 'Review the exact exchange', value: 'Not just memory after supervision' },
      { label: 'Coach to visible decisions', value: 'Instead of generic feedback language' },
    ],
  },
} as const
