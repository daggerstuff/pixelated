export const heroContent = {
  title: 'The AI Training Ground for Therapists',
  subtitle:
    'Pixelated Empathy is an AI roleplay platform for therapists, trainees, and care teams who need realistic practice, structured review, and safer repetition before the real conversation starts.',
  primaryCTA: { text: 'Start Practice', href: '/signup' },
  secondaryCTA: { text: 'Watch Demo', href: '/demo-hub' },
  stats: [
    {
      value: 'Repeat the hard case',
      label:
        'Run the same high-risk scenario across trainees instead of coaching from one-off roleplay memories.',
    },
    {
      value: 'Review the record',
      label:
        'Keep transcript, pacing markers, empathy gaps, and escalation points in one supervision-ready artifact.',
    },
    {
      value: 'Coach with specificity',
      label:
        'Use the exact exchange to discuss what changed the room and what the next pass should do differently.',
    },
  ],
  artifact: {
    eyebrow: 'Recorded review structure',
    status: 'What the platform actually returns after a run',
    chip: 'Session artifact',
    mode: 'Supervision review',
    context: [
      { label: 'Scenario', value: 'High-risk outpatient intake' },
      { label: 'Review focus', value: 'Pacing after disclosure' },
    ],
    outputs: [
      { label: 'Transcript', value: 'Timestamped exchange for replay and team review' },
      { label: 'Risk markers', value: 'Disclosure, hesitation, and escalation moments called out' },
      { label: 'Coaching prompts', value: 'Specific openings a supervisor can discuss on the next pass' },
    ],
    readout: [
      { label: 'Record', value: 'Replayable transcript' },
      { label: 'Review', value: 'Empathy + pacing tags' },
      { label: 'Team use', value: 'Supervision-ready artifact' },
    ],
  },
} as const
