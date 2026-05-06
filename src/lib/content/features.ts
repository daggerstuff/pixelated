export const featuresContent = {
  label: 'Product modules',
  title: 'A case library, a practice room, and a review desk built for supervision.',
  copy: 'The product is not a generic chatbot. It is a training system for scenario design, repeated practice, and evidence-based review.',
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
} as const
