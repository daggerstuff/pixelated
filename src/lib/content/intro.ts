export const introContent = {
  label: 'What the product does',
  title: 'Turn clinical roleplay into structured practice data.',
  paragraphs: [
    'Pixelated Empathy is a training environment for therapists. Trainees practice with AI clients, then supervisors review the conversation with transcript evidence, rubric markers, and coaching notes.',
    'The product is for counseling programs, supervision groups, training clinics, and behavioral health organizations that need repeatable practice without putting real patients at risk.',
  ],
  panelLabel: 'Where it fits',
  panelItems: [
    {
      label: 'Before practicum',
      body: 'Give students realistic intake, empathy, boundaries, and repair scenarios before they sit with real clients.',
    },
    {
      label: 'During supervision',
      body: 'Review the exact lines a trainee used, score the clinical move, and coach the next attempt from the same record.',
    },
    {
      label: 'Across cohorts',
      body: 'Run the same case across trainees so faculty can compare decision-making and identify where instruction needs reinforcement.',
    },
  ],
  evidenceCards: [
    {
      title: 'What teams usually lack',
      items: [
        'A consistent way to rehearse difficult client conversations.',
        'Transcript-level evidence for what the trainee actually said.',
        'Repeatable scoring that helps supervisors compare growth over time.',
      ],
    },
    {
      title: 'What Pixelated Empathy provides',
      items: [
        'AI client simulations that can be assigned to a class or team.',
        'Session records with transcript, rubric, and coaching context.',
        'A safer practice loop before clinical judgment reaches real care.',
      ],
    },
  ],
} as const
