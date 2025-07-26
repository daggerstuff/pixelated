import { screen, waitFor } from '@testing-library/react'
import SystemHealth from '../system-health.astro'

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
          supabase: {
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

// Comment out as we're removing the axe imports
// expect.extend(toHaveNoViolations)

// Helper function to render Astro components in tests
async function renderAstroComponent(Component: any) {
  const html = await Component.render()
  const container = document.createElement('div')
  container.innerHTML = html.html
  document.body.appendChild(container)
  return { container }
}

describe('System Health Dashboard Page', () => {
  it('renders the page title', async () => {
    await renderAstroComponent(SystemHealth)

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
    await renderAstroComponent(SystemHealth)

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
            supabase: {
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

    await renderAstroComponent(SystemHealth)

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
