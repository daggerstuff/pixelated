/**
 * EHR Native — Note Template Service (F1.8)
 *
 * Provides modality-specific note templates for behavioral health
 * clinical documentation. Templates define the structure (sections,
 * LOINC codes, required fields) for each type of clinical note,
 * and the service produces FHIR R4 DocumentReference resources from
 * template instances filled with patient and encounter data.
 *
 * Templates are static definitions — no persistence layer is required.
 * The service is stateless and safe to use as a singleton.
 *
 * @see types/document-reference for the DocumentReference FHIR schema
 * @see https://loinc.org/ for LOINC document type codes
 */

import type { DocumentReference } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Clinical modalities supported by the behavioral health platform. */
export type NoteModality =
  | 'individual-therapy'
  | 'group-therapy'
  | 'psychiatric-evaluation'
  | 'crisis-assessment'
  | 'intake-assessment'
  | 'couples-therapy'
  | 'family-therapy'
  | 'medication-management'

/** A single section within a note template. */
export interface NoteSection {
  /** Section identifier (e.g. "chief_complaint", "interventions"). */
  readonly key: string
  /** Human-readable label for the section. */
  readonly label: string
  /** LOINC code identifying this section type. */
  readonly loincCode: string
  /** Whether this section must be present in a completed note. */
  readonly required: boolean
}

/** A modality-specific note template definition. */
export interface NoteTemplate {
  /** Template identifier (e.g. "individual-therapy-progress"). */
  readonly id: string
  /** Display name of the template. */
  readonly name: string
  /** Clinical modality this template belongs to. */
  readonly modality: NoteModality
  /** LOINC document type code for this template. */
  readonly loincType: string
  /** Display string for the LOINC type code. */
  readonly loincTypeDisplay: string
  /** Document category (e.g. "progress-note", "evaluation"). */
  readonly category: string
  /** Ordered list of sections in the note. */
  readonly sections: readonly NoteSection[]
  /** Default docStatus for new notes created from this template. */
  readonly defaultDocStatus: 'preliminary' | 'final'
}

/** Input for creating a DocumentReference from a template. */
export interface CreateNoteFromTemplateInput {
  /** Template ID to use. */
  templateId: string
  /** Patient reference (FHIR Reference, e.g. "Patient/uuid"). */
  patientRef: string
  /** Author reference (FHIR Reference, e.g. "Practitioner/uuid"). */
  authorRef: string
  /** Encounter reference (optional, e.g. "Encounter/uuid"). */
  encounterRef?: string
  /** Note content as a map of sectionKey → text. */
  content: Record<string, string>
  /** Override the template's default doc status. */
  docStatus?: 'preliminary' | 'final'
}

/** Result of validating note content against a template. */
export interface NoteTemplateValidationResult {
  /** Whether the note content is valid for the template. */
  readonly valid: boolean
  /** Keys of missing required sections. */
  readonly missingSections: readonly string[]
  /** Keys of sections present in content but not in the template. */
  readonly extraSections: readonly string[]
  /** Validation error messages. */
  readonly errors: readonly string[]
}

// ---------------------------------------------------------------------------
// Static template definitions
// ---------------------------------------------------------------------------

const INDIVIDUAL_THERAPY_PROGRESS: NoteTemplate = {
  id: 'individual-therapy-progress',
  name: 'Individual Therapy Progress Note',
  modality: 'individual-therapy',
  loincType: '11506-3',
  loincTypeDisplay: 'Progress note',
  category: 'progress-note',
  defaultDocStatus: 'preliminary',
  sections: [
    { key: 'chief_complaint', label: 'Chief Complaint', loincCode: '10154-3', required: true },
    { key: 'symptom_review', label: 'Symptom Review', loincCode: '11498-0', required: true },
    { key: 'mental_status_exam', label: 'Mental Status Examination', loincCode: '11158E', required: true },
    { key: 'interventions', label: 'Interventions', loincCode: '62390-0', required: true },
    { key: 'response_to_treatment', label: 'Response to Treatment', loincCode: '8716-3', required: true },
    { key: 'risk_assessment', label: 'Risk Assessment', loincCode: '75328-6', required: true },
    { key: 'plan', label: 'Plan', loincCode: '18776-5', required: true },
    { key: 'homework', label: 'Homework / Next Session', loincCode: '81246-7', required: false },
  ],
}

