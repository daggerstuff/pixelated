export type ReadinessEnhancement = {
  id: string
  title: string
  summary: string
  outcomes: string[]
  audience: string
}

export const readinessEnhancements = [
  {
    id: 'evidence-locker',
    title: 'Evidence locker for audits',
    summary:
      'Auto-curate policy excerpts, decisions, participant logs, and remediation status into audit-ready packages.',
    outcomes: [
      'Policy excerpts anchored to session decisions',
      'Participant logs with remediation status timelines',
      'Export bundles aligned to HIPAA and SOC 2 expectations',
    ],
    audience: 'Compliance and audit teams',
  },
  {
    id: 'clinical-safety-red-team',
    title: 'Clinical safety red-team simulations',
    summary:
      'Adversarial scenarios that stress-test edge-case harm prevention and escalation accuracy.',
    outcomes: [
      'Edge-case harm prevention drills',
      'Escalation accuracy checks for safety-critical moments',
      'Reinforced clinical safety playbooks',
    ],
    audience: 'Clinical safety leads',
  },
  {
    id: 'vendor-readiness-marketplace',
    title: 'Vendor readiness marketplace',
    summary:
      'Invite third-party vendors to run required simulations and surface risk concentration across partners.',
    outcomes: [
      'Vendor onboarding for required simulations',
      'Consolidated view of third-party readiness risk',
      'Readiness attestations for procurement workflows',
    ],
    audience: 'TPRM and vendor management',
  },
  {
    id: 'incident-to-training-loop',
    title: 'Incident-to-training closed loop',
    summary:
      'Ingest incident learnings to generate targeted micro-modules and re-tests.',
    outcomes: [
      'Incident learnings converted into focused drills',
      'Targeted micro-module assignments',
      'Re-test completion tracking for remediation',
    ],
    audience: 'Quality and training leaders',
  },
  {
    id: 'persona-based-policy-tests',
    title: 'Persona-based policy tests',
    summary:
      'Simulate intake counselors, crisis supervisors, and compliance officers to reveal role-specific gaps.',
    outcomes: [
      'Role-specific policy adherence checks',
      'Gap analysis by persona',
      'Targeted coaching prompts by role',
    ],
    audience: 'Supervisors and program owners',
  },
  {
    id: 'quality-of-care-kpis',
    title: 'Quality-of-care KPIs',
    summary:
      'Map simulation outcomes to clinical quality metrics like escalation timeliness and documentation fidelity.',
    outcomes: [
      'Escalation timeliness scorecards',
      'Documentation fidelity tracking',
      'De-escalation adherence trend lines',
    ],
    audience: 'Quality assurance teams',
  },
  {
    id: 'board-ready-briefings',
    title: 'Board-ready governance briefings',
    summary:
      'Quarterly safety posture summaries tailored for executive and board oversight.',
    outcomes: [
      'Quarterly briefing packs with safety posture highlights',
      'Risk posture summaries for leadership review',
      'Follow-up action tracking with ownership',
    ],
    audience: 'Executives and boards',
  },
  {
    id: 'contractual-readiness-slas',
    title: 'Contractual readiness SLAs',
    summary:
      'Encode readiness cadence into client agreements with automatic reporting and renewal triggers.',
    outcomes: [
      'Readiness cadence commitments in agreements',
      'Automated reporting tied to cadence windows',
      'Renewal trigger visibility for customer teams',
    ],
    audience: 'Commercial and legal teams',
  },
] satisfies ReadinessEnhancement[]
