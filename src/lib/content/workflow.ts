export const workflowContent = {
  label: 'How it works',
  title: 'Use one hard case to find out whether the review is worth keeping.',
  steps: [
    {
      number: '01',
      title: 'Choose the case worth rehearsing',
      body: 'Start with the conversation your team already struggles to coach under pressure.',
    },
    {
      number: '02',
      title: 'Run the conversation in real time',
      body: 'The clinician has to respond to tone, pacing, rupture, disclosure, and resistance as the room changes.',
    },
    {
      number: '03',
      title: 'Review the record and direct the retry',
      body: 'Use the transcript and notes to point at the intervention, miss, or repair that should change on the next attempt.',
    },
  ],
  outputs: [
    { label: 'Session record', value: 'A persistent transcript and notes lane the team can return to.' },
    { label: 'Supervision pass', value: 'A concrete review of where the room shifted and what changed it.' },
    { label: 'Next attempt', value: 'A sharper retry based on a visible decision, not a vague impression.' },
  ],
} as const
