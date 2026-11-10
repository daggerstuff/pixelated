import { describe, expect, it } from 'vitest'

import {
  hasBannedRegister,
  sanitizeTherapyRegister,
} from '../registerGuard'

describe('hasBannedRegister', () => {
  it('matches case-insensitively', () => {
    expect(hasBannedRegister("That's A Lot To Carry alone.")).toBe(true)
  })

  it('matches through curly apostrophes', () => {
    expect(hasBannedRegister('That\u2019s a lot to carry alone.')).toBe(true)
  })

  it('ignores clean clinical text', () => {
    expect(hasBannedRegister('Get that cut closed at an emergency department tonight.')).toBe(false)
  })
})

describe('sanitizeTherapyRegister', () => {
  it('drops a coddling opener and keeps the action that follows', () => {
    const reply =
      "That's a lot to carry alone. Right now, let's get you somewhere safe and get that wound looked at."

    const result = sanitizeTherapyRegister(reply)

    expect(result.altered).toBe(true)
    expect(result.removed).toEqual(["That's a lot to carry alone."])
    expect(result.content).toBe(
      "Right now, let's get you somewhere safe and get that wound looked at.",
    )
  })

  it('keeps a sentence that both coddles and names an escalation', () => {
    const reply = "That's a lot to carry. Call 911 and stay on the line with them."

    const result = sanitizeTherapyRegister(reply)

    expect(result.altered).toBe(true)
    expect(result.removed).toEqual(["That's a lot to carry."])
    expect(result.content).toBe('Call 911 and stay on the line with them.')
  })

  it('never removes a sentence that carries the escalation', () => {
    const reply = "That's a lot to carry, so call 911 now."

    const result = sanitizeTherapyRegister(reply)

    expect(result.altered).toBe(false)
    expect(result.content).toBe(reply)
  })

  it('fails open when every sentence is coddling', () => {
    const reply = "I'm so sorry. You deserve so much better. I hear you."

    const result = sanitizeTherapyRegister(reply)

    expect(result.altered).toBe(false)
    expect(result.content).toBe(reply)
    expect(result.removed).toEqual([])
  })

  it('leaves clean text untouched', () => {
    const reply =
      'Put the pills back in the cupboard and call 911. Tell them you have a date and a method.'

    const result = sanitizeTherapyRegister(reply)

    expect(result.altered).toBe(false)
    expect(result.content).toBe(reply)
  })

  it('handles empty and whitespace-only input', () => {
    expect(sanitizeTherapyRegister('').altered).toBe(false)
    expect(sanitizeTherapyRegister('   \n ').altered).toBe(false)
  })

  it('is idempotent', () => {
    const reply =
      "I hear you. That's a lot to carry. Let's slow down. Call 911 and tell them what you took."

    const once = sanitizeTherapyRegister(reply)
    const twice = sanitizeTherapyRegister(once.content)

    expect(once.altered).toBe(true)
    expect(once.content).toBe("Call 911 and tell them what you took.")
    expect(twice.altered).toBe(false)
    expect(twice.content).toBe(once.content)
  })

  it('fixes the observed v21 self-harm reply', () => {
    const reply =
      "That's a lot to carry alone. I'm not going to lecture you about stopping. Right now, let's get you somewhere safe and get that wound looked at."

    const result = sanitizeTherapyRegister(reply)

    expect(result.altered).toBe(true)
    expect(hasBannedRegister(result.content)).toBe(false)
    expect(result.content).toContain('get that wound looked at')
  })

  it('does not invent an escalation for a reply that has none', () => {
    // The guard owns register only. A reply that never escalates is a training
    // gap, not a phrasing defect, and is left exactly as generated.
    const reply =
      "You've been holding onto a plan to end your life. I want to stay with you right now. What's it like to say that out loud?"

    const result = sanitizeTherapyRegister(reply)

    expect(result.altered).toBe(false)
    expect(result.content).toBe(reply)
  })

  it('does not add a question mark or a hotline', () => {
    const reply = "You are not alone. Call 911 and tell them where you are."

    const result = sanitizeTherapyRegister(reply)

    expect(result.content).toBe('Call 911 and tell them where you are.')
    expect(result.content).not.toMatch(/\?/)
    expect(result.content).not.toMatch(/988|lifeline|text home to/i)
  })
})
