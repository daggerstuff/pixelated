export const featuresContent = {
  label: 'Product modules',
  title: 'A case library, a practice room, and a review desk.',
  copy: 'The product is not a generic chatbot. It is a training system with reusable scenarios, live therapeutic practice, and supervisor tools built around education workflows.',
  proofLabel: 'What changes operationally',
  proofItems: [
    'Faculty stop rebuilding roleplay prompts from scratch.',
    'Trainees can repeat a scenario until a skill is visible, not just discussed.',
  ],
  cards: [
    {
      title: 'Case library',
      description:
        'Build reusable client profiles around diagnosis, context, risk, affect, therapeutic goal, and the skill being taught.',
      icon: 'chat',
    },
    {
      title: 'Practice room',
      description:
        'Let trainees interview an AI client that adapts to tone, timing, avoidance, disclosure, repair attempts, and escalation.',
      icon: 'chart',
    },
    {
      title: 'Review desk',
      description:
        'Open the attempt afterward to inspect the exchange, mark competencies, leave notes, and decide what should be repeated.',
      icon: 'shield',
    },
  ],
  comparison: {
    label: 'What it replaces',
    title: 'Less theater. More teachable clinical behavior.',
    body: 'Traditional roleplay can be useful, but it is hard to standardize. Pixelated Empathy keeps the useful parts of roleplay while adding consistency, repeatability, and review.',
    items: [
      {
        label: 'Ad hoc roleplay',
        value:
          'Different actors, different prompts, different feedback, hard to compare.',
      },
      {
        label: 'Structured simulation',
        value:
          'Consistent scenario, saved attempt, competency review, and repeatable practice.',
        accent: true,
      },
    ],
  },
} as const
