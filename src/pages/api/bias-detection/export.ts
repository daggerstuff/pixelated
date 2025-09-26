import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('BiasExportAPI')

export const GET = async ({ request }: { request: Request }): Promise<Response> => {
  const startTime = Date.now()
  
  try {
    // Parse URL parameters
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'json'
    const timeRange = url.searchParams.get('timeRange') || '24h'
    const includeDetails = url.searchParams.get('includeDetails') === 'true'

    // Log export request
    logger.info('Exporting bias detection data', {
      format,
      timeRange,
      includeDetails,
    })

    // Return mock export data
    const mockExportData = {
      exportMetadata: {
        timestamp: new Date().toISOString(),
        format,
        timeRange,
        includeDetails,
        recordCount: 150,
        version: '1.0.0',
      },
      sessions: [
        {
          sessionId: 'session-123',
          timestamp: '2024-01-15T09:30:00.000Z',
          biasScore: 0.75,
          alertLevel: 'high',
          participantDemographics: {
            gender: 'female',
            age: 28,
            ethnicity: 'hispanic',
          },
          scenario: 'therapeutic-session-1',
        },
        {
          sessionId: 'session-124',
          timestamp: '2024-01-15T08:45:00.000Z',
          biasScore: 0.45,
          alertLevel: 'medium',
          participantDemographics: {
            gender: 'male',
            age: 35,
            ethnicity: 'white',
          },
          scenario: 'therapeutic-session-2',
        },
      ],
      alerts: [
        {
          id: 'alert-1',
          sessionId: 'session-123',
          timestamp: '2024-01-15T09:30:00.000Z',
          level: 'high',
          message: 'High bias detected in therapeutic session',
          acknowledged: false,
        },
      ],
      summary: {
        totalSessions: 150,
        averageBiasScore: 0.35,
        alertsLast24h: 8,
        totalAlerts: 12,
      },
    }

    const processingTime = Math.max(Date.now() - startTime, 1)

    // Handle different formats
    if (format === 'csv') {
      const csvData = convertToCSV(mockExportData)
      return new Response(csvData, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="bias-detection-export.csv"',
        },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      data: mockExportData,
      processingTime,
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error: unknown) {
    logger.error('Export failed', { error })

    const processingTime = Math.max(Date.now() - startTime, 1)

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Export Failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    )
  }
}

function convertToCSV(data: any): string {
  const sessions = data.sessions || []
  const headers = ['sessionId', 'timestamp', 'biasScore', 'alertLevel', 'gender', 'age', 'ethnicity', 'scenario']
  
  const csvRows = [
    headers.join(','),
    ...sessions.map((session: any) => [
      session.sessionId,
      session.timestamp,
      session.biasScore,
      session.alertLevel,
      session.participantDemographics?.gender || '',
      session.participantDemographics?.age || '',
      session.participantDemographics?.ethnicity || '',
      session.scenario || '',
    ].join(','))
  ]
  
  return csvRows.join('\n')
}
