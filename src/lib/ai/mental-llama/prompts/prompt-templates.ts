import type { MentalLLaMACategory, Message } from '@/lib/ai/mental-llama/types'

const SYSTEM_ROLE_DOMAIN_EXPERTISE = `You are an advanced AI assistant specialized in mental health text analysis. Your goal is to identify potential mental health issues and provide clear, empathetic, and evidence-based explanations. You are not a clinician and should not provide medical advice, diagnosis, or treatment.`

const TASK_SPEC_CHAIN_OF_THOUGHT = `
Analyze the provided text carefully.
1. Identify key phrases, sentiment, and recurring themes.
2. Determine if any specific mental health categories are indicated.
3. If so, select the most prominent category and estimate your confidence.
4. Provide a concise explanation for your reasoning, citing specific examples from the text.
5. If a crisis is detected (e.g., suicidal ideation, self-harm), flag it immediately with the 'crisis' category.
Output your analysis in a structured JSON format.
`

// Placeholder for a more complex 5-Tiered Framework
interface FiveTierPromptParams {
  text: string
  categoryHint?: MentalLLaMACategory | string
  // Add other params as the framework is detailed
}

export function buildGeneralAnalysisPrompt(
  params: FiveTierPromptParams,
): Message[] {
  // Specifics & Context (Tier 3 - simplified here)
  const contextEnhancement = `The user has provided the following text for analysis. Be sensitive and focus on identifying potential indicators.`

  // Few-Shot Examples (Tier 4 - omitted for brevity, but important for real prompts)

  // Strategic Reminders (Tier 5 - simplified here)
  const reminders = `Remember to output valid JSON. If no specific category is clear, use 'general_mental_health' or 'none'. Prioritize crisis detection.`

  return [
    {
      role: 'system',
      content: `${SYSTEM_ROLE_DOMAIN_EXPERTISE}\n${TASK_SPEC_CHAIN_OF_THOUGHT}\n${reminders}`,
    },
    {
      role: 'user',
      content: `${contextEnhancement}\n\nText to analyze:\n"""\n${params.text}\n"""\n\n${params.categoryHint ? `Focus specifically on indicators related to: ${params.categoryHint}.` : ''}\n\nPlease provide your analysis as a JSON object with fields: "mentalHealthCategory" (string), "confidence" (float 0.0-1.0), "explanation" (string), and "supportingEvidence" (array of strings). If a crisis is detected, "mentalHealthCategory" must be "crisis".`,
    },
  ]
}

// Specialized prompts would follow a similar structure but with more targeted instructions
export function buildDepressionAnalysisPrompt(text: string): Message[] {
  return buildGeneralAnalysisPrompt({ text, categoryHint: 'depression' })
}

export function buildAnxietyAnalysisPrompt(text: string): Message[] {
  return buildGeneralAnalysisPrompt({ text, categoryHint: 'anxiety' })
}

export function buildCrisisAnalysisPrompt(text: string): Message[] {
  return buildGeneralAnalysisPrompt({ text, categoryHint: 'crisis' })
}

// Prompts for the MentalHealthTaskRouter
const ROUTING_SYSTEM_PROMPT = `You are an expert text classification system for mental health related queries.
Your task is to analyze the user's input text and determine the most relevant mental health category or task it implies.
Categories include: depression, anxiety, stress, wellness, crisis, general_mental_health, or unknown.
Provide your output as a JSON object with the following fields:
- "category": (string) The most relevant category.
- "confidence": (float, 0.0-1.0) Your confidence in this classification.
- "keywords_matched": (array of strings, optional) Any specific keywords that led to this decision.
- "suggested_analyzer": (string, optional) A more specific analyzer if applicable (e.g., 'depression_analyzer', 'crisis_protocol').
If the text strongly indicates a crisis (suicidal ideation, self-harm, immediate danger), you MUST classify it as "crisis".
`

export function buildRoutingPromptMessages(text: string): Message[] {
  return [
    {
      role: 'system',
      content: ROUTING_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: `Please classify the following text:\n"""\n${text}\n"""\n\nRespond with JSON.`,
    },
  ]
}

// Placeholder for dynamic prompt template system
// This would involve more complex logic to assemble prompts from parts.
export class DynamicPromptTemplateSystem {
  buildPrompt(text: string, _context?: unknown): Message[] {
    // For now, defaults to general analysis
    return buildGeneralAnalysisPrompt({ text })
  }
}

// Example of how specialized prompts could be structured (as per markdown)
// These are just conceptual for now and would need actual implementation.
export const specializedPrompts = {
  depression: buildDepressionAnalysisPrompt,
  anxiety: buildAnxietyAnalysisPrompt,
  stress: (text: string) =>
    buildGeneralAnalysisPrompt({ text, categoryHint: 'stress' }),
  wellness: (text: string) =>
    buildGeneralAnalysisPrompt({ text, categoryHint: 'wellness' }),
  interpersonal_risk: (text: string) =>
    buildGeneralAnalysisPrompt({ text, categoryHint: 'interpersonal_risk' }),
  crisis: buildCrisisAnalysisPrompt,
  // ... other categories
}

export default {
  buildGeneralAnalysisPrompt,
  buildRoutingPromptMessages,
  specializedPrompts,
  DynamicPromptTemplateSystem,
}
