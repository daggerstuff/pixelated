import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ContactService } from '../ContactService'
import { EmailService } from '@/lib/services/email/EmailService'
import { createBuildSafeLogger } from '../../../logging/build-safe-logger'

const logger = createBuildSafeLogger('contact-service')

// Mock dependencies
vi.mock('@/lib/services/email/EmailService')
vi.mock('@/lib/utils/logger')
vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils')
  return {
    ...actual,
    securePathJoin: vi.fn((base: string, file: string) => `${base}/${file}`),
  }
})
vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(`
    <!DOCTYPE html>
    <html>
      <head><title>{{subject}}</title></head>
      <body>
        <h1>Hello {{name}}</h1>
        <p>Your message: {{message}}</p>
        <p>From: {{email}}</p>
        <p>Time: {{timestamp}}</p>
      </body>
    </html>
  `),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
  stat: vi
    .fn()
    .mockResolvedValue({ isFile: () => true, isDirectory: () => false }),
  readdir: vi.fn().mockResolvedValue([]),
}))

const mockEmailService = {
  upsertTemplate: vi.fn().mockResolvedValue(undefined),
  queueEmail: vi.fn().mockResolvedValue('test-queue-id'),
  processQueue: vi.fn().mockResolvedValue(undefined),
  getQueueStats: vi.fn().mockResolvedValue({ pending: 0, processing: 0 }),
}

const MockedEmailService = EmailService as unknown as vi.MockedClass<
  typeof EmailService
>