const GROUP_THERAPY_PROGRESS: NoteTemplate = {
  id: 'group-therapy-progress',
  name: 'Group Therapy Progress Note',
  modality: 'group-therapy',
  loincType: '11506-3',
  loincTypeDisplay: 'Progress note',
  category: 'progress-note',
  defaultDocStatus: 'preliminary',
  sections: [
    { key: 'group_info', label: 'Group Information', loincCode: '29771-3', required: true },
    { key: 'attendance', label: 'Attendance', loincCode: '61144-5', required: true },
    { key: 'topics_covered', label: 'Topics Covered', loincCode: '48767-8', required: true },
    { key: 'member_participation', label: 'Member Participation', loincCode: '11853-6', required: true },
    { key: 'interventions', label: 'Interventions', loincCode: '62390-0', required: true },
    { key: 'group_dynamics', label: 'Group Dynamics', loincCode: '81244-2', required: false },
    { key: 'plan', label: 'Plan', loincCode: '18776-5', required: true },
  ],
}

const PSYCHIATRIC_EVALUATION: NoteTemplate = {
  id: 'psychiatric-evaluation',
  name: 'Psychiatric Evaluation',
  modality: 'psychiatric-evaluation',
  loincType: '51899-3',
  loincTypeDisplay: 'Evaluation note',
  category: 'evaluation',
  defaultDocStatus: 'preliminary',
  sections: [
    { key: 'chief_complaint', label: 'Chief Complaint', loincCode: '10154-3', required: true },
    { key: 'history_present_illness', label: 'History of Present Illness', loincCode: '10164-2', required: true },
    { key: 'psychiatric_history', label: 'Psychiatric History', loincCode: '10157-6', required: true },
    { key: 'medical_history', label: 'Medical History', loincCode: '11344-9', required: true },
    { key: 'social_history', label: 'Social History', loincCode: '29762-2', required: true },
    { key: 'family_history', label: 'Family History', loincCode: '57175-9', required: true },
    { key: 'mental_status_exam', label: 'Mental Status Examination', loincCode: '11158E', required: true },
    { key: 'diagnostic_impression', label: 'Diagnostic Impression', loincCode: '11487-3', required: true },
    { key: 'risk_assessment', label: 'Risk Assessment', loincCode: '75328-6', required: true },
    { key: 'plan', label: 'Plan', loincCode: '18776-5', required: true },
    { key: 'medications', label: 'Medications', loincCode: '10160-0', required: false },
  ],
}

const CRISIS_ASSESSMENT: NoteTemplate = {
  id: 'crisis-assessment',
  name: 'Crisis Assessment',
  modality: 'crisis-assessment',
  loincType: '67763-7',
  loincTypeDisplay: 'Crisis assessment note',
  category: 'assessment',
  defaultDocStatus: 'final',
  sections: [
    { key: 'presenting_situation', label: 'Presenting Situation', loincCode: '75310-4', required: true },
    { key: 'mental_status_exam', label: 'Mental Status Examination', loincCode: '11158E', required: true },
    { key: 'risk_assessment', label: 'Risk Assessment', loincCode: '75328-6', required: true },
    { key: 'safety_plan', label: 'Safety Plan', loincCode: '75311-2', required: true },
    { key: 'interventions', label: 'Interventions', loincCode: '62390-0', required: true },
    { key: 'disposition', label: 'Disposition', loincCode: '81250-9', required: true },
    { key: 'follow_up', label: 'Follow-Up Plan', loincCode: '18776-5', required: true },
  ],
}

const INTAKE_ASSESSMENT: NoteTemplate = {
  id: 'intake-assessment',
  name: 'Intake Assessment',
  modality: 'intake-assessment',
  loincType: '51899-3',
  loincTypeDisplay: 'Evaluation note',
  category: 'assessment',
  defaultDocStatus: 'preliminary',
  sections: [
    { key: 'chief_complaint', label: 'Chief Complaint', loincCode: '10154-3', required: true },
    { key: 'history_present_illness', label: 'History of Present Illness', loincCode: '10164-2', required: true },
    { key: 'psychiatric_history', label: 'Psychiatric History', loincCode: '10157-6', required: true },
    { key: 'medical_history', label: 'Medical History', loincCode: '11344-9', required: true },
    { key: 'social_history', label: 'Social History', loincCode: '29762-2', required: true },
    { key: 'family_history', label: 'Family History', loincCode: '57175-9', required: true },
    { key: 'substance_history', label: 'Substance Use History', loincCode: '81248-3', required: false },
    { key: 'trauma_history', label: 'Trauma History', loincCode: '74465-6', required: false },
    { key: 'mental_status_exam', label: 'Mental Status Examination', loincCode: '11158E', required: true },
    { key: 'diagnostic_impression', label: 'Diagnostic Impression', loincCode: '11487-3', required: true },
    { key: 'risk_assessment', label: 'Risk Assessment', loincCode: '75328-6', required: true },
    { key: 'treatment_goals', label: 'Treatment Goals', loincCode: '81251-7', required: true },
    { key: 'plan', label: 'Plan', loincCode: '18776-5', required: true },
  ],
}

