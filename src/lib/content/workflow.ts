export const workflowContent = {
  label: 'How the coaching loop tightens',
  title: 'One difficult case in. One clear coaching move out.',
  steps: [
    {
      number: '01',
      title: 'Bring the session your team already struggles to coach',
      body: 'Start with the conversation that keeps turning into vague feedback under pressure.',
    },
    {
      number: '02',
      title: 'Run it once without flattening the room into a script',
      body: 'The clinician still has to respond live while the system keeps the transcript and review lane attached.',
    },
    {
      number: '03',
      title: 'Use the record to name the next move clearly',
      body: 'Review the turning point together and decide what should change on the next attempt.',
    },
  ],
  bandLabel: 'What one run should leave behind',
  bandTitle: 'A saved record, a coaching moment, and a cleaner retry.',
  bandBody:
    'The practice run should not disappear when the session ends. It should leave behind something the whole team can return to next week.',
  outputs: [
    {
      label: 'Durable record',
      value:
        'A saved transcript and notes lane the team can reopen without guesswork.',
    },
    {
      label: 'Specific feedback',
      value:
        'A concrete read on where the room shifted and what should change next.',
    },
    {
      label: 'Shared standard',
      value: 'One case the team can use to compare judgment across clinicians.',
    },
  ],
} as const
