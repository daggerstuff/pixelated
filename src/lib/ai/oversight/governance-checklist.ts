/**
 * Clinical Governance Checklist
 * Defines required items that must be verified before an AI intervention can be approved
 */

import type {
  GovernanceChecklistItem,
  GovernanceChecklistResult,
} from './types'

/** Default governance checklist items */
export const DEFAULT_CHECKLIST_ITEMS: Omit<
  GovernanceChecklistItem,
  'satisfied' | 'notes'
>[] = [
  {
    id: 'risk_assessed',
    label: 'Risk level has been assessed and is appropriate',
  },
  {
    id: 'technique_appropriate',
    label: 'Therapeutic technique is appropriate for the clinical context',
  },
  {
    id: 'no_harmful_content',
    label: 'Response contains no harmful or contraindicated content',
  },
  {
    id: 'privacy_preserved',
    label: 'Patient privacy and confidentiality are preserved',
  },
  {
    id: 'cultural_sensitivity',
    label: 'Response is culturally sensitive and appropriate',
  },
  {
    id: 'clinical_accuracy',
    label: 'Clinical information is accurate and evidence-based',
  },
  {
    id: 'appropriate_boundary',
    label: 'Response maintains appropriate therapeutic boundaries',
  },
  {
    id: 'crisis_protocol',
    label: 'If crisis indicators present, crisis protocol is followed',
  },
]

/** Get the default checklist with all items unsatisfied */
export function getDefaultChecklist(): GovernanceChecklistItem[] {
  return DEFAULT_CHECKLIST_ITEMS.map((item) => ({
    ...item,
    satisfied: false,
    notes: null,
  }))
}

/** Validate a governance checklist result */
export function validateChecklist(items: GovernanceChecklistItem[]): {
  passed: boolean
  unsatisfied: string[]
} {
  const unsatisfied = items
    .filter((item) => !item.satisfied)
    .map((item) => item.id)

  return {
    passed: unsatisfied.length === 0,
    unsatisfied,
  }
}

/** Create a checklist result from items and therapist ID */
export function createChecklistResult(
  items: GovernanceChecklistItem[],
  therapistId: string,
): GovernanceChecklistResult {
  const { passed } = validateChecklist(items)

  return {
    passed,
    items,
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: therapistId,
  }
}

/** Create a fully satisfied checklist result (for testing/admin override) */
export function createSatisfiedChecklistResult(
  therapistId: string,
): GovernanceChecklistResult {
  return {
    passed: true,
    items: DEFAULT_CHECKLIST_ITEMS.map((item) => ({
      ...item,
      satisfied: true,
      notes: null,
    })),
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: therapistId,
  }
}
