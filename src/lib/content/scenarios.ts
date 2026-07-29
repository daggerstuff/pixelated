export const scenariosContent = {
  label: 'Where teams start',
  title: 'The conversations clinicians should not have to improvise under pressure.',
  cards: [
    {
      kicker: 'Escalation',
      title: 'Crisis and risk',
      body: 'Suicidality screening, de-escalation, and safety planning — including the moment the room changes faster than expected.',
    },
    {
      kicker: 'Rupture',
      title: 'Shutdown, mistrust, repair',
      body: 'Work through avoidance, dysregulation, and withdrawal — and the repairs that decide whether the client stays.',
    },
    {
      kicker: 'Disclosure',
      title: 'The moment the room changes',
      body: 'Practice the turn where a client discloses something high-stakes, without flattening what just happened.',
    },
  ],
  strip: {
    label: 'Who it is built for',
    title: 'Anywhere therapists need repeatable practice before real care.',
    body: 'Any training environment where supervisors need consistent simulations, review evidence, and shared criteria.',
    items: [
      { label: 'Graduate programs', value: 'Repeatable trainee rehearsal' },
      { label: 'Supervision teams', value: 'Concrete review and coaching' },
      { label: 'Care organizations', value: 'High-stakes communication practice' },
    ],
  },
} as const
