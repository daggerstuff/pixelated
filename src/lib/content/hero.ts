export const heroContent = {
  title:
    'Therapists rehearse hard conversations before they reach a real client.',
  subtitle:
    'Pixelated Empathy is a clinical simulation platform for therapist training. Trainees practice intake, crisis, rupture, and disclosure against an AI client that responds in real time. Supervisors review the transcript, mark the moments that matter, and coach the next attempt from evidence — not memory.',
  metaDescription:
    'Pixelated Empathy is a clinical simulation platform: trainees practice therapy conversations against an AI client, supervisors review transcripts and coach from evidence. Built for counseling programs, supervisors, and behavioral health teams.',
  helperText:
    'HIPAA-ready simulations for counseling programs, supervisors, and behavioral health teams.',
  kicker: 'Clinical simulation platform',
  proofPoints: [
    {
      label: 'For programs',
      text: 'Assign the same AI client to every trainee. Scenarios cover intake, crisis, rupture repair, and disclosure — repeatable, standardized, and ready for accreditation review.',
    },
    {
      label: 'For supervisors',
      text: 'Open any attempt at the exact turn that mattered. Mark the decision point, leave a note, and assign a retry — the transcript is already there.',
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
