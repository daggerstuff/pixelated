export const introContent = {
  label: 'The problem with current training',
  title: 'Most clinical training is expensive to run and almost impossible to reuse.',
  paragraphs: [
    'Once a live roleplay ends, the useful parts usually dissolve into memory, scattered notes, and disagreement about what actually changed the room.',
    'Pixelated Empathy is built to preserve the exchange long enough for a supervisor to review a specific turn, compare clinicians against a shared case, and direct the next attempt with more precision.',
  ],
  panelLabel: 'Where most training breaks down',
  panelItems: [
    {
      label: 'The case gets burned in one room',
      body: 'A difficult conversation runs once, then disappears into opinion, side notes, and whatever the team remembers afterward.',
    },
    {
      label: 'Supervision becomes impressionistic',
      body: 'Teams can feel the conversation shift, but they cannot reliably point to where it happened, why it changed, or what should be coached next.',
    },
    {
      label: 'Comparison gets fuzzy fast',
      body: 'When every trainee gets a different case and a different recap afterward, coaching loses precision almost immediately.',
    },
  ],
  evidenceCards: [
    {
      title: 'What the platform should give back',
      items: [
        'A case the team can rerun without reinventing the setup every time.',
        'A review surface a supervisor can use to coach a specific intervention or miss.',
        'A shared record that lets the team compare clinicians against the same difficult moment.',
      ],
    },
    {
      title: 'What it should never turn into',
      items: [
        'Not a novelty chatbot with therapy language pasted over it.',
        'Not a script tree that rewards memorization instead of judgment.',
        'Not a flashy session that leaves nothing usable for supervision.',
      ],
    },
  ],
} as const
