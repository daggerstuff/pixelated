export const scenariosContent = {
  label: 'What you can practice',
  title: 'Use it on the conversations clinicians least want to improvise in the room.',
  cards: [
    {
      kicker: 'Escalation',
      title: 'Crisis and risk conversations',
      body: 'Practice suicidality screening, de-escalation, safety planning, and what to say when the room changes faster than the clinician expected.',
    },
    {
      kicker: 'Complex Dynamics',
      title: 'Trauma, shutdown, anger, and rupture',
      body: 'Work through avoidance, dysregulation, mistrust, emotional withdrawal, and the repairs that determine whether a client stays in the conversation.',
    },
    {
      kicker: 'Rupture Repair',
      title: 'Alliance strain, mistrust, and therapeutic misattunement',
      body: 'Practice the moments where a client withdraws, flares, tests the therapist, or stops trusting the room, then work the repair without improvising blind.',
    },
  ],
  strip: {
    label: 'Who it is built for',
    title: 'Use it in the teams that have to rehearse difficult judgment under pressure.',
    body:
      'The strongest fit is any training environment where one hard case needs to be run more than once and reviewed by more than one person.',
    items: [
      { label: 'Graduate programs', value: 'For repeatable trainee rehearsal' },
      { label: 'Supervision teams', value: 'For concrete review and coaching' },
      { label: 'Care organizations', value: 'For high-stakes communication practice' },
    ],
  },
} as const
