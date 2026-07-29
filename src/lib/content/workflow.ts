export const workflowContent = {
  label: 'How the training loop works',
  title: 'Assign a scenario. Review the transcript. Coach the retry.',
  steps: [
    {
      number: '01',
      title: 'Choose the clinical skill to practice',
      body: 'Intake structure, empathy, rupture repair, crisis response, cultural humility — or another teachable skill.',
    },
    {
      number: '02',
      title: 'Run a realistic AI client session',
      body: 'The trainee responds in the moment. The system preserves the transcript, context, and review data.',
    },
    {
      number: '03',
      title: 'Score, coach, and repeat',
      body: 'Supervisors give targeted feedback from the record, then assign a retry or a related case.',
    },
  ],
  bandLabel: 'What each session leaves behind',
  bandTitle: 'A record, scoring signals, and supervisor-ready notes.',
  bandBody: 'The practice run becomes a record your team can teach from, compare, and revisit as skills improve.',
  outputs: [
    { label: 'Durable record', value: 'A saved transcript and notes lane the team can reopen without guesswork.' },
    {
      label: 'Specific feedback',
      value: 'Which intervention worked, which missed, what to practice next.',
    },
    { label: 'Shared standard', value: 'One scenario the team can use to compare judgment across clinicians.' },
  ],
} as const
