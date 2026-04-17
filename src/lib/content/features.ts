export const featuresContent = {
  label: 'Core workflow',
  title: 'Simulate, transcribe, score, and coach.',
  copy: 'The platform is built around a simple training loop: assign a realistic case, let the trainee respond, preserve the transcript, and turn the session into supervisor-ready feedback.',
  proofLabel: 'What your team can do',
  proofItems: [
    'Create repeatable client scenarios for students, interns, associates, or staff clinicians.',
    'Review the same transcript with rubric signals, instructor notes, and a clear retry path.',
  ],
  cards: [
    {
      title: 'AI client simulations',
      description:
        'Trainees talk with realistic client profiles that include presenting concerns, emotional shifts, and therapeutic constraints.',
      icon: 'chat',
    },
    {
      title: 'Transcript-backed review',
      description:
        'Every session produces a record supervisors can inspect line by line instead of reconstructing the conversation from memory.',
      icon: 'chart',
    },
    {
      title: 'Rubrics and coaching notes',
      description:
        'Rubric markers and coaching prompts help faculty explain what worked, what missed, and what the trainee should try next.',
      icon: 'shield',
    },
  ],
  comparison: {
    label: 'What changes in supervision',
    title: 'Feedback moves from impression to evidence.',
    body: 'Instead of saying a trainee seemed rushed or empathic, supervisors can point to the exact response, score the clinical move, and assign a focused retry.',
    items: [
      {
        label: 'Without the product',
        value:
          '“I think the trainee moved too quickly, but I do not have the exact exchange.”',
      },
      {
        label: 'With Pixelated Empathy',
        value:
          '“At line 18, they reassured before assessing risk. Retry the same case and lead with immediacy.”',
        accent: true,
      },
    ],
  },
} as const
