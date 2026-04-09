export const workflowContent = {
  label: 'How the coaching loop tightens',
  title: 'Three steps from tough case to specific feedback.',
  steps: [
    {
      number: '01',
      title: 'Bring the hard case',
      body: 'Start with the conversation your team already finds difficult to coach under pressure.',
    },
    {
      number: '02',
      title: 'Run it live',
      body: 'The clinician responds as the room shifts instead of rehearsing a memorized script.',
    },
    {
      number: '03',
      title: 'Coach the turning point',
      body: 'Use the transcript and notes to point at the intervention, miss, or repair that should change on the next attempt.',
    },
  ],
  bandLabel: 'What one run should leave behind',
  bandTitle: 'A saved record, a coaching moment, and a clearer next attempt.',
  bandBody:
    'The practice run should not disappear when the session ends. It should leave behind something the whole team can review.',
  outputs: [
    {
      label: 'Coaching artifact',
      value: 'A saved transcript and notes lane the team can return to.',
    },
    {
      label: 'Specific next move',
      value: 'A concrete read on where the room shifted and what should change.',
    },
    {
      label: 'Shared standard',
      value: 'One case the team can use to compare judgment across clinicians.',
    },
  ],
} as const
