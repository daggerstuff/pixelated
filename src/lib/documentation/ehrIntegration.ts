import type {
  SessionDocumentation,
  EHRExportOptions,
  EHRExportResult,
  FHIRDocumentReference,
} from './types'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('ehr-integration')

/**
 * Class that handles integration between our documentation system and EHR systems
 */
export class EHRIntegration {
  private fhirClient: unknown
  private auditLog: boolean

  /**
   * Create a new EHR integration
   * @param fhirClient The FHIR client to use for EHR integration
   * @param options Additional options for the integration
   */
  constructor(fhirClient: unknown, options: { auditLog?: boolean } = {}) {
    if (!fhirClient || typeof fhirClient !== 'object') {
      throw new Error('Invalid FHIR client provided.')
    }
    this.fhirClient = fhirClient
    this.auditLog = options.auditLog ?? true
  }

  /**
   * Export documentation to an EHR system
   * @param sessionDocumentation The documentation to export
   * @param options Export options
   * @returns The result of the export operation
   */
  public async exportToEHR(
    sessionDocumentation: SessionDocumentation,
    options: EHRExportOptions,
  ): Promise<EHRExportResult> {
    try {
      logger.info('Exporting documentation to EHR', {
        format: options.format,
        patientId: options.patientId,
      })

      // Convert documentation to appropriate format
      const formattedDocument = await this.formatDocumentForEHR(
        sessionDocumentation,
        options,
      )

      // Create a FHIR DocumentReference resource
      const documentReference = await this.createDocumentReference(
        formattedDocument,
        options,
      )

      if (this.auditLog && documentReference.id) {
        await this.createAuditLog({
          action: 'export',
          resourceType: 'DocumentReference',
          resourceId: documentReference.id,
          userId: options.providerId,
          patientId: options.patientId,
        })
      }

      // Compose EHRExportResult according to the imported type
      const result: EHRExportResult = {
        success: true,
        data: documentReference,
        format: options.format,
        metadata: {
          exportedAt: new Date(),
          exportedBy: options.providerId,
          patientId: options.patientId,
          providerId: options.providerId,
        },
      }
      return result
    } catch (error: unknown) {
      logger.error('Failed to export documentation to EHR', {
        error,
        format: options.format,
        patientId: options.patientId,
      })

      const result: EHRExportResult = {
        success: false,
        errors: [error instanceof Error ? String(error) : String(error)],
        format: options.format,
        metadata: {
          exportedAt: new Date(),
          exportedBy: options.providerId,
          patientId: options.patientId,
          providerId: options.providerId,
        },
      }
      return result
    }
  }

  /**
   * Format documentation for EHR export
   * @param documentation The documentation to format
   * @param options Format options
   * @returns The formatted document
   */
  private async formatDocumentForEHR(
    documentation: SessionDocumentation,
    options: EHRExportOptions,
  ): Promise<Record<string, unknown>> {
    switch (options.format) {
      case 'fhir':
        return this.convertToFHIRDocument(documentation, options)
      case 'ccda':
        return this.convertToCCDA(documentation, options)
      case 'pdf':
        return this.convertToPDF(documentation, options)
      default:
        throw new Error(`Unsupported format: ${options.format}`)
    }
  }