const COUPLES_THERAPY_PROGRESS: NoteTemplate = {
  id: 'couples-therapy-progress',
  name: 'Couples Therapy Progress Note',
  modality: 'couples-therapy',
  loincType: '11506-3',
  loincTypeDisplay: 'Progress note',
  category: 'progress-note',
  defaultDocStatus: 'preliminary',
  sections: [
    { key: 'session_focus', label: 'Session Focus', loincCode: '48767-8', required: true },
    { key: 'partner1_presentation', label: 'Partner 1 Presentation', loincCode: '11853-6', required: true },
    { key: 'partner2_presentation', label: 'Partner 2 Presentation', loincCode: '11853-6', required: true },
    { key: 'interaction_patterns', label: 'Interaction Patterns', loincCode: '81244-2', required: true },
    { key: 'interventions', label: 'Interventions', loincCode: '62390-0', required: true },
    { key: 'response_to_treatment', label: 'Response to Treatment', loincCode: '8716-3', required: true },
    { key: 'plan', label: 'Plan', loincCode: '18776-5', required: true },
    { key: 'homework', label: 'Homework / Next Session', loincCode: '81246-7', required: false },
  ],
}

const FAMILY_THERAPY_PROGRESS: NoteTemplate = {
  id: 'family-therapy-progress',
  name: 'Family Therapy Progress Note',
  modality: 'family-therapy',
  loincType: '11506-3',
  loincTypeDisplay: 'Progress note',
  category: 'progress-note',
  defaultDocStatus: 'preliminary',
  sections: [
    { key: 'session_focus', label: 'Session Focus', loincCode: '48767-8', required: true },
    { key: 'family_members', label: 'Family Members Present', loincCode: '61144-5', required: true },
    { key: 'interaction_patterns', label: 'Family Interaction Patterns', loincCode: '81244-2', required: true },
    { key: 'interventions', label: 'Interventions', loincCode: '62390-0', required: true },
    { key: 'response_to_treatment', label: 'Response to Treatment', loincCode: '8716-3', required: true },
    { key: 'plan', label: 'Plan', loincCode: '18776-5', required: true },
    { key: 'homework', label: 'Homework / Next Session', loincCode: '81246-7', required: false },
  ],
}

const MEDICATION_MANAGEMENT: NoteTemplate = {
  id: 'medication-management',
  name: 'Medication Management Note',
  modality: 'medication-management',
  loincType: '11506-3',
  loincTypeDisplay: 'Progress note',
  category: 'progress-note',
  defaultDocStatus: 'preliminary',
  sections: [
    { key: 'chief_complaint', label: 'Chief Complaint', loincCode: '10154-3', required: true },
    { key: 'symptom_review', label: 'Symptom Review', loincCode: '11498-0', required: true },
    { key: 'medication_review', label: 'Medication Review', loincCode: '10160-0', required: true },
    { key: 'side_effects', label: 'Side Effects', loincCode: '75315-3', required: true },
    { key: 'adherence', label: 'Medication Adherence', loincCode: '75314-6', required: true },
    { key: 'mental_status_exam', label: 'Mental Status Examination', loincCode: '11158E', required: true },
    { key: 'risk_assessment', label: 'Risk Assessment', loincCode: '75328-6', required: false },
    { key: 'plan', label: 'Plan', loincCode: '18776-5', required: true },
  ],
}

const ALL_TEMPLATES: readonly NoteTemplate[] = [
  INDIVIDUAL_THERAPY_PROGRESS,
  GROUP_THERAPY_PROGRESS,
  PSYCHIATRIC_EVALUATION,
  CRISIS_ASSESSMENT,
  INTAKE_ASSESSMENT,
  COUPLES_THERAPY_PROGRESS,
  FAMILY_THERAPY_PROGRESS,
  MEDICATION_MANAGEMENT,
]

const MODALITIES: readonly NoteModality[] = [
  'individual-therapy',
  'group-therapy',
  'psychiatric-evaluation',
  'crisis-assessment',
  'intake-assessment',
  'couples-therapy',
  'family-therapy',
  'medication-management',
]

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Stateless service for managing behavioral health note templates.
 * Provides template lookup, note creation, and content validation.
 * No persistence layer — templates are static definitions.
 */
export class NoteTemplateService {
  private readonly templates: readonly NoteTemplate[]

  /**
   * @param templates - Custom template list (defaults to all built-in templates).
   */
  constructor(templates: readonly NoteTemplate[] = ALL_TEMPLATES) {
    this.templates = templates
  }

  /**
   * Lists all available note templates, optionally filtered by modality.
   * @param modality - If provided, only return templates for this modality.
   * @returns Array of note templates.
   */
  listTemplates(modality?: NoteModality): NoteTemplate[] {
    if (modality === undefined) {
      return [...this.templates]
    }
    return this.templates.filter((t) => t.modality === modality)
  }

