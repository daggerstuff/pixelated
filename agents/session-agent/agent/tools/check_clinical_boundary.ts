import { generateText } from 'ai'
import { defineTool } from 'eve/tools'
import { z } from 'zod'

import { getModel } from './workers-ai.js'

interface ClinicalBoundaryResult {
  session_id: string
  category: string
  severity: 'none' | 'warning' | 'critical'
  flagged_risk_criteria: string[]
  boundary_passed: boolean
  escalate_to_supervisor: boolean
  evaluator: string
  evaluated_at: string
  model: string
  [key: string]: unknown
}

const RISK_CRITERIA = [
  'self_harm_ideation_with_intent',
  'harm_to_others_with_intent',
  'acute_medical_emergency',
  'out_of_scenario_roleplay',
  'diagnostic_request',
  'third_party_identifying_detail',
] as const

const SCHEMA = z.object({
  session_id: z.string().uuid(),
  turn_text: z.string().min(1),
  category: z
    .enum(['crisis', 'boundary', 'scope', 'privacy'])
    .default('boundary'),
})

export default defineTool({
  description:
    'Evaluate the most recent turn for clinical and scope safety using ' +
    'Workers AI (@cf/meta/llama-3.2-3b-instruct). Returns severity and ' +
    'risk criteria. Falls back to regex heuristic when AI credentials ' +
    'are missing.',
  inputSchema: SCHEMA,
  async execute(input: z.infer<typeof SCHEMA>) {
    const model = getModel()

    if (model) {
      try {
        return await aiEvaluate(input, model)
      } catch {
        // Fall through to heuristic
      }
    }

    return heuristicEvaluate(input)
  },
})

async function aiEvaluate(
  input: z.infer<typeof SCHEMA>,
  model: NonNullable<ReturnType<typeof getModel>>,
): Promise<ClinicalBoundaryResult> {
  const prompt =
    `You are a clinical safety monitor for a therapist training platform. ` +
    `Analyze this text for ${input.category} safety concerns.\n\n` +
    `Return ONLY valid JSON with NO markdown fences, NO extra text:\n` +
    `{"severity":"none|warning|critical","flagged_risk_criteria":[],` +
    `"boundary_passed":boolean,"escalate_to_supervisor":boolean,"rationale":"max 100 chars"}\n\n` +
    `Valid risk criteria: ${RISK_CRITERIA.join(', ')}\n\n` +
    `TEXT:\n"""\n${input.turn_text}\n"""`

  const { text } = await generateText({ model, prompt })
  const result = parseBoundaryJson(text)

  return {
    session_id: input.session_id,
    category: input.category,
    severity: result.severity,
    flagged_risk_criteria: result.flagged_risk_criteria,
    boundary_passed: result.boundary_passed,
    escalate_to_supervisor: result.escalate_to_supervisor,
    evaluator: 'session-agent.tools.check_clinical_boundary:workers-ai:v1',
    evaluated_at: new Date().toISOString(),
    model: '@cf/meta/llama-3.2-3b-instruct',
  }
}

function parseBoundaryJson(raw: string): {
  severity: 'none' | 'warning' | 'critical'
  flagged_risk_criteria: string[]
  boundary_passed: boolean
  escalate_to_supervisor: boolean
} {
  interface BoundaryJson {
    severity?: unknown
    flagged_risk_criteria?: unknown
    boundary_passed?: unknown
    escalate_to_supervisor?: unknown
  }

  try {
    const cleaned = (raw.match(/\{[\s\S]*\}/) ?? [raw])[0]
    const parsed = JSON.parse(cleaned) as BoundaryJson
    const severityStr =
      typeof parsed.severity === 'string' ? parsed.severity : ''
    return {
      severity: ['none', 'warning', 'critical'].includes(severityStr)
        ? (parsed.severity as 'none' | 'warning' | 'critical')
        : 'none',
      flagged_risk_criteria: Array.isArray(parsed.flagged_risk_criteria)
        ? parsed.flagged_risk_criteria.filter(
            (f): f is string => typeof f === 'string',
          )
        : [],
      boundary_passed:
        typeof parsed.boundary_passed === 'boolean'
          ? parsed.boundary_passed
          : severityStr !== 'critical',
      escalate_to_supervisor:
        typeof parsed.escalate_to_supervisor === 'boolean'
          ? parsed.escalate_to_supervisor
          : severityStr === 'critical',
    }
  } catch {
    return {
      severity: 'none',
      flagged_risk_criteria: [],
      boundary_passed: true,
      escalate_to_supervisor: false,
    }
  }
}

function heuristicEvaluate(
  input: z.infer<typeof SCHEMA>,
): ClinicalBoundaryResult {
  const lower = input.turn_text.toLowerCase()
  const flagged: Array<string> = []

  if (/(kill myself|end it|take my life|i want to die)/.test(lower)) {
    flagged.push('self_harm_ideation_with_intent')
  }
  if (/(kill (him|her|them|someone))/i.test(lower)) {
    flagged.push('harm_to_others_with_intent')
  }
  if (/(overdose|unconscious|can't breathe|seizure)/i.test(lower)) {
    flagged.push('acute_medical_emergency')
  }

  const severity =
    flagged.length === 0
      ? 'none'
      : flagged.includes('acute_medical_emergency') ||
          flagged.includes('self_harm_ideation_with_intent') ||
          flagged.includes('harm_to_others_with_intent')
        ? 'critical'
        : ('warning' as const)

  return {
    session_id: input.session_id,
    category: input.category,
    severity,
    flagged_risk_criteria: flagged,
    boundary_passed: severity !== 'critical',
    escalate_to_supervisor: severity === 'critical',
    evaluator: 'session-agent.tools.check_clinical_boundary:heuristic:v1',
    evaluated_at: new Date().toISOString(),
    model: 'heuristic',
  }
}
