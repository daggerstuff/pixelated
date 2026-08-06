import { isPlainObject } from './is-plain-object.js'

export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  ...overrides: Array<Record<string, unknown> | undefined>
): T {
  const result: Record<string, unknown> = { ...base }

  for (const override of overrides) {
    if (!override) continue

    for (const [key, value] of Object.entries(override)) {
      const existing = result[key]

      if (isPlainObject(existing) && isPlainObject(value)) {
        result[key] = deepMerge(
          existing,
          value,
        )
        continue
      }

      if (value !== undefined) {
        result[key] = value
      }
    }
  }

  return result as T
}
