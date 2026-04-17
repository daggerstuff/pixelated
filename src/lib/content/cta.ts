export const ctaContent = {
  label: 'Pilot the training loop',
  title: 'See whether your team can use it in supervision this week.',
  intro:
    'Start with one training scenario your program already teaches. We will help configure the client profile, run a sample session, and show the transcript, rubric, and coaching workflow.',
  verdictCopy:
    'The pilot is useful only if your supervisors can see how it fits into real teaching, feedback, and trainee improvement.',
  proofItems: [
    {
      label: 'Choose a scenario',
      value:
        'Use an intake, rupture, crisis, cultural humility, or motivational interviewing case your team already needs to practice.',
    },
    {
      label: 'Review the output',
      value:
        'Look at the transcript, rubric markers, coaching notes, and retry workflow before deciding whether it belongs in your program.',
    },
  ],
  decisionTitle: 'A good pilot should answer three questions.',
  rubric: [
    'Can trainees practice scenarios they will actually face?',
    'Can supervisors give clearer feedback with the transcript and rubric?',
    'Can the team repeat the case to measure improvement over time?',
  ],
  primaryCTA: { text: 'Book a pilot', href: '/contact' },
  secondaryCTA: { text: 'Watch the demo', href: '/demo-hub' },
  meta: 'Designed for therapist education, clinical supervision, and behavioral health training teams.',
} as const
