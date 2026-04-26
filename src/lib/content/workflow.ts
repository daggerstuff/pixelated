export const workflowContent = {
  label: 'How the training loop works',
  title: 'Assign a scenario. Review the transcript. Coach the retry.',
  steps: [
    {
      number: '01',
      title: 'Choose the clinical skill to practice',
      body: 'Start with intake structure, empathy, rupture repair, crisis response, cultural humility, or another teachable skill.',
    },
    {
      number: '02',
      title: 'Run a realistic AI client session',
      body: 'The trainee responds in the moment while the system preserves the transcript, scenario context, and review data.',
    },
    {
      number: '03',
      title: 'Score, coach, and repeat',
      body: 'Supervisors use the session record to give targeted feedback, then assign a retry or related case.',
    },
  ],
  bandLabel: 'What each session leaves behind',
  bandTitle: 'A session record, scoring signals, and supervisor-ready notes.',
  bandBody:
    'The practice run becomes a record your team can teach from, compare across trainees, and revisit as skills improve.',
  outputs: [
    {
      label: 'Durable record',
      value:
        'A saved transcript and notes lane the team can reopen without guesswork.',
    },
    {
      label: 'Specific feedback',
      value:
        'A concrete read on which intervention worked, which response missed, and what to practice next.',
    },
    {
      label: 'Shared standard',
      value:
        'One scenario the team can use to compare judgment across clinicians.',
    },
  ],
} as const
