import { describe, expect, it } from 'vitest'

import { parseEvidenceFrontmatter } from './frontmatter'

describe('parseEvidenceFrontmatter', () => {
  it('extracts structured frontmatter metadata', () => {
    const raw = `---
title: "Crisis Playbook"
category: operations
tags:
  - safety
  - escalation
  - "policy"
---

# Crisis playbook

Detailed guidance for high risk situations.`

    const parsed = parseEvidenceFrontmatter(raw)

    expect(parsed.title).toBe('Crisis Playbook')
    expect(parsed.category).toBe('operations')
    expect(parsed.tags).toEqual(['safety', 'escalation', 'policy'])
    expect(parsed.body).toContain('Detailed guidance')
    expect(parsed.body).not.toContain('title:')
  })

  it('handles bracket-style tag lists and title fallback to heading', () => {
    const raw = `---
tags: [governance, compliance, risk]
---

# Governance and compliance

This document uses compact frontmatter tags.`

    const parsed = parseEvidenceFrontmatter(raw)

    expect(parsed.title).toBe('Governance and compliance')
    expect(parsed.category).toBeUndefined()
    expect(parsed.tags).toEqual(['governance', 'compliance', 'risk'])
  })

  it('supports comma-delimited tags in non-YAML style strings', () => {
    const raw = `---
title: Evidence
tags: safety, operations, policy
---

Evidence content about operations and policy.`

    const parsed = parseEvidenceFrontmatter(raw)

    expect(parsed.tags).toEqual(['safety', 'operations', 'policy'])
    expect(parsed.title).toBe('Evidence')
  })

  it('falls back to Untitled when no title or heading exists', () => {
    const parsed = parseEvidenceFrontmatter('No frontmatter in this file.')

    expect(parsed.title).toBe('Untitled')
    expect(parsed.tags).toEqual([])
    expect(parsed.body).toContain('No frontmatter in this file.')
  })
})
