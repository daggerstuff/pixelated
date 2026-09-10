/**
 * Tests for EHR Native legal review packet generator (G3.1 Legal Review Framework)
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest'

import {
  LegalReviewPacketSchema,
  PacketJurisdictionSchema,
  generateLegalReviewPacket,
  generateStatePacket,
  PACKET_JURISDICTION_COUNT,
} from './legal-packet'
import { SEED_JURISDICTION_COUNT } from './seed-data'
import { attorneySignoffRepository } from './signoff-repository'

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const ATTORNEY_ID = '550e8400-e29b-41d4-a716-446655440000'
const STATE_CODE = 'CA'

const validCreateInput = {
  stateCode: STATE_CODE,
  attorneyId: ATTORNEY_ID,
  attorneyName: 'Jane Doe',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('G3.1 legal review packet', () => {
  beforeEach(() => {
    attorneySignoffRepository.clear()
  })

  describe('LegalReviewPacketSchema', () => {
    it('accepts a valid packet', () => {
      const packet = generateLegalReviewPacket()
      expect(() => LegalReviewPacketSchema.parse(packet)).not.toThrow()
    })

    it('rejects packet missing required fields', () => {
      expect(() => LegalReviewPacketSchema.parse({})).toThrow()
    })

    it('rejects packet with non-uuid packetId', () => {
      const packet = generateLegalReviewPacket()
      expect(() =>
        LegalReviewPacketSchema.parse({ ...packet, packetId: 'not-a-uuid' }),
      ).toThrow()
    })

    it('rejects packet with non-datetime generatedAt', () => {
      const packet = generateLegalReviewPacket()
      expect(() =>
        LegalReviewPacketSchema.parse({ ...packet, generatedAt: 'yesterday' }),
      ).toThrow()
    })

    it('rejects packet with negative jurisdictionCount', () => {
      const packet = generateLegalReviewPacket()
      expect(() =>
        LegalReviewPacketSchema.parse({ ...packet, jurisdictionCount: -1 }),
      ).toThrow()
    })

    it('rejects packet with non-integer jurisdictionCount', () => {
      const packet = generateLegalReviewPacket()
      expect(() =>
        LegalReviewPacketSchema.parse({ ...packet, jurisdictionCount: 1.5 }),
      ).toThrow()
    })

    it('rejects packet with extra fields (strict)', () => {
      const packet = generateLegalReviewPacket()
      expect(() =>
        LegalReviewPacketSchema.parse({ ...packet, extra: 'field' }),
      ).toThrow()
    })

    it('rejects packet with invalid summary fields', () => {
      const packet = generateLegalReviewPacket()
      expect(() =>
        LegalReviewPacketSchema.parse({
          ...packet,
          summary: { ...packet.summary, total: -1 },
        }),
      ).toThrow()
    })
  })

  describe('PacketJurisdictionSchema', () => {
    it('accepts a valid jurisdiction entry', () => {
      const packet = generateLegalReviewPacket()
      const entry = packet.jurisdictions[0]
      expect(() => PacketJurisdictionSchema.parse(entry)).not.toThrow()
    })

    it('rejects entry missing required fields', () => {
      expect(() => PacketJurisdictionSchema.parse({})).toThrow()
    })

    it('rejects entry with extra fields (strict)', () => {
      const packet = generateLegalReviewPacket()
      const entry = packet.jurisdictions[0]
      expect(() =>
        PacketJurisdictionSchema.parse({ ...entry, extra: 'field' }),
      ).toThrow()
    })

    it('rejects entry with invalid signoffStatus enum', () => {
      const packet = generateLegalReviewPacket()
      const entry = packet.jurisdictions[0]
      expect(() =>
        PacketJurisdictionSchema.parse({ ...entry, signoffStatus: 'draft' }),
      ).toThrow()
    })

    it('accepts null sourceUrl', () => {
      const packet = generateLegalReviewPacket()
      const entry = { ...packet.jurisdictions[0], sourceUrl: null }
      expect(() => PacketJurisdictionSchema.parse(entry)).not.toThrow()
    })

    it('rejects non-URL sourceUrl', () => {
      const packet = generateLegalReviewPacket()
      const entry = { ...packet.jurisdictions[0], sourceUrl: 'not-a-url' }
      expect(() => PacketJurisdictionSchema.parse(entry)).toThrow()
    })
  })

  describe('generateLegalReviewPacket', () => {
    it('returns a packet with packetId (uuid)', () => {
      const packet = generateLegalReviewPacket()
      expect(packet.packetId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    })

    it('returns a packet with ISO datetime generatedAt', () => {
      const packet = generateLegalReviewPacket()
      expect(() => new Date(packet.generatedAt).toISOString()).not.toThrow()
      expect(packet.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('includes all seeded jurisdictions', () => {
      const packet = generateLegalReviewPacket()
      expect(packet.jurisdictions).toHaveLength(SEED_JURISDICTION_COUNT)
      expect(packet.jurisdictionCount).toBe(SEED_JURISDICTION_COUNT)
    })

    it('matches PACKET_JURISDICTION_COUNT constant', () => {
      const packet = generateLegalReviewPacket()
      expect(packet.jurisdictionCount).toBe(PACKET_JURISDICTION_COUNT)
    })

    it('produces a unique packetId on each call', () => {
      const a = generateLegalReviewPacket()
      const b = generateLegalReviewPacket()
      expect(a.packetId).not.toBe(b.packetId)
    })

    it('each jurisdiction has stateCode, stateName, ruleConfig, legalReference', () => {
      const packet = generateLegalReviewPacket()
      for (const j of packet.jurisdictions) {
        expect(j.stateCode).toMatch(/^[A-Z]{2}$/)
        expect(j.stateName.length).toBeGreaterThan(0)
        expect(Object.keys(j.ruleConfig).length).toBeGreaterThan(0)
        expect(j.legalReference.length).toBeGreaterThan(0)
      }
    })

    it('each jurisdiction has a checklist with 7 items', () => {
      const packet = generateLegalReviewPacket()
      for (const j of packet.jurisdictions) {
        const items = (j.checklist as { items?: unknown[] }).items
        expect(Array.isArray(items)).toBe(true)
        expect(items).toHaveLength(7)
      }
    })

    it('all jurisdictions have signoffStatus "none" when no signoffs exist', () => {
      const packet = generateLegalReviewPacket()
      for (const j of packet.jurisdictions) {
        expect(j.signoffStatus).toBe('none')
        expect(j.signoffs).toEqual([])
      }
      expect(packet.summary.total).toBe(SEED_JURISDICTION_COUNT)
      expect(packet.summary.noSignoff).toBe(SEED_JURISDICTION_COUNT)
      expect(packet.summary.approved).toBe(0)
      expect(packet.summary.inReview).toBe(0)
      expect(packet.summary.pending).toBe(0)
      expect(packet.summary.rejected).toBe(0)
      expect(packet.summary.withdrawn).toBe(0)
    })
  })

  describe('generateLegalReviewPacket with signoffs', () => {
    it('reports pending status when a sign-off is pending', () => {
      attorneySignoffRepository.create(validCreateInput)
      const packet = generateLegalReviewPacket()
      const ca = packet.jurisdictions.find((j) => j.stateCode === STATE_CODE)
      expect(ca?.signoffStatus).toBe('pending')
      expect(ca?.signoffs).toHaveLength(1)
      expect(packet.summary.pending).toBe(1)
      expect(packet.summary.noSignoff).toBe(SEED_JURISDICTION_COUNT - 1)
    })

    it('reports in_review status when a sign-off moves to in_review', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      attorneySignoffRepository.updateStatus(s.signoffId, 'in_review')
      const packet = generateLegalReviewPacket()
      const ca = packet.jurisdictions.find((j) => j.stateCode === STATE_CODE)
      expect(ca?.signoffStatus).toBe('in_review')
      expect(packet.summary.inReview).toBe(1)
    })

    it('reports approved status when a sign-off is approved', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      attorneySignoffRepository.updateStatus(s.signoffId, 'in_review')
      attorneySignoffRepository.updateStatus(s.signoffId, 'approved')
      const packet = generateLegalReviewPacket()
      const ca = packet.jurisdictions.find((j) => j.stateCode === STATE_CODE)
      expect(ca?.signoffStatus).toBe('approved')
      expect(packet.summary.approved).toBe(1)
    })

    it('reports rejected status when a sign-off is rejected', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      attorneySignoffRepository.updateStatus(s.signoffId, 'in_review')
      attorneySignoffRepository.updateStatus(s.signoffId, 'rejected')
      const packet = generateLegalReviewPacket()
      const ca = packet.jurisdictions.find((j) => j.stateCode === STATE_CODE)
      expect(ca?.signoffStatus).toBe('rejected')
      expect(packet.summary.rejected).toBe(1)
    })

    it('reports withdrawn status when an approved sign-off is withdrawn', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      attorneySignoffRepository.updateStatus(s.signoffId, 'in_review')
      attorneySignoffRepository.updateStatus(s.signoffId, 'approved')
      attorneySignoffRepository.withdraw(s.signoffId)
      const packet = generateLegalReviewPacket()
      const ca = packet.jurisdictions.find((j) => j.stateCode === STATE_CODE)
      expect(ca?.signoffStatus).toBe('withdrawn')
      expect(packet.summary.withdrawn).toBe(1)
      expect(packet.summary.approved).toBe(0)
    })

    it('approved sign-off outranks pending sign-off for the same state', () => {
      const s1 = attorneySignoffRepository.create(validCreateInput)
      const s2 = attorneySignoffRepository.create({
        ...validCreateInput,
        attorneyId: '660e8400-e29b-41d4-a716-446655440099',
      })
      attorneySignoffRepository.updateStatus(s2.signoffId, 'in_review')
      attorneySignoffRepository.updateStatus(s2.signoffId, 'approved')
      // s1 still pending
      const packet = generateLegalReviewPacket()
      const ca = packet.jurisdictions.find((j) => j.stateCode === STATE_CODE)
      expect(ca?.signoffStatus).toBe('approved')
      expect(ca?.signoffs).toHaveLength(2)
      expect(packet.summary.approved).toBe(1)
      expect(packet.summary.pending).toBe(0)
    })
  })

  describe('generateStatePacket', () => {
    it('returns a single-jurisdiction packet for a valid state', () => {
      const packet = generateStatePacket(STATE_CODE)
      expect(packet).toBeDefined()
      expect(packet?.jurisdictionCount).toBe(1)
      expect(packet?.jurisdictions).toHaveLength(1)
      expect(packet?.jurisdictions[0].stateCode).toBe(STATE_CODE)
      expect(packet?.summary.total).toBe(1)
    })

    it('returns undefined for an invalid state code', () => {
      expect(generateStatePacket('ZZ')).toBeUndefined()
    })

    it('returns undefined for an empty state code', () => {
      expect(generateStatePacket('')).toBeUndefined()
    })

    it('produces a valid packetId (uuid)', () => {
      const packet = generateStatePacket('NY')
      expect(packet?.packetId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    })

    it('reports noSignoff=1 when no signoffs exist for the state', () => {
      const packet = generateStatePacket(STATE_CODE)
      expect(packet?.summary.noSignoff).toBe(1)
      expect(packet?.summary.total).toBe(1)
    })

    it('includes a checklistSummary counting items by status', () => {
      const packet = generateStatePacket(STATE_CODE)
      expect(packet?.jurisdictions[0].checklistSummary).toEqual({
        pending: 7,
        verified: 0,
        flagged: 0,
        not_applicable: 0,
      })
    })

    it('reports approved=1 when the state has an approved sign-off', () => {
      const s = attorneySignoffRepository.create(validCreateInput)
      attorneySignoffRepository.updateStatus(s.signoffId, 'in_review')
      attorneySignoffRepository.updateStatus(s.signoffId, 'approved')
      const packet = generateStatePacket(STATE_CODE)
      expect(packet?.summary.approved).toBe(1)
      expect(packet?.summary.noSignoff).toBe(0)
      expect(packet?.jurisdictions[0].signoffStatus).toBe('approved')
    })
  })

  describe('PACKET_JURISDICTION_COUNT', () => {
    it('equals SEED_JURISDICTION_COUNT', () => {
      expect(PACKET_JURISDICTION_COUNT).toBe(SEED_JURISDICTION_COUNT)
    })

    it('is a positive integer', () => {
      expect(Number.isInteger(PACKET_JURISDICTION_COUNT)).toBe(true)
      expect(PACKET_JURISDICTION_COUNT).toBeGreaterThan(0)
    })
  })
})
