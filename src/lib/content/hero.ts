export const heroContent = {
  title: 'The practice room for therapists in training',
  subtitle:
    'The hardest turns in therapy — risk, rupture, disclosure — should never be rehearsed for the first time on a real client. Practice them here against an AI client that pushes back, then walk into supervision with the transcript already open.',
  metaDescription:
    'Pixelated Empathy is the practice room for therapists in training: rehearse crisis, rupture, and disclosure against an adaptive AI client, then review the transcript with a supervisor.',
  helperText:
    'HIPAA-ready simulations for counseling programs, supervisors, and behavioral health teams.',
  kicker: 'Practice platform',
  proofPoints: [
    {
      label: 'For programs',
      text: 'Accreditation-ready AI clients that hold up across intake, crisis, rupture repair, and disclosure — the same case, assignable to every trainee.',
    },
    {
      label: 'For supervisors',
      text: 'Reopen any attempt at the exact turn that mattered, mark the decision point, and coach the retry from evidence instead of memory.',
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
