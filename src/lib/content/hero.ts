export const heroContent = {
  title: 'Practice the hard conversations before they reach a real session.',
  subtitle:
    'Pixelated Empathy gives counseling programs and supervision teams a calmer way to rehearse risk, rupture, silence, disclosure, and repair in a repeatable training space.',
  helperText:
    'Built for counseling programs, clinical supervisors, training clinics, and behavioral health teams.',
  kicker: 'Clinical simulation for therapist education',
  proofPoints: [
    {
      label: 'For trainees',
      text: 'Work through intake, rupture repair, crisis response, and motivational interviewing with AI clients that respond like real people.',
    },
    {
      label: 'For supervisors',
      text: 'Review the exact exchange, pinpoint the clinical choice, and decide what should be practiced again.',
    },
  ],
  primaryCTA: { text: 'Book a pilot', href: '/contact' },
  secondaryCTA: { text: 'Watch the demo', href: '/demo-hub' },
  artifact: {
    eyebrow: 'Inside the product',
    status: 'A practice room connected to a supervisor review desk.',
    chip: 'Session record',
    mode: 'Practice + review',
    image: '/images/homepage/training-session-proof.png',
    imageAlt:
      'Pixelated Empathy training session interface showing the practice room, review notes, and session record',
    context: [
      {
        label: 'Practice room',
        value:
          'The trainee enters a scenario, speaks with an AI client, and makes live clinical choices in the moment.',
      },
      {
        label: 'Review desk',
        value:
          'The supervisor opens the session record, reviews the exchange, and turns the attempt into targeted feedback.',
      },
    ],
    outputs: [
      {
        label: 'Supervisor note',
        value:
          'Highlight the response that needs praise, correction, or another attempt.',
      },
      {
        label: 'Training record',
        value:
          'Keep the conversation, scenario context, and instructor notes attached to the same simulation.',
      },
      {
        label: 'Repeatable practice',
        value:
          'Run the same client scenario again to see whether the trainee changes the response.',
      },
    ],
    readout: [
      { label: 'Users', value: 'Trainees + supervisors' },
      { label: 'Core unit', value: 'Reusable scenarios' },
      { label: 'Result', value: 'Practice evidence' },
    ],
  },
} as const
