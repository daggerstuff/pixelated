export const workflowContent = {
  label: 'The training loop',
  title: 'Assign. Review. Coach. Repeat.',
  steps: [
    {
      number: '01',
      title: 'Pick the skill',
      body: 'Intake, empathy, rupture repair, crisis response — or any skill your curriculum defines.',
    },
    {
      number: '02',
      title: 'Run the session',
      body: 'The trainee responds in the moment. The transcript, context, and signals are preserved.',
    },
    {
      number: '03',
      title: 'Coach the retry',
      body: 'Supervisors annotate the record, then assign a retry or the next case.',
    },
  ],
  bandLabel: 'What each session leaves behind',
  bandTitle: 'A record, scoring signals, and supervisor-ready notes.',
  bandBody:
    'The practice run becomes a record your team can teach from, compare, and revisit as skills improve.',
  outputs: [
    {
      label: 'Durable record',
      value:
        'A saved transcript and notes lane the team can reopen without guesswork.',
    },
    {
      label: 'Specific feedback',
      value: 'Which intervention worked, which missed, what to practice next.',
    },
    {
      label: 'Shared standard',
      value:
        'One scenario the team can use to compare judgment across clinicians.',
    },
  ],
} as const