  /**
   * Gets a specific note template by its identifier.
   * @param templateId - The template identifier (e.g. "individual-therapy-progress").
   * @returns The template, or null if not found.
   */
  getTemplate(templateId: string): NoteTemplate | null {
    return this.templates.find((t) => t.id === templateId) ?? null
  }

  /**
   * Lists all clinical modalities that have at least one template.
   * @returns Array of supported modality identifiers.
   */
  listModalities(): NoteModality[] {
    const seen = new Set<NoteModality>()
    for (const t of this.templates) {
      seen.add(t.modality)
    }
    return [...seen]
  }

  /**
   * Creates a FHIR R4 DocumentReference from a template instance
   * filled with patient and encounter data.
   *
   * The resulting DocumentReference has:
   * - status "current"
   * - docStatus from the template default or input override
   * - type set to the template's LOINC code
   * - category set to the template's category
   * - subject set to the patient reference
   * - author set to the author reference
   * - context.encounter set when an encounter reference is provided
   * - content[0].attachment.data containing the serialized note content
   *
   * @param input - The note creation input.
   * @returns A FHIR R4 DocumentReference resource.
   * @throws {Error} If the template ID is not found.
   */
  createNoteFromTemplate(input: CreateNoteFromTemplateInput): DocumentReference {
    const template = this.getTemplate(input.templateId)
    if (template === null) {
      throw new Error(`Note template not found: ${input.templateId}`)
    }

    const docStatus = input.docStatus ?? template.defaultDocStatus
    const now = new Date().toISOString()

    // Build the structured note content as sections
    const noteSections = template.sections.map((section) => ({
      title: section.label,
      loincCode: section.loincCode,
      content: input.content[section.key] ?? '',
    }))

    const attachmentData = JSON.stringify({
      templateId: template.id,
      templateName: template.name,
      modality: template.modality,
      sections: noteSections,
      createdAt: now,
    })

    const documentRef: DocumentReference = {
      resourceType: 'DocumentReference',
      status: 'current',
      docStatus,
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: template.loincType,
            display: template.loincTypeDisplay,
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: 'http://loinc.org',
              code: template.category,
              display: template.category.replace(/-/g, ' '),
            },
          ],
        },
      ],
      subject: { reference: input.patientRef },
      date: now,
      author: [{ reference: input.authorRef }],
      content: [
        {
          attachment: {
            contentType: 'application/json',
            data: Buffer.from(attachmentData).toString('base64'),
            title: `${template.name} - ${now}`,
          },
        },
      ],
      context: input.encounterRef
        ? {
            encounter: [{ reference: input.encounterRef }],
          }
        : undefined,
    }

    return documentRef
  }

  /**
   * Validates note content against a template's required and optional sections.
   *
   * @param templateId - The template identifier to validate against.
   * @param content - A map of sectionKey → text content.
   * @returns Validation result with missing required sections and extra sections.
   */
  validateNote(
    templateId: string,
    content: Record<string, string>,
  ): NoteTemplateValidationResult {
    const template = this.getTemplate(templateId)
    if (template === null) {
      return {
        valid: false,
        missingSections: [],
        extraSections: [],
        errors: [`Note template not found: ${templateId}`],
      }
    }

    const contentKeys = new Set(Object.keys(content))
    const templateSectionKeys = new Set(template.sections.map((s) => s.key))

    const missingSections = template.sections
      .filter((s) => s.required && !contentKeys.has(s.key))
      .map((s) => s.key)

    const extraSections = [...contentKeys].filter(
      (k) => !templateSectionKeys.has(k),
    )

    const emptyRequired = template.sections
      .filter(
        (s) =>
          s.required &&
          contentKeys.has(s.key) &&
          (content[s.key] ?? '').trim() === '',
      )
      .map((s) => s.key)

    const errors: string[] = []
    if (missingSections.length > 0) {
      errors.push(
        `Missing required sections: ${missingSections.join(', ')}`,
      )
    }
    if (extraSections.length > 0) {
      errors.push(
        `Sections not in template: ${extraSections.join(', ')}`,
      )
    }
    if (emptyRequired.length > 0) {
      errors.push(
        `Required sections are empty: ${emptyRequired.join(', ')}`,
      )
    }

    return {
      valid: errors.length === 0,
      missingSections,
      extraSections,
      errors,
    }
  }

  /**
   * Gets all required section keys for a template.
   * @param templateId - The template identifier.
   * @returns Array of required section keys, or empty if template not found.
   */
  getRequiredSections(templateId: string): readonly string[] {
    const template = this.getTemplate(templateId)
    if (template === null) {
      return []
    }
    return template.sections.filter((s) => s.required).map((s) => s.key)
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const noteTemplateService = new NoteTemplateService()
