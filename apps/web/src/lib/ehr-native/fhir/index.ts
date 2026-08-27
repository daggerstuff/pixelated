/**
 * EHR Native — FHIR R4 Resource Helpers
 *
 * Factory functions for creating canonical FHIR R4 resources used by the
 * outcome measure trending feature (F2.4): Questionnaire definitions for
 * PHQ-9, GAD-7, and OQ-45, plus Observation builders for scored results.
 *
 * @see docs/adr/ADR-002-fhir-r4-canonical.md
 */

// ---------------------------------------------------------------------------
// Questionnaire / QuestionnaireResponse helpers
// ---------------------------------------------------------------------------

import type { Questionnaire, QuestionnaireResponse } from '../types/questionnaire.js'
import type { Observation } from '../types/observation.js'

/**
 * Creates the canonical FHIR Questionnaire resource for PHQ-9.
 *
 * PHQ-9 (Patient Health Questionnaire-9) — 9 items, each scored 0-3,
 * total range 0-27.
 *
 * @see https://hl7.org/fhir/R4/questionnaire.html
 */
export function createPHQ9Questionnaire(): Questionnaire {
  const items = Array.from({ length: 9 }, (_, i) => ({
    linkId: `phq9-${String(i + 1).padStart(2, '0')}`,
    text: `PHQ-9 Question ${i + 1}`,
    type: 'choice' as const,
    required: true,
    answerOption: [
      { valueInteger: 0, valueString: 'Not at all' },
      { valueInteger: 1, valueString: 'Several days' },
      { valueInteger: 2, valueString: 'More than half the days' },
      { valueInteger: 3, valueString: 'Nearly every day' },
    ],
  }))

  return {
    resourceType: 'Questionnaire',
    status: 'active',
    url: 'http://example.org/fhir/Questionnaire/phq-9',
    name: 'PHQ9',
    title: 'Patient Health Questionnaire-9',
    version: '1.0.0',
    subjectType: ['Patient'],
    item: items,
  }
}

/**
 * Creates the canonical FHIR Questionnaire resource for GAD-7.
 *
 * GAD-7 (Generalized Anxiety Disorder-7) — 7 items, each scored 0-3,
 * total range 0-21.
 */
export function createGAD7Questionnaire(): Questionnaire {
  const items = Array.from({ length: 7 }, (_, i) => ({
    linkId: `gad7-${String(i + 1).padStart(2, '0')}`,
    text: `GAD-7 Question ${i + 1}`,
    type: 'choice' as const,
    required: true,
    answerOption: [
      { valueInteger: 0, valueString: 'Not at all' },
      { valueInteger: 1, valueString: 'Several days' },
      { valueInteger: 2, valueString: 'More than half the days' },
      { valueInteger: 3, valueString: 'Nearly every day' },
    ],
  }))

  return {
    resourceType: 'Questionnaire',
    status: 'active',
    url: 'http://example.org/fhir/Questionnaire/gad-7',
    name: 'GAD7',
    title: 'Generalized Anxiety Disorder-7',
    version: '1.0.0',
    subjectType: ['Patient'],
    item: items,
  }
}

/**
 * Creates the canonical FHIR Questionnaire resource for OQ-45.
 *
 * OQ-45 (Outcome Questionnaire-45) — 45 items, each scored 0-4,
 * total range 0-180. Some items are reverse-scored.
 */
export function createOQ45Questionnaire(): Questionnaire {
  // Items marked as reverse-scored per OQ-45 manual
  const reverseScored = new Set([
    'oq45-01', 'oq45-04', 'oq45-07', 'oq45-10', 'oq45-12',
    'oq45-13', 'oq45-16', 'oq45-18', 'oq45-20', 'oq45-21',
    'oq45-24', 'oq45-27', 'oq45-28', 'oq45-29', 'oq45-31',
    'oq45-32', 'oq45-34', 'oq45-36', 'oq45-38', 'oq45-40',
    'oq45-41', 'oq45-42', 'oq45-44', 'oq45-45',
  ])

  const items = Array.from({ length: 45 }, (_, i) => {
    const linkId = `oq45-${String(i + 1).padStart(2, '0')}`
    return {
      linkId,
      text: `OQ-45 Question ${i + 1}${reverseScored.has(linkId) ? ' (reverse-scored)' : ''}`,
      type: 'choice' as const,
      required: true,
      answerOption: [
        { valueInteger: 0, valueString: 'Never' },
        { valueInteger: 1, valueString: 'Rarely' },
        { valueInteger: 2, valueString: 'Sometimes' },
        { valueInteger: 3, valueString: 'Frequently' },
        { valueInteger: 4, valueString: 'Almost always' },
      ],
    }
  })

  return {
    resourceType: 'Questionnaire',
    status: 'active',
    url: 'http://example.org/fhir/Questionnaire/oq-45',
    name: 'OQ45',
    title: 'Outcome Questionnaire-45',
    version: '1.0.0',
    subjectType: ['Patient'],
    item: items,
  }
}

/**
 * Gets the canonical Questionnaire for a given measure type.
 */
export function getCanonicalQuestionnaire(measureType: 'phq-9' | 'gad-7' | 'oq-45'): Questionnaire {
  switch (measureType) {
    case 'phq-9':
      return createPHQ9Questionnaire()
    case 'gad-7':
      return createGAD7Questionnaire()
    case 'oq-45':
      return createOQ45Questionnaire()
    default:
      throw new Error(`Unknown measure type: ${measureType}`)
  }
}

/**
 * Builds an Observation resource from a scored outcome measure.
 *
 * The Observation carries the total score as the valueQuantity and the
 * severity interpretation in the interpretation field.
 */
export function buildOutcomeObservation(params: {
  patientId: string
  measureType: 'phq-9' | 'gad-7' | 'oq-45'
  totalScore: number
  severity: 'minimal' | 'mild' | 'moderate' | 'moderately-severe' | 'severe'
  administeredAt: string
  alertFlag: boolean
  alertReason?: string
  changeFromPrevious?: number
}): Observation {
  const loincCodes: Record<string, string> = {
    'phq-9': '89204-2',
    'gad-7': '70274-6',
    'oq-45': '75325-1',
  }

  return {
    resourceType: 'Observation',
    status: 'final',
    category: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'survey',
            display: 'Survey',
          },
        ],
      },
    ],
    code: {
      coding: [
        {
          system: 'http://loinc.org',
          code: loincCodes[params.measureType],
          display: `Outcome Measure - ${params.measureType.toUpperCase()}`,
        },
      ],
    },
    subject: {
      reference: `Patient/${params.patientId}`,
    },
    effectiveDateTime: params.administeredAt,
    valueQuantity: {
      value: params.totalScore,
      unit: 'score',
      system: 'http://unitsofmeasure.org',
      code: '1',
    },
    interpretation: [
      {
        coding: [
          {
            system: 'http://example.org/fhir/CodeSystem/outcome-severity',
            code: params.severity,
            display: params.severity,
          },
        ],
      },
    ],
    ...(params.alertFlag && {
      note: [
        {
          text: params.alertReason ?? `Significant change detected: ${params.changeFromPrevious ?? 0} points from previous administration`,
        },
      ],
    }),
    ...(params.changeFromPrevious != null && {
      component: [
        {
          code: {
            coding: [
              {
                system: 'http://example.org/fhir/CodeSystem/outcome-measure',
                code: 'change-from-previous',
                display: 'Change from Previous Administration',
              },
            ],
          },
          valueQuantity: {
            value: params.changeFromPrevious,
            unit: 'points',
          },
        },
      ],
    }),
  }
}
