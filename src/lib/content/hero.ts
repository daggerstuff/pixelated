export const heroContent = {
  title: 'The practice room for therapists in training',
  subtitle:
    'The conversations that push new clinicians happen here first. Before they happen in a real session.',
  helperText:
    'HIPAA-ready simulations for counseling programs, supervisors, and behavioral health teams.',
  kicker: 'Practice platform',
  proofPoints: [
    {
      label: 'For programs',
      text: 'Accreditation-ready AI clients across intake, crisis, rupture repair, and disclosure.',
    },
    {
      label: 'For supervisors',
      text: 'Review transcripts against timestamped decision points, then coach the retry.',
    },
  ],
  primaryCTA: { text: 'Request Demo', href: '/contact' },
  secondaryCTA: { text: 'See the demo', href: '/demo-hub' },
  artifact: {
    eyebrow: 'Inside the product',
    status: 'A practice room connected to a supervisor review desk.',
    chip: 'Session record',
    mode: 'Practice + review',
    image: '/images/homepage/training-session-proof.png',
    imageAlt:
      'Pixelated Empathy training session interface: practice room, review notes, and session record',
    context: [
      {
        label: 'Practice room',
        value:
          'The trainee enters a scenario and makes live clinical choices in the moment.',
      },
      {
        label: 'Review desk',
        value:
          'The supervisor opens the record, reviews the exchange, and turns it into feedback.',
      },
    ],
    outputs: [
      {
        label: 'Supervisor note',
        value: 'Mark a response for praise, correction, or another attempt.',
      },
      {
        label: 'Training record',
        value:
          'Conversation, scenario, and instructor notes stay attached to the same session.',
      },
      {
        label: 'Repeatable practice',
        value: 'Run the same client again and see if the response changes.',
      },
    ],
    readout: [
      { label: 'Users', value: 'Trainees + supervisors' },
      { label: 'Core unit', value: 'Reusable scenarios' },
      { label: 'Result', value: 'Practice evidence' },
    ],
  },
} as const
