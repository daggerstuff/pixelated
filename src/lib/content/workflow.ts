export const workflowContent = {
  label: 'What one run leaves behind',
  title: 'The session should move cleanly from rehearsal to review.',
  steps: [
    {
      number: '01',
      title: 'Pick the difficult case',
      body: 'Start with the conversation your team already struggles to coach under pressure.',
    },
    {
      number: '02',
      title: 'Run it live',
      body: 'The clinician responds as the room shifts instead of rehearsing a memorized script.',
    },
    {
      number: '03',
      title: 'Review the record and direct the retry',
      body: 'Use the transcript and notes to point at the intervention, miss, or repair that should change on the next attempt.',
    },
  ],
  outputs: [
    {
      label: 'Session record',
      value: 'A saved transcript and notes lane the team can return to.',
    },
    {
      label: 'Review signal',
      value: 'A concrete read on where the room shifted and what changed it.',
    },
    {
      label: 'Next attempt',
      value: 'A sharper retry based on a visible decision.',
    },
  ],
} as const
