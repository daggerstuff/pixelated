/**
 * Email template utilities
 */

import { logger } from './logger'

/**
 * Preview an email template with the given data
 * @param templateName The name of the template to preview
 * @param data Optional data to use for template rendering
 * @returns The rendered HTML
 */
export async function previewTemplate(
  templateName: string,
  data: Record<
    string,
    string | { platform: string; url: string | undefined }[] | undefined
  > = {},
): Promise<string> {
  logger.info('Previewing email template', {
    context: 'Template',
    data: {
      templateName,
      data,
    },
  })

  try {
    // Implementation would typically load the template and render it with the data
    const renderedHtml = `<html><body><h1>Template: ${templateName}</h1><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`

    logger.debug('Template rendered successfully', {
      context: 'Template',
      data: { templateName },
    })

    return renderedHtml
  } catch (error) {
    logger.error('Failed to render template', error as Error, {
      context: 'Template',
      data: { templateName },
    })
    throw error
  }
}

/**
 * List all available email templates
 * @returns Array of template names
 */
export async function listTemplates(): Promise<string[]> {
  // Implementation would typically scan a directory for templates
  return ['welcome', 'password-reset']
}
