export const heroContent = {
  title: 'AI roleplay for therapist training teams.',
  subtitle:
    'Pixelated Empathy gives supervisors realistic client simulations, session transcripts, scoring rubrics, and coaching notes so trainees can practice high-stakes conversations before seeing real patients.',
  helperText:
    'Built for counseling programs, clinical supervisors, training clinics, and behavioral health teams.',
  kicker: 'Therapist training simulation platform',
  proofPoints: [
    {
      label: 'Practice with realistic clients',
      text: 'Assign simulated sessions for intake, rupture repair, crisis response, motivational interviewing, and other moments trainees need to rehearse.',
    },
    {
      label: 'Review with evidence',
      text: 'Supervisors see the transcript, rubric signals, and coaching notes in one record instead of relying on memory or generic roleplay feedback.',
    },
  ],
  primaryCTA: { text: 'Book a pilot', href: '/contact' },
  secondaryCTA: { text: 'Watch the demo', href: '/demo-hub' },
  artifact: {
    eyebrow: 'Product workflow',
    status: 'Every practice session becomes a reviewable training record.',
    chip: 'Session record',
    mode: 'Simulation + transcript + rubric',
    image: '/images/homepage/training-session-proof.png',
    imageAlt:
      'Pixelated Empathy training session interface showing therapist response area and coaching notes panel',
    context: [
      {
        label: 'What the trainee does',
        value:
          'Talks through a realistic AI client scenario with enough context to practice clinical judgment, not canned responses.',
      },
      {
        label: 'What the supervisor gets',
        value:
          'A saved transcript, rubric highlights, and coaching notes that make feedback specific and repeatable.',
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
          'Keep the transcript, rubric markers, and coaching notes attached to the same simulation.',
      },
      {
        label: 'Repeatable practice',
        value:
          'Run the same client scenario again to see whether the trainee changes the response.',
      },
    ],
    readout: [
      { label: 'For', value: 'Therapist training teams' },
      { label: 'Includes', value: 'Simulation + transcript' },
      { label: 'Output', value: 'Rubric-backed coaching' },
    ],
  },
} as const
