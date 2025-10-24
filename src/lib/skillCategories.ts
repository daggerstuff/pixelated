export const SKILL_CATEGORIES = [
  'therapeutic',
  'technical',
  'interpersonal',
] as const
export type SkillCategory = (typeof SKILL_CATEGORIES)[number]

// Predefined mapping of known skill name tokens to categories. Keys are expected to be lowercase.
const SKILL_NAME_MAP: Record<string, SkillCategory> = {
  'active listening': 'interpersonal',
  'rapport building': 'interpersonal',
  'empathy': 'interpersonal',
  'reflective listening': 'interpersonal',

  'cognitive restructuring': 'therapeutic',
  'behavioral activation': 'therapeutic',
  'exposure therapy': 'therapeutic',
  'motivational interviewing': 'therapeutic',

  'technical assessment': 'technical',
  'technical skill': 'technical',
  'documentation': 'technical',
}

export function isValidCategory(cat?: string): cat is SkillCategory {
  if (!cat) {
    return false
  }

  return (SKILL_CATEGORIES as readonly string[]).includes(cat)
}

/**
 * Determine a skill category for a skill name.
 * - If an explicitCategory is provided and valid, return it.
 * - If the skill name matches a mapping entry (exact or substring), return mapped category.
 * - Otherwise fallback to a small set of heuristics and finally 'therapeutic'.
 */
export function getSkillCategory(
  skillName: string,
  explicitCategory?: string,
): SkillCategory {
  if (explicitCategory && isValidCategory(explicitCategory)) {
    return explicitCategory
  }

  const name = (skillName || '').toLowerCase().trim()
  if (!name) {
    return 'therapeutic'
  }

  // Exact mapping
  if (SKILL_NAME_MAP[name]) {
    return SKILL_NAME_MAP[name] as SkillCategory
  }

  // Substring mapping
  for (const key of Object.keys(SKILL_NAME_MAP)) {
    if (name.includes(key)) {
      return SKILL_NAME_MAP[key] as SkillCategory
    }
  }

  // Keyword heuristics
  if (
    name.includes('technical') ||
    name.includes('code') ||
    name.includes('documentation')
  ) {
    return 'technical'
  }

  if (
    name.includes('interpersonal') ||
    name.includes('listening') ||
    name.includes('rapport') ||
    name.includes('empathy')
  ) {
    return 'interpersonal'
  }

  // Default
  return 'therapeutic'
}

export default {
  SKILL_CATEGORIES,
  getSkillCategory,
  isValidCategory,
}
