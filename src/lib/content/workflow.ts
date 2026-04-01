export const workflowContent = {
  label: 'How it works',
  title: 'You run the conversation. The platform scores what happened.',
  steps: [
    {
      number: '01',
      title: 'Choose a scenario',
      body: 'Select the kind of client presentation, level of intensity, and difficulty you want to rehearse.',
    },
    {
      number: '02',
      title: 'Handle the session in real time',
      body: 'The AI patient responds to your tone, questions, pacing, and judgment as the conversation unfolds.',
    },
    {
      number: '03',
      title: 'Review the transcript and feedback',
      body: 'See where the interaction shifted, which opportunities were missed, and what should change on the next pass.',
    },
  ],
  editorial: [
    'Would the transcript change what a supervisor says after the session?',
    'Does the review identify a clinically useful next move?',
    'Would you use this artifact with a real trainee next week?',
  ],
} as const
