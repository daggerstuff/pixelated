export const heroContent = {
  title: 'Clinical Simulation for Therapist Training Programs',
  subtitle:
    'Pixelated Empathy provides counseling programs and supervision teams with an evidence-based platform to rehearse risk assessment, rupture repair, crisis intervention, and clinical documentation in a secure, repeatable training environment.',
  helperText:
    'HIPAA-ready platform for counseling programs, clinical supervisors, training clinics, and behavioral health teams.',
  metaDescription:
    'Pixelated Empathy is a clinical simulation platform for therapist training. Rehearse risk assessment, rupture repair, and crisis intervention with review-ready transcripts.',
  kicker: 'Enterprise Clinical Training Platform',
  proofPoints: [
    {
      label: 'For Training Programs',
      text: 'Accreditation-ready simulation with AI clients that respond authentically to intake, crisis response, motivational interviewing, and rupture repair scenarios.',
    },
    {
      label: 'For Clinical Supervisors',
      text: 'Review session transcripts, track competency development, and provide targeted feedback with timestamped clinical decision points.',
    },
  ],
  primaryCTA: { text: 'Request Demo', href: '/contact' },
  secondaryCTA: { text: 'View Case Studies', href: '/demo-hub' },
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
