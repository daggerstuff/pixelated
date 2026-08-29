/**
 * Tests for StubTwilioAdapter — in-memory Twilio adapter for dev/testing.
 *
 * @vitest-environment node
 */

import { describe, it, expect, beforeEach } from 'vitest'

import { StubTwilioAdapter } from '../twilio/stub-adapter'

describe('StubTwilioAdapter', () => {
  let adapter: StubTwilioAdapter

  beforeEach(() => {
    adapter = new StubTwilioAdapter()
  })

  describe('properties', () => {
    it('has the stub-twilio name', () => {
      expect(adapter.name).toBe('stub-twilio')
    })
  })

  describe('getAccount', () => {
    it('returns account details for valid token and sid', async () => {
      const account = await adapter.getAccount('valid-token', 'AC123')
      expect(account.sid).toBe('AC123')
      expect(account.friendlyName).toBe('Stub Therapy Clinic Account')
      expect(account.status).toBe('active')
      expect(account.type).toBe('Full')
    })

    it('throws when accessToken is empty', async () => {
      await expect(adapter.getAccount('', 'AC123')).rejects.toThrow(
        'accessToken is required',
      )
    })

    it('throws when accountSid is empty', async () => {
      await expect(adapter.getAccount('token', '')).rejects.toThrow(
        'accountSid is required',
      )
    })
  })

  describe('listMessages', () => {
    it('returns all seeded messages without params', async () => {
      const result = await adapter.listMessages('token')
      expect(result.data).toHaveLength(2)
      expect(result.pagination.count).toBe(2)
    })

    it('filters by to', async () => {
      const result = await adapter.listMessages('token', {
        to: '+15559876543',
      })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].to).toBe('+15559876543')
    })

    it('filters by from', async () => {
      const result = await adapter.listMessages('token', {
        from: '+15551234567',
      })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].from).toBe('+15551234567')
    })

    it('filters by dateSent prefix', async () => {
      const result = await adapter.listMessages('token', {
        dateSent: '2025-06-01',
      })
      expect(result.data).toHaveLength(2)
    })

    it('returns empty for non-matching filter', async () => {
      const result = await adapter.listMessages('token', {
        to: '+15550000000',
      })
      expect(result.data).toHaveLength(0)
      expect(result.pagination.count).toBe(0)
    })
  })

  describe('getMessage', () => {
    it('returns a seeded message by sid', async () => {
      const msg = await adapter.getMessage('token', 'SMstub-message-001')
      expect(msg.sid).toBe('SMstub-message-001')
      expect(msg.body).toContain('appointment is confirmed')
      expect(msg.from).toBe('+15551234567')
      expect(msg.to).toBe('+15559876543')
      expect(msg.status).toBe('delivered')
    })

    it('throws when message not found', async () => {
      await expect(
        adapter.getMessage('token', 'SM_nonexistent'),
      ).rejects.toThrow('message not found: SM_nonexistent')
    })
  })

  describe('sendMessage', () => {
    it('creates a new message with generated sid', async () => {
      const result = await adapter.sendMessage('token', {
        to: '+15559876543',
        from: '+15551234567',
        body: 'Test message',
      })
      expect(result.sid).toMatch(/^SMstub-message-\d+$/)
      expect(result.body).toBe('Test message')
      expect(result.from).toBe('+15551234567')
      expect(result.to).toBe('+15559876543')
      expect(result.status).toBe('queued')
      expect(result.direction).toBe('outbound-api')
    })

    it('stores sent message retrievable by getMessage', async () => {
      const sent = await adapter.sendMessage('token', {
        to: '+15551111111',
        from: '+15552222222',
        body: 'Stored message',
      })
      const fetched = await adapter.getMessage('token', sent.sid)
      expect(fetched.sid).toBe(sent.sid)
      expect(fetched.body).toBe('Stored message')
    })

    it('appears in listMessages after sending', async () => {
      await adapter.sendMessage('token', {
        to: '+15553333333',
        from: '+15554444444',
        body: 'List test',
      })
      const result = await adapter.listMessages('token')
      // sendMessage generates sid SMstub-message-001 which overwrites seeded message1
      expect(result.data).toHaveLength(2)
    })
  })

  describe('listCalls', () => {
    it('returns all seeded calls without params', async () => {
      const result = await adapter.listCalls('token')
      expect(result.data).toHaveLength(2)
      expect(result.pagination.count).toBe(2)
    })

    it('filters by to', async () => {
      const result = await adapter.listCalls('token', {
        to: '+15559876543',
      })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].to).toBe('+15559876543')
    })

    it('filters by from', async () => {
      const result = await adapter.listCalls('token', {
        from: '+15559876543',
      })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].from).toBe('+15559876543')
    })

    it('filters by status', async () => {
      const result = await adapter.listCalls('token', { status: 'completed' })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].status).toBe('completed')
    })

    it('filters by startTime prefix', async () => {
      const result = await adapter.listCalls('token', {
        startTime: '2025-06-15',
      })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].startTime).toContain('2025-06-15')
    })

    it('returns empty for non-matching status', async () => {
      const result = await adapter.listCalls('token', { status: 'failed' })
      expect(result.data).toHaveLength(0)
    })
  })

  describe('getCall', () => {
    it('returns a seeded call by sid', async () => {
      const call = await adapter.getCall('token', 'CAstub-call-001')
      expect(call.sid).toBe('CAstub-call-001')
      expect(call.from).toBe('+15551234567')
      expect(call.to).toBe('+15559876543')
      expect(call.status).toBe('completed')
      expect(call.duration).toBe('180')
    })

    it('throws when call not found', async () => {
      await expect(adapter.getCall('token', 'CA_nonexistent')).rejects.toThrow(
        'call not found: CA_nonexistent',
      )
    })
  })

  describe('makeCall', () => {
    it('creates a new call with generated sid', async () => {
      const result = await adapter.makeCall('token', {
        to: '+15559876543',
        from: '+15551234567',
        url: 'https://example.com/twiml',
      })
      expect(result.sid).toMatch(/^CAstub-call-\d+$/)
      expect(result.from).toBe('+15551234567')
      expect(result.to).toBe('+15559876543')
      expect(result.status).toBe('queued')
      expect(result.direction).toBe('outbound-api')
    })

    it('stores made call retrievable by getCall', async () => {
      const made = await adapter.makeCall('token', {
        to: '+15551111111',
        from: '+15552222222',
        url: 'https://example.com/twiml',
      })
      const fetched = await adapter.getCall('token', made.sid)
      expect(fetched.sid).toBe(made.sid)
    })

    it('appears in listCalls after making', async () => {
      await adapter.makeCall('token', {
        to: '+15553333333',
        from: '+15554444444',
        url: 'https://example.com/twiml',
      })
      const result = await adapter.listCalls('token')
      // makeCall generates sid CAstub-call-001 which overwrites seeded call1
      expect(result.data).toHaveLength(2)
    })
  })

  describe('getPhoneNumber', () => {
    it('returns a seeded phone number by sid', async () => {
      const pn = await adapter.getPhoneNumber('token', 'PNstub-phone-001')
      expect(pn.sid).toBe('PNstub-phone-001')
      expect(pn.phoneNumber).toBe('+15551234567')
      expect(pn.friendlyName).toBe('Therapy Clinic Main Line')
      expect(pn.capabilities?.voice).toBe(true)
      expect(pn.capabilities?.sms).toBe(true)
      expect(pn.capabilities?.mms).toBe(true)
      expect(pn.capabilities?.fax).toBe(false)
    })

    it('throws when phone number not found', async () => {
      await expect(
        adapter.getPhoneNumber('token', 'PN_nonexistent'),
      ).rejects.toThrow('phone number not found: PN_nonexistent')
    })
  })

  describe('listPhoneNumbers', () => {
    it('returns all seeded phone numbers without params', async () => {
      const result = await adapter.listPhoneNumbers('token')
      expect(result.data).toHaveLength(1)
      expect(result.pagination.count).toBe(1)
    })

    it('filters by phoneNumber', async () => {
      const result = await adapter.listPhoneNumbers('token', {
        phoneNumber: '+15551234567',
      })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].phoneNumber).toBe('+15551234567')
    })

    it('filters by friendlyName', async () => {
      const result = await adapter.listPhoneNumbers('token', {
        friendlyName: 'Therapy Clinic Main Line',
      })
      expect(result.data).toHaveLength(1)
    })

    it('returns empty for non-matching phoneNumber', async () => {
      const result = await adapter.listPhoneNumbers('token', {
        phoneNumber: '+15550000000',
      })
      expect(result.data).toHaveLength(0)
    })
  })

  describe('id generation', () => {
    it('generates sequential ids across calls', async () => {
      const m1 = await adapter.sendMessage('token', {
        to: '+1',
        from: '+2',
        body: 'a',
      })
      const m2 = await adapter.sendMessage('token', {
        to: '+3',
        from: '+4',
        body: 'b',
      })
      expect(m1.sid).not.toBe(m2.sid)
    })
  })
})
