---
title: 'Email Service'
description: 'Guide to Pixelated Healths email service implementation and configuration'
pubDate: 2025-03-24
share: true
toc: true
lastModDate: 2025-03-25
tags: ['email', 'services', 'communication']
author: 'Pixelated Team'
---

# Email Service

The Email Service in Pixelated is designed to handle all transactional email communication with high reliability and security. It uses Postmark as the email delivery provider and implements a robust queuing system with Redis for reliable delivery.

## Features

- Reliable email delivery with queuing and retries
- Template-based emails
- HIPAA-compliant email handling
- Comprehensive error handling and logging
- Queue monitoring and statistics
- Type-safe API with Zod validation

## Usage

### Basic Usage

```tsx

const emailService = new EmailService()

// Queue an email
await emailService.queueEmail({
  to: 'patient@example.com',
  templateAlias: 'appointment-reminder',
  templateModel: {
    name: 'John Doe',
    date: '2025-03-15',
    time: '14:00',
  },
})
```

### Creating Templates

```tsx
await emailService.upsertTemplate({
  alias: 'appointment-reminder',
  subject: 'Your upcoming appointment',
  htmlBody: `
  `,
  from: 'appointments@gradiant.dev',
})
```

### Monitoring Queue Status

```tsx
const stats = await emailService.getQueueStats()
console.log(`Queued: ${stats.queued}, Processing: ${stats.processing}`)
```

## Configuration

The email service requires the following environment variables:

```bash
$1=YOUR_API_KEY_HERE
EMAIL_FROM_ADDRESS=noreply@gradiant.dev
```

## Queue System

The email service uses Redis for queue management with two queues:

1. `email:queue` - Main queue for pending emails
2. `email:processing` - Queue for emails being processed

### Retry Strategy

Failed emails are automatically retried with exponential backoff:

- 1st retry: 1 minute
- 2nd retry: 5 minutes
- 3rd retry: 15 minutes

After 3 failed attempts, the email is considered permanently failed and logged.

## Types

### EmailData

```tsx
interface EmailData {
  to: string
  templateAlias: string
  templateModel: Record<string, unknown>
  attachments?: Array<{
    name: string
    content: string
    contentType: string
  }>
  metadata?: Record<string, string>
  messageStream?: string
}
```

### EmailTemplate

```tsx
interface EmailTemplate {
  alias: string
  subject: string
  htmlBody: string
  textBody?: string
  from: string
  replyTo?: string
}
```

## Error Handling

The service implements comprehensive error handling:

1. Input Validation
   - All inputs are validated using Zod schemas
   - Invalid data throws descriptive errors

2. Queue Processing
   - Failed sends are automatically retried
   - Permanent failures are logged
   - Queue processing errors don't crash the service

3. Monitoring
   - Queue statistics are available in real-time
   - Failed sends are logged with full context
   - Processing status is tracked

## Security

The email service is designed with security in mind:

1. HIPAA Compliance
   - All emails are sent via secure channels
   - PII is handled according to regulations
   - Audit trails are maintained

2. Data Validation
   - All inputs are strictly validated
   - Email addresses are verified
   - Templates are sanitized

3. Error Protection
   - Rate limiting is enforced
   - Retry limits prevent abuse
   - Error details are sanitized

## Best Practices

1. Template Usage
   - Use templates for all emails
   - Include both HTML and text versions
   - Test templates before deployment

2. Queue Management
   - Monitor queue length regularly
   - Set up alerts for queue buildup
   - Regularly check failed emails

3. Error Handling
   - Log all failures appropriately
   - Monitor retry patterns
   - Alert on high failure rates

## Testing

The email service includes comprehensive tests:

```bash
pnpm test src/lib/services/email/__tests__
```

Tests cover:

- Email queueing
- Template management
- Queue processing
- Error handling
- Retry logic

## Monitoring

Monitor the email service using:

1. Queue Statistics

   ```tsx
   const stats = await emailService.getQueueStats()
   ```

2. Logs
   - Info level: Successful operations
   - Warn level: Retryable failures
   - Error level: Permanent failures

3. Metrics
   - Queue length
   - Processing time
   - Failure rates
   - Retry counts

## Troubleshooting

Common issues and solutions:

1. Emails not sending
   - Check queue statistics
   - Verify Postmark credentials
   - Check for rate limiting

2. High failure rates
   - Review error logs
   - Check template validity
   - Verify email addresses

3. Queue buildup
   - Check processing speed
   - Verify Redis connection
   - Monitor system resources
