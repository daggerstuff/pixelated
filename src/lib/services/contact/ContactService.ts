import { EmailService } from '@/lib/services/email/EmailService'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { securePathJoin } from '../../utils/index'
import { ALLOWED_DIRECTORIES, safeJoin } from '../../../utils/path-security'
import { z } from 'zod'
import { readFile } from 'fs/promises'

const logger = createBuildSafeLogger('contact-service')

// Contact form schema with enhanced validation
const ContactFormSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters')
    .regex(/^[a-zA-Z\s\-']+$/, 'Name contains invalid characters'),
  email: z
    .string()
    .email('Invalid email format')
    .max(100, 'Email must not exceed 100 characters')
    .toLowerCase(),
  subject: z
    .string()
    .min(3, 'Subject must be at least 3 characters')
    .max(200, 'Subject must not exceed 200 characters'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(2000, 'Message must not exceed 2000 characters'),
})

type ContactFormData = z.infer<typeof ContactFormSchema>

interface ContactSubmissionContext {
  ipAddress: string
  userAgent: string
  timestamp: string
}

export class ContactService {
  private emailService: EmailService
  private templates = new Map<string, { html: string; text: string }>()
  private initializationPromise: Promise<void> | null = null
  private isInitialized = false

  constructor() {
    this.emailService = new EmailService()
    // Don't initialize here - use lazy initialization pattern
  }

  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    // If initialization is already in progress, wait for it
    if (this.initializationPromise) {
      await this.initializationPromise
      return
    }

    // Start initialization
    this.initializationPromise = this.initializeTemplates()

    try {
      await this.initializationPromise
      this.isInitialized = true
      this.initializationPromise = null
    } catch (error) {
      this.initializationPromise = null
      throw error
    }
  }

  private async initializeTemplates(): Promise<void> {
    try {
      // Load and register email templates
      await this.loadTemplate('contact-form')
      await this.loadTemplate('contact-confirmation')

      // Register templates with EmailService
      await this.emailService.upsertTemplate({
        alias: 'contact-form-notification',
        subject: 'New Contact Form Submission - {{subject}}',
        htmlBody: this.templates.get('contact-form')?.html || '',
        textBody: this.templates.get('contact-form')?.text || '',
        from: 'noreply@pixelatedempathy.com',
        replyTo: '{{email}}', // Reply to the user who submitted the form
      })

      await this.emailService.upsertTemplate({
        alias: 'contact-confirmation',
        subject: 'Thank you for contacting Pixelated Empathy',
        htmlBody: this.templates.get('contact-confirmation')?.html || '',
        textBody: this.templates.get('contact-confirmation')?.text || '',
        from: 'noreply@pixelatedempathy.com',
        replyTo: 'info@pixelatedempathy.com',
      })

      logger.info('Contact form email templates initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize contact form templates', { error })
      throw new Error('Failed to initialize contact service', { cause: error })
    }
  }

  private async loadTemplate(name: string): Promise<void> {
    try {
      // Validate the template name to prevent path traversal
      const validatedName = name.replace(/[^a-zA-Z0-9_-]/g, '') // Only allow safe characters
      if (!validatedName || validatedName !== name) {
        throw new Error(`Invalid template name: ${name}`)
      }

      const templatesDir = safeJoin(
        ALLOWED_DIRECTORIES.PROJECT_ROOT,
        'templates',
        'email',
      )
      const htmlPath = securePathJoin(
        templatesDir,
        `${validatedName}.html`,
        { allowedExtensions: ['.html'] },
      )
      const html = await readFile(htmlPath, 'utf-8')

      // Generate text version from HTML (basic conversion)
      const text = this.htmlToText(html)

      this.templates.set(name, { html, text })
    } catch (error: unknown) {
      logger.error(`Failed to load template: ${name}`, { error })
      throw error
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()
  }

  /**
   * Submit a contact form with validation and email notifications
   */
  async submitContactForm(
    formData: ContactFormData,
    context: ContactSubmissionContext,
  ): Promise<{ success: boolean; message: string; submissionId?: string }> {
    try {
      // Ensure templates are initialized before processing
      await this.ensureInitialized()

      // Validate form data
      const validatedData = ContactFormSchema.parse(formData)

      // Security checks
      await this.performSecurityChecks(validatedData, context)

      // Generate submission ID for tracking
      const submissionId = crypto.randomUUID()

      // Prepare template data
      const templateData = {
        ...validatedData,
        ...context,
        submissionId,
        timestamp: new Date(context.timestamp).toLocaleString('en-US', {
          timeZone: 'UTC',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        }),
      }

      // Queue internal notification email
      await this.emailService.queueEmail({
        to: 'info@pixelatedempathy.com',
        templateAlias: 'contact-form-notification',
        templateModel: templateData,
        metadata: {
          submissionId,
          type: 'contact-form-notification',
          userEmail: validatedData.email,
        },
      })

      // Queue confirmation email to user
      await this.emailService.queueEmail({
        to: validatedData.email,
        templateAlias: 'contact-confirmation',
        templateModel: templateData,
        metadata: {
          submissionId,
          type: 'contact-confirmation',
        },
      })

      // Log submission for analytics and monitoring
      logger.info('Contact form submitted successfully', {
        submissionId,
        email: validatedData.email,
        subject: validatedData.subject,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      })

      return {
        success: true,
        message:
          'Your message has been sent successfully. You should receive a confirmation email shortly.',
        submissionId,
      }
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        const validationError = error.errors[0]
        logger.warn('Contact form validation failed', {
          error: validationError,
          formData: { ...formData, message: '[REDACTED]' },
          context,
        })

        return {
          success: false,
          message: validationError?.message || 'Validation failed',
        }
      }

      if (error instanceof Error && String(error).startsWith('SECURITY:')) {
        logger.warn('Contact form security check failed', {
          error: String(error),
          context,
        })

        return {
          success: false,
          message:
            'Your submission was blocked for security reasons. Please try again later.',
        }
      }

      logger.error('Contact form submission failed', {
        error,
        formData: { ...formData, message: '[REDACTED]' },
        context,
      })

      return {
        success: false,
        message:
          'An error occurred while sending your message. Please try again later.',
      }
    }
  }

  /**
   * Perform security checks on form submission
   */
  private async performSecurityChecks(
    data: ContactFormData,
    context: ContactSubmissionContext,
  ): Promise<void> {
    // Check for common spam patterns
    const spamPatterns = [
      /\b(viagra|cialis|casino|lottery|winner|congratulations)\b/i,
      /\b(click here|visit now|buy now|limited time)\b/i,
      /\$\d+|\d+\$|money|cash|free|urgent/i,
    ]

    const fullText =
      `${data.name} ${data.subject} ${data.message}`.toLowerCase()

    for (const pattern of spamPatterns) {
      if (pattern.test(fullText)) {
        throw new Error('SECURITY: Potential spam content detected')
      }
    }

    // Check for suspicious patterns
    if (data.message.includes('http://') || data.message.includes('https://')) {
      const urlCount = (data.message.match(/https?:\/\/[^\s]+/g) || []).length
      if (urlCount > 2) {
        throw new Error('SECURITY: Too many URLs in message')
      }
    }

    // Check for excessive repetition
    const words = data.message.toLowerCase().split(/\s+/)
    const wordCounts = new Map<string, number>()
    for (const word of words) {
      if (word.length > 3) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1)
      }
    }

    for (const [, count] of wordCounts) {
      if (count > 5) {
        throw new Error('SECURITY: Excessive word repetition detected')
      }
    }

    // Check message length ratio (detect nonsense text)
    const uniqueWords = new Set(words.filter((w) => w.length > 2))
    const uniqueRatio = uniqueWords.size / words.length
    if (uniqueRatio < 0.3 && words.length > 20) {
      throw new Error('SECURITY: Low content diversity detected')
    }

    // Basic rate limiting would be implemented here with Redis
    // For now, we'll just log the attempt
    logger.debug('Security checks passed for contact form submission', {
      email: data.email,
      ipAddress: context.ipAddress,
    })
  }

  /**
   * Process queued contact form emails
   */
  async processQueue(): Promise<void> {
    await this.emailService.processQueue()
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    return await this.emailService.getQueueStats()
  }
}
