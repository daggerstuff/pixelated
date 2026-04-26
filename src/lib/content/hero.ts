export const heroContent = {
  title: 'Train therapists with AI clients before live care.',
  subtitle:
    'Pixelated Empathy is a clinical simulation workspace for counseling programs, supervisors, and behavioral health teams that need safe, repeatable practice for the conversations therapists cannot afford to wing.',
  helperText:
    'Built for counseling programs, clinical supervisors, training clinics, and behavioral health teams.',
  kicker: 'Clinical simulation for therapist education',
  proofPoints: [
    {
      label: 'For trainees',
      text: 'Practice intake, rupture repair, crisis response, and motivational interviewing with AI clients that push back, shut down, disclose, and escalate.',
    },
    {
      label: 'For supervisors',
      text: 'See what the trainee actually said, where the clinical decision landed, and what should be practiced again.',
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
      'Pixelated Empathy training session interface showing therapist response area and coaching notes panel',
    context: [
      {
        label: 'Practice room',
        value:
          'The trainee enters a scenario, speaks with an AI client, and has to make real clinical choices in the moment.',
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
          'Highlight the clinical response that needs praise, correction, or another attempt.',
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
