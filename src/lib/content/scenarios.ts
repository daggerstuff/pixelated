export const scenariosContent = {
  label: 'Where teams start',
  title:
    'Start with the conversations clinicians should not have to improvise under pressure.',
  cards: [
    {
      kicker: 'Escalation',
      title: 'Crisis and risk conversations',
      body: 'Practice suicidality screening, de-escalation, safety planning, and what to say when the room changes faster than the clinician expected.',
    },
    {
      kicker: 'Rupture',
      title: 'Shutdown, mistrust, anger, and repair',
      body: 'Work through avoidance, dysregulation, emotional withdrawal, and the repairs that determine whether a client stays in the conversation.',
    },
    {
      kicker: 'Disclosure',
      title: 'The moment the room changes',
      body: 'Practice the turn where a client discloses something high-stakes and the therapist has to decide what to do next without flattening the room.',
    },
  ],
  strip: {
    label: 'Who it is built for',
    title:
      'Use it anywhere therapists need repeatable practice before real care.',
    body: 'The strongest fit is any training environment where supervisors need consistent client simulations, transcript evidence, and a shared rubric for feedback.',
    items: [
      { label: 'Graduate programs', value: 'Repeatable trainee rehearsal' },
      { label: 'Supervision teams', value: 'Concrete review and coaching' },
      {
        label: 'Care organizations',
        value: 'High-stakes communication practice',
      },
    ],
  },
} as const
