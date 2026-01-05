import type { BaaTemplate, BaaDocument, BusinessAssociate } from './types'
import { generateId } from '../../utils/ids'

/**
 * Service for generating BAA documents from templates
 */
export class BaaDocumentGenerator {
  /**
   * Generate a new BAA document from a template
   */
  public generateDocument(
    template: BaaTemplate,
    businessAssociate: BusinessAssociate,
    placeholderValues: Record<string, string>,
    createdBy: string,
    effectiveDate?: Date,
    expirationDate?: Date,
  ): BaaDocument {
    // Check if all required placeholders have values
    this.validatePlaceholderValues(template, placeholderValues)

    // Create a new BAA document
    const document: BaaDocument = {
      id: generateId(),
      templateId: template.id,
      businessAssociateId: businessAssociate.id,
      name: `BAA - ${businessAssociate.name} - ${new Date().toISOString().split('T')[0]}`,
      effectiveDate,
      expirationDate,
      status: BaaStatus.DRAFT,
      createdDate: new Date(),
      lastModifiedDate: new Date(),
      createdBy,
      lastModifiedBy: createdBy,
      filledPlaceholders: placeholderValues,
      includedSectionIds: template.sections
        .filter((section) => section.required)
        .map((section) => section.id),
      auditTrail: [
        {
          id: generateId(),
          documentId: '', // Will be set below
          eventType: 'created',
          timestamp: new Date(),
          userId: createdBy,
          details: `Document created from template "${template.name}"`,
        },
      ],
    }

    // Set the documentId in auditTrail
    document.auditTrail[0].documentId = document.id

    return document
  }

  /**
   * Render a BAA document to HTML
   */
  public renderToHtml(document: BaaDocument, template: BaaTemplate): string {
    let html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${document.name}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          h1 {
            text-align: center;
            margin-bottom: 30px;
          }
          h2 {
            margin-top: 20px;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #ddd;
          }
          .signature-block {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
          }
          .signature {
            width: 45%;
          }
          .signature-line {
            border-top: 1px solid #000;
            margin-top: 40px;
            margin-bottom: 10px;
          }
          .date {
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <h1>BUSINESS ASSOCIATE AGREEMENT</h1>
    `

    // Add sections
    template.sections
      .filter((section) => document.includedSectionIds.includes(section.id))
      .sort((a, b) => a.order - b.order)
      .forEach((section) => {
        let sectionContent = section.content

        // Replace placeholders in the section content
        Object.entries(document.filledPlaceholders).forEach(([key, value]) => {
          const placeholder = `{{${key}}}`
          sectionContent = sectionContent.replace(
            new RegExp(placeholder, 'g'),
            value,
          )
        })

        html += `
          <h2>${section.title}</h2>
          <div>${this.convertMarkdownToHtml(sectionContent)}</div>
        `
      })

    // Add signature blocks
    html += `
        <div class="signature-block">
          <div class="signature">
            <h3>FOR COVERED ENTITY:</h3>
            <div class="signature-line"></div>
            <div>Authorized Signature</div>
            <div class="date">Date: _________________</div>
            <div>Name: _________________</div>
            <div>Title: _________________</div>
          </div>
          <div class="signature">
            <h3>FOR BUSINESS ASSOCIATE:</h3>
            <div class="signature-line"></div>
            <div>Authorized Signature</div>
            <div class="date">Date: _________________</div>
            <div>Name: _________________</div>
            <div>Title: _________________</div>
          </div>
        </div>
      </body>
      </html>
    `

    return html
  }

  /**
   * Convert simple markdown to HTML
   * Note: This is a basic implementation supporting only basic formatting
   */
  private convertMarkdownToHtml(markdown: string): string {
    let html = markdown

    // Convert line breaks to <br> tags
    html = html.replace(/\n\n/g, '</p><p>')

    // Convert bold text
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')

    // Convert italic text
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')

    // Wrap in paragraph tags if not already wrapped
    if (!html.startsWith('<p>')) {
      html = `<p>${html}</p>`
    }

    return html
  }

  /**
   * Validate that all required placeholders have values
   */
  private validatePlaceholderValues(
    template: BaaTemplate,
    placeholderValues: Record<string, string>,
  ): void {
    const missingPlaceholders = template.placeholders
      .filter((p) => p.required && !placeholderValues[p.key])
      .map((p) => p.key)

    if (missingPlaceholders.length > 0) {
      throw new Error(
        `Missing required placeholder values: ${missingPlaceholders.join(', ')}`,
      )
    }
  }

  /**
   * Create a JSON representation of the document
   */
  public exportToJson(document: BaaDocument, template: BaaTemplate): string {
    const exportData = {
      document: {
        ...document,
        templateName: template.name,
        templateVersion: template.version,
      },
      sections: template.sections
        .filter((section) => document.includedSectionIds.includes(section.id))
        .sort((a, b) => a.order - b.order)
        .map((section) => {
          let { content } = section

          // Replace placeholders in the content
          Object.entries(document.filledPlaceholders).forEach(
            ([key, value]) => {
              const placeholder = `{{${key}}}`
              content = content.replace(new RegExp(placeholder, 'g'), value)
            },
          )

          return {
            id: section.id,
            title: section.title,
            content,
            order: section.order,
          }
        }),
    }

    return JSON.stringify(exportData, null, 2)
  }
}