describe('ContactService', () => {
  let contactService: ContactService

  beforeEach(() => {
    vi.clearAllMocks()
    MockedEmailService.mockImplementation(() => mockEmailService as unknown)
    contactService = new ContactService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('submitContactForm', () => {
    const validFormData = {
      name: 'John Doe',
      email: 'john@example.com',
      subject: 'Test Subject',
      message: 'This is a test message that is long enough to pass validation.',
    }

    const validContext = {
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0 Test Browser',
      timestamp: new Date().toISOString(),
    }

    it('should successfully submit a valid contact form', async () => {
      const result = await contactService.submitContactForm(
        validFormData,
        validContext,
      )

      expect(result.success).toBe(true)
      expect(result.message).toContain('successfully')
      expect(result.submissionId).toBeDefined()
      expect(typeof result.submissionId).toBe('string')

      // Verify emails were queued
      expect(mockEmailService.queueEmail).toHaveBeenCalledTimes(2)

      // Verify internal notification email
      expect(mockEmailService.queueEmail).toHaveBeenCalledWith({
        to: 'info@pixelatedempathy.com',
        templateAlias: 'contact-form-notification',
        templateModel: expect.objectContaining({
          name: validFormData.name,
          email: validFormData.email,
          subject: validFormData.subject,
          message: validFormData.message,
        }),
        metadata: expect.objectContaining({
          type: 'contact-form-notification',
          userEmail: validFormData.email,
        }),
      })

      // Verify confirmation email to user
      expect(mockEmailService.queueEmail).toHaveBeenCalledWith({
        to: validFormData.email,
        templateAlias: 'contact-confirmation',
        templateModel: expect.objectContaining({
          name: validFormData.name,
          email: validFormData.email,
          subject: validFormData.subject,
        }),
        metadata: expect.objectContaining({
          type: 'contact-confirmation',
        }),
      })
    })

    it('should validate name field correctly', async () => {
      // Test empty name
      const emptyNameData = { ...validFormData, name: '' }
      let result = await contactService.submitContactForm(
        emptyNameData,
        validContext,
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('Name')

      // Test short name
      const shortNameData = { ...validFormData, name: 'A' }
      result = await contactService.submitContactForm(
        shortNameData,
        validContext,
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('at least 2 characters')

      // Test long name
      const longNameData = { ...validFormData, name: 'A'.repeat(101) }
      result = await contactService.submitContactForm(
        longNameData,
        validContext,
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('exceed 100 characters')

      // Test invalid characters
      const invalidNameData = { ...validFormData, name: 'John123' }
      result = await contactService.submitContactForm(
        invalidNameData,
        validContext,
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('invalid characters')
    })

    it('should validate email field correctly', async () => {
      // Test empty email
      const emptyEmailData = { ...validFormData, email: '' }
      let result = await contactService.submitContactForm(
        emptyEmailData,
        validContext,
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('email')

      // Test invalid email format
      const invalidEmailData = { ...validFormData, email: 'invalid-email' }
      result = await contactService.submitContactForm(
        invalidEmailData,
        validContext,
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('email')

      // Test long email
      const longEmailData = {
        ...validFormData,
        email: 'a'.repeat(90) + '@example.com',
      }
      result = await contactService.submitContactForm(
        longEmailData,
        validContext,
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('exceed 100 characters')
    })

    it('should validate subject field correctly', async () => {
      // Test empty subject
      const emptySubjectData = { ...validFormData, subject: '' }
      let result = await contactService.submitContactForm(
        emptySubjectData,
        validContext,
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('Subject')

      // Test short subject
      const shortSubjectData = { ...validFormData, subject: 'Hi' }
      result = await contactService.submitContactForm(
        shortSubjectData,
        validContext,
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('at least 3 characters')

      // Test long subject
      const longSubjectData = { ...validFormData, subject: 'A'.repeat(201) }
      result = await contactService.submitContactForm(
        longSubjectData,
        validContext,
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('exceed 200 characters')
    })

    it('should validate message field correctly', async () => {
      // Test empty message
      const emptyMessageData = { ...validFormData, message: '' }
      let result = await contactService.submitContactForm(
        emptyMessageData,
        validContext,
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('Message')

      // Test short message
      const shortMessageData = { ...validFormData, message: 'Hi there' }
      result = await contactService.submitContactForm(
        shortMessageData,
        validContext,
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('at least 10 characters')

      // Test long message
      const longMessageData = { ...validFormData, message: 'A'.repeat(2001) }
      result = await contactService.submitContactForm(
        longMessageData,
        validContext,
      )
      expect(result.success).toBe(false)
      expect(result.message).toContain('exceed 2000 characters')
    })

    it('should perform security checks for spam content', async () => {
      const spamData = {
        ...validFormData,
        message: 'Buy viagra now! Click here for casino wins!',
      }
      const result = await contactService.submitContactForm(
        spamData,
        validContext,
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('security reasons')
    })

    it('should detect too many URLs in message', async () => {
      const urlSpamData = {
        ...validFormData,
        message:
          'Check out https://site1.com and https://site2.com and https://site3.com for more info!',
      }
      const result = await contactService.submitContactForm(
        urlSpamData,
        validContext,
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('security reasons')
    })

    it('should detect excessive word repetition', async () => {
      const repetitiveData = {
        ...validFormData,
        message:
          'Hello hello hello hello hello hello this is a test message with repetitive words.',
      }
      const result = await contactService.submitContactForm(
        repetitiveData,
        validContext,
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('security reasons')
    })

    it('should detect low content diversity', async () => {
      const lowDiversityData = {
        ...validFormData,
        message:
          'test test test test test test test test test test test test test test test test test test test test test',
      }
      const result = await contactService.submitContactForm(
        lowDiversityData,
        validContext,
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('security reasons')
    })

    it('should handle email service failures gracefully', async () => {
      mockEmailService.queueEmail.mockRejectedValueOnce(
        new Error('Email service failure'),
      )

      const result = await contactService.submitContactForm(
        validFormData,
        validContext,
      )

      expect(result.success).toBe(false)
      expect(result.message).toContain('error occurred')
      expect(logger.error).toHaveBeenCalled()
    })

    it('should log successful submissions', async () => {
      await contactService.submitContactForm(validFormData, validContext)

      expect(logger.info).toHaveBeenCalledWith(
        'Contact form submitted successfully',
        expect.objectContaining({
          email: validFormData.email,
          subject: validFormData.subject,
          ipAddress: validContext.ipAddress,
          userAgent: validContext.userAgent,
        }),
      )
    })

    it('should convert email to lowercase', async () => {
      const upperCaseEmailData = { ...validFormData, email: 'JOHN@EXAMPLE.COM' }
      await contactService.submitContactForm(upperCaseEmailData, validContext)

      expect(mockEmailService.queueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'john@example.com',
        }),
      )
    })

    it('should format timestamp properly', async () => {
      const result = await contactService.submitContactForm(
        validFormData,
        validContext,
      )

      expect(result.success).toBe(true)
      expect(mockEmailService.queueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          templateModel: expect.objectContaining({
            timestamp: expect.stringMatching(
              /\w+ \d{1,2}, \d{4} at \d{1,2}:\d{2} [AP]M/,
            ),
          }),
        }),
      )
    })
  })

  describe('processQueue', () => {
    it('should delegate to email service processQueue', async () => {
      await contactService.processQueue()
      expect(mockEmailService.processQueue).toHaveBeenCalled()
    })
  })

  describe('getQueueStats', () => {
    it('should delegate to email service getQueueStats', async () => {
      const stats = await contactService.getQueueStats()
      expect(mockEmailService.getQueueStats).toHaveBeenCalled()
      expect(stats).toEqual({ pending: 0, processing: 0 })
    })
  })
})
