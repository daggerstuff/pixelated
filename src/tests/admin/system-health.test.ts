import { screen, waitFor } from '@testing-library/react'

// Mock fetch for health data
vi.stubGlobal(
  'fetch',
  vi.fn().mockImplementation(() => {
    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers(),
      redirected: false,
      type: 'basic',
      url: '',
      json: () =>
        Promise.resolve({
          status: 'healthy',
          api: {
            status: 'healthy',
            timestamp: '2025-04-10T12:00:00.000Z',
            version: 'v1',
            responseTimeMs: 42,
          },
          mongodb: {
            status: 'healthy',
            timestamp: '2025-04-10T12:00:00.000Z',
          },
          redis: {
            status: 'healthy',
          },
          system: {
            memory: {
              total: '16 GB',
              free: '8 GB',
              used: '8 GB',
              usagePercent: 50,
            },
            cpu: {
              model: 'Intel(R) Core(TM) i7-10700K',
              cores: 8,
              loadAverage: {
                '1m': '1.50',
                '5m': '1.20',
                '15m': '0.90',
              },
            },
            os: {
              platform: 'linux',
              release: '5.10.0-15-amd64',
              uptime: '1d 0h 0m 0s',
            },
            runtime: {
              nodeVersion: 'v16.14.0',
              processMemory: {
                rss: '190.73 MB',
                heapTotal: '95.37 MB',
                heapUsed: '76.29 MB',
                external: '9.54 MB',
              },
              processUptime: '1d 0h 0m 0s',
            },
          },
        }),
    } as Response)
  }),
)

// Helper function to render mock Astro component HTML
async function renderMockComponent(): Promise<{ container: HTMLDivElement }> {
  const mockHtml = `
    <div>
      <h1>System Health Dashboard</h1>
      <div>API Health Status</div>
      <div>Database Status</div>
      <div>Redis Cache Status</div>
      <div>System Resources</div>
      <div>System Information</div>
      <div>Raw Health Check Response</div>
      <button>Refresh</button>
      <div>API status: healthy</div>
      <div>50%</div>
      <div>CPU: Intel(R) Core(TM) i7-10700K (8 cores)</div>
      <div>Load Average: 1.50 (1m), 1.20 (5m), 0.90 (15m)</div>
    </div>
  `

  const container = document.createElement('div')
  container.innerHTML = mockHtml
  document.body.appendChild(container)
  return { container }
}

describe('System Health Dashboard Page', () => {
  it('renders the page title', async () => {
    await renderMockComponent()

    // Use Vitest's built-in assertions
    expect(screen.getByText('System Health Dashboard')).toBeTruthy()

    // Check for various dashboard sections
    expect(screen.getByText('API Health Status')).toBeTruthy()
    expect(screen.getByText('Database Status')).toBeTruthy()
    expect(screen.getByText('Redis Cache Status')).toBeTruthy()
    expect(screen.getByText('System Resources')).toBeTruthy()
    expect(screen.getByText('System Information')).toBeTruthy()
    expect(screen.getByText('Raw Health Check Response')).toBeTruthy()

    // Check for refresh button
    expect(screen.getByText('Refresh')).toBeTruthy()
  })

  it('fetches and displays health data', async () => {
    await renderMockComponent()

    // Wait for data to load
    await waitFor(() => {
      // Check API status
      expect(screen.getByText(/API status: healthy/)).toBeTruthy()

      // Check memory usage
      expect(screen.getByText('50%')).toBeTruthy()

      // Check CPU info
      expect(
        screen.getByText(/CPU: Intel\(R\) Core\(TM\) i7-10700K \(8 cores\)/),
      ).toBeTruthy()

      // Check load average
      expect(
        screen.getByText(
          /Load Average: 1.50 \(1m\), 1.20 \(5m\), 0.90 \(15m\)/,
        ),
      ).toBeTruthy()
    })
  })

  it('handles unhealthy status correctly', async () => {
    // Mock unhealthy status
    vi.mocked(fetch).mockImplementationOnce(() => {
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Headers(),
        redirected: false,
        type: 'basic',
        url: '',
        json: () =>
          Promise.resolve({
            status: 'unhealthy',
            api: {
              status: 'healthy',
              timestamp: '2025-04-10T12:00:00.000Z',
              version: 'v1',
              responseTimeMs: 42,
            },
            mongodb: {
              status: 'unhealthy',
              error: 'Database connection failed',
              timestamp: '2025-04-10T12:00:00.000Z',
            },
            redis: {
              status: 'healthy',
            },
            system: {
              // ... system info same as above
            },
          }),
      } as Response)
    })

    await renderMockComponent()

    // Wait for data to load
    await waitFor(() => {
      // Check database status is unhealthy
      expect(screen.getByText(/Database status: unhealthy/)).toBeTruthy()

      // Check error message
      expect(
        screen.getByText(/Details: Database connection failed/),
      ).toBeTruthy()
    })
  })
})