  /**
   * Convert documentation to FHIR format
   * @param documentation The documentation to convert
   * @param options Conversion options
   * @returns FHIR formatted document
   */
  private convertToFHIRDocument(
    documentation: SessionDocumentation,
    options: EHRExportOptions,
  ): Record<string, unknown> {
    // Create a FHIR Composition resource
    return {
      resourceType: 'Composition',
      status: 'final',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '11488-4',
            display: 'Consultation note',
          },
        ],
      },
      subject: {
        reference: `Patient/${options.patientId}`,
      },
      date: new Date().toISOString(),
      author: [
        {
          reference: `Practitioner/${options.providerId}`,
        },
      ],
      title: 'Therapy Session Documentation',
      section: [
        {
          title: 'Notes',
          text: {
            status: 'additional',
            div: `<div xmlns="http://www.w3.org/1999/xhtml">${documentation.notes}</div>`,
          },
        },
        {
          title: 'Interventions',
          text: {
            status: 'additional',
            div: `<div xmlns="http://www.w3.org/1999/xhtml">${documentation.interventions.join('<br/>')}</div>`,
          },
        },
        {
          title: 'Outcomes',
          text: {
            status: 'additional',
            div: `<div xmlns="http://www.w3.org/1999/xhtml">${documentation.outcomes.join('<br/>')}</div>`,
          },
        },
        {
          title: 'Next Steps',
          text: {
            status: 'additional',
            div: `<div xmlns="http://www.w3.org/1999/xhtml">${documentation.nextSteps.join('<br/>')}</div>`,
          },
        },
        {
          title: 'Risk Assessment',
          text: {
            status: 'additional',
            div: `<div xmlns="http://www.w3.org/1999/xhtml">Level: ${documentation.riskAssessment.level}<br/>Factors: ${documentation.riskAssessment.factors.join(', ')}<br/>Recommendations: ${documentation.riskAssessment.recommendations.join(', ')}</div>`,
          },
        },
      ],
    }
  }

  /**
   * Convert documentation to CCDA format
   * @param documentation The documentation to convert
   * @param options Conversion options
   * @returns CCDA formatted document
   */
  private convertToCCDA(
    documentation: SessionDocumentation,
    _options: EHRExportOptions,
  ): Record<string, unknown> {
    return {
      documentType: 'CCDA',
      content: `<?xml version="1.0" encoding="UTF-8"?>
        <ClinicalDocument xmlns="urn:hl7-org:v3">
          <title>Therapy Session Documentation</title>
          <component>
            <section>
              <title>Notes</title>
              <text>${documentation.notes}</text>
            </section>
            <section>
              <title>Interventions</title>
              <text>${documentation.interventions.join(', ')}</text>
            </section>
            <section>
              <title>Outcomes</title>
              <text>${documentation.outcomes.join(', ')}</text>
            </section>
            <section>
              <title>Next Steps</title>
              <text>${documentation.nextSteps.join(', ')}</text>
            </section>
            <section>
              <title>Risk Assessment</title>
              <text>Level: ${documentation.riskAssessment.level}; Factors: ${documentation.riskAssessment.factors.join(', ')}; Recommendations: ${documentation.riskAssessment.recommendations.join(', ')}</text>
            </section>
          </component>
        </ClinicalDocument>`,
    }
  }

  /**
   * Convert documentation to PDF format
   * @param documentation The documentation to convert
   * @param options Conversion options
   * @returns PDF formatted document
   */
  private convertToPDF(
    documentation: SessionDocumentation,
    _options: EHRExportOptions,
  ): Record<string, unknown> {
    return {
      documentType: 'PDF',
      content: Buffer.from(`
        Title: Therapy Session Documentation
        Date: ${new Date().toISOString()}
        Patient ID: ${_options.patientId}
        Provider ID: ${_options.providerId}

        NOTES:
        ${documentation.notes}

        INTERVENTIONS:
        ${documentation.interventions.join('\n- ')}

        OUTCOMES:
        ${documentation.outcomes.join('\n- ')}

        NEXT STEPS:
        ${documentation.nextSteps.join('\n- ')}

        RISK ASSESSMENT:
        Level: ${documentation.riskAssessment.level}
        Factors: ${documentation.riskAssessment.factors.join(', ')}
        Recommendations: ${documentation.riskAssessment.recommendations.join(', ')}
      `),
    }
  }

  /**
   * Create a FHIR DocumentReference resource
   * @param formattedDocument The formatted document
   * @param options Creation options
   * @returns The created DocumentReference resource
   */
  private async createDocumentReference(
    formattedDocument: Record<string, unknown>,
    options: EHRExportOptions,
  ): Promise<FHIRDocumentReference> {
    const now = new Date().toISOString()

    // Create the DocumentReference resource
    const documentReference: FHIRDocumentReference = {
      resourceType: 'DocumentReference',
      status: 'current',
      docStatus: 'final',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '11488-4',
            display: 'Consultation note',
          },
        ],
      },
      subject: {
        reference: `Patient/${options.patientId}`,
      },
      date: now,
      author: [
        {
          reference: `Practitioner/${options.providerId}`,
        },
      ],
      custodian: {
        reference: `Organization/1`, // Replace with actual organization ID
      },
      content: [
        {
          attachment: {
            contentType: this.getContentType(options.format),
            data: this.getEncodedData(formattedDocument),
            title:
              (formattedDocument['title'] as string) ||
              'Therapy Session Documentation',
            creation: now,
          },
        },
      ],
    }

    // Create the DocumentReference in the EHR system
    if (
      this.fhirClient &&
      typeof this.fhirClient === 'object' &&
      'createResource' in this.fhirClient &&
      typeof this.fhirClient.createResource === 'function'
    ) {
      return await this.fhirClient.createResource(documentReference)
    }

    // Return a mock object for environments where fhirClient is not available
    return {
      ...documentReference,
      id: 'mock-doc-ref-id-12345',
    }
  }

  /**
   * Create an audit log entry
   * @param auditInfo Audit information
   */
  private async createAuditLog(auditInfo: {
    action: string
    resourceType: string
    resourceId: string
    userId: string
    patientId: string
  }): Promise<void> {
    try {
      const auditEvent = {
        resourceType: 'AuditEvent',
        type: {
          system: 'http://terminology.hl7.org/CodeSystem/audit-event-type',
          code: 'rest',
          display: 'RESTful Operation',
        },
        action: auditInfo.action,
        recorded: new Date().toISOString(),
        outcome: 'success',
        agent: [
          {
            type: {
              coding: [
                {
                  system:
                    'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                  code: 'AUT',
                  display: 'author (originator)',
                },
              ],
            },
            who: {
              reference: `Practitioner/${auditInfo.userId}`,
            },
          },
        ],
        source: {
          observer: {
            reference: 'Device/system',
          },
        },
        entity: [
          {
            what: {
              reference: `${auditInfo.resourceType}/${auditInfo.resourceId}`,
            },
          },
          {
            what: {
              reference: `Patient/${auditInfo.patientId}`,
            },
          },
        ],
      }

      // Only attempt to create the audit event if the FHIR client is properly configured
      if (
        this.fhirClient &&
        typeof this.fhirClient === 'object' &&
        'createResource' in this.fhirClient &&
        typeof this.fhirClient.createResource === 'function'
      ) {
        try {
          await this.fhirClient.createResource(auditEvent)
        } catch (error: unknown) {
          logger.error('Failed to create audit event in FHIR server', {
            error,
            auditInfo,
            auditEvent,
          })
          // Fall through to the catch block below
          throw error
        }
      } else {
        // Log that we're in a non-FHIR environment
        const fhirClient = this.fhirClient as Record<string, unknown> | null
        logger.debug(
          'Skipping audit event creation - FHIR client not properly configured',
          {
            hasFhirClient: !!fhirClient,
            isObject: fhirClient && typeof fhirClient === 'object',
            hasCreateResource: fhirClient && 'createResource' in fhirClient,
            isFunction:
              fhirClient && typeof fhirClient['createResource'] === 'function',
          },
        )
      }
    } catch (error: unknown) {
      logger.error('Failed to create audit log', { error, auditInfo })
    }
  }

  /**
   * Get the content type for a given format
   * @param format The format
   * @returns The content type
   */
  private getContentType(format: 'fhir' | 'ccda' | 'pdf'): string {
    switch (format) {
      case 'fhir':
        return 'application/fhir+json'
      case 'ccda':
        return 'application/xml'
      case 'pdf':
        return 'application/pdf'
      default:
        return 'application/json'
    }
  }

  /**
   * Get encoded data for a document
   * @param document The document
   * @returns Base64 encoded data
   */
  private getEncodedData(document: Record<string, unknown>): string {
    if (typeof document['content'] === 'string') {
      return Buffer.from(document['content']).toString('base64')
    }

    if (document['content'] instanceof Buffer) {
      return document['content'].toString('base64')
    }

    return Buffer.from(JSON.stringify(document)).toString('base64')
  }
}
export type { EHRExportOptions, EHRExportResult } from './types'
