// PersonaService: Modular persona and personality pattern for Demo Hub chat 💬
//
// Responsible for persona context construction, persona-injected message generation, and
// switching between deterministic/scenario and (future) LLM-based persona behaviors.

import type { ChatMessage } from './BrutalistChatDemo'

// Persona context describes scenario, conversational tone, and persona traits
export interface PersonaContext {
  scenario: string
  tone: string
  traits: string[]
}

// Persona service configuration
export interface PersonaServiceConfig {
  mode: 'deterministic' | 'llm'
  personaPreset?: PersonaContext
  getPersonaContext?: () => PersonaContext
}

// Default persona context (inject via scenario in demo)
const DEFAULT_PERSONA_CONTEXT: PersonaContext = {
  scenario: 'Client: Sarah, 28, presenting with anxiety and relationship concerns.',
  tone: 'anxious, defensive, emotional',
  traits: ['ruminative', 'relationship-focused', 'hesitant'],
}

// Returns persona context (deterministic by default, eventually switchable to LLM-driven)
export function getPersonaContext(config?: PersonaServiceConfig): PersonaContext {
  if (config?.mode === 'llm' && config.getPersonaContext) {
    // In production, delegate to LLM-generated persona API or hook here
    return config.getPersonaContext()
  }
  // Always return deep copy to avoid accidental mutation
  return JSON.parse(JSON.stringify(config?.personaPreset ?? DEFAULT_PERSONA_CONTEXT))
}

// Generate a ChatMessage (client, therapist, or system) with persona injection
export function createPersonaMessage(
  params: {
    content: string
    role: 'user' | 'bot' | 'system'
    baseId?: string | number
    config?: PersonaServiceConfig
    metadata?: Record<string, unknown>
    // Optionally override timestamp if desired
    timestamp?: Date
  }
): ChatMessage {
  const persona = getPersonaContext(params.config)
  return {
    id: params.baseId ? params.baseId.toString() : Date.now().toString(),
    role: params.role,
    content: params.content,
    timestamp: params.timestamp ?? new Date(),
    personaContext: persona,
    metadata: params.metadata ?? {},
  }
}

// (Optional) utilities for scenario string rendering, standard persona test-cases, etc.

export const PERSONA_PRESETS: Record<string, PersonaContext> = {
  sarah: DEFAULT_PERSONA_CONTEXT,
  john: {
    scenario: 'Client: John, 40, coping with divorce and job stress.',
    tone: 'withdrawn, irritable, guarded',
    traits: ['introverted', 'career-focused', 'skeptical'],
  },
}

export function personaScenarioString(persona: PersonaContext): string {
  return `${persona.scenario} (Tone: ${persona.tone}; Traits: ${persona.traits.join(', ')})`
}

/**
 * Roadmap: For LLM-driven personality, pass all persona data as part of system prompt / call external LLM tool here.
 *    Optionally, record user-selected persona or inject via scenario picker UI.
 */

  