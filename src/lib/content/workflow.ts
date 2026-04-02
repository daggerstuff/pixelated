export const workflowContent = {
  label: 'What one run leaves behind',
  title: 'The session should move cleanly from rehearsal into supervision.',
  steps: [
    {
      number: '01',
      title: 'Choose the difficult case',
      body: 'Start with the conversation your team already struggles to coach under pressure.',
    },
    {
      number: '02',
      title: 'Run it in real time',
      body: 'The clinician responds to tone, pacing, rupture, disclosure, and resistance as the room changes.',
    },
    {
      number: '03',
      title: 'Review the record and direct the retry',
      body: 'Use the transcript and notes to point at the intervention, miss, or repair that should change on the next attempt.',
    },
  ],
  outputs: [
    { label: 'Session record', value: 'A persistent transcript and notes lane the team can return to.' },
    { label: 'Supervision pass', value: 'A concrete read on where the room shifted and what changed it.' },
    { label: 'Next attempt', value: 'A sharper retry based on a visible decision, not a vague impression.' },
  ],
} as const
