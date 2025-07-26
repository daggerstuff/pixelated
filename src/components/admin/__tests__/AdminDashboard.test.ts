import AdminDashboard from '../AdminDashboard.astro'
import { renderAstro } from '@/test/utils/astro'
import { getSystemMetrics } from '@/lib/api/admin'

// Mock dependencies
vi.mock('@/lib/api/admin', () => ({
  getSystemMetrics: vi.fn(),
}))

vi.mock('@/lib/logging/build-safe-logger', () => ({
  createBuildSafeLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}))

describe('AdminDashboard', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.clearAllMocks()
  })

  it('renders with default metrics when API call fails', async () => {
    // Mock API error
    vi.mocked(getSystemMetrics).mockRejectedValueOnce(new Error('API Error'))

    const { querySelector } = await renderAstro(AdminDashboard as any)

    // Check error logging
    const { createBuildSafeLogger } = await import(
      '@/lib/logging/build-safe-logger'
    )
    expect(createBuildSafeLogger).toHaveBeenCalledWith('admin-dashboard')

    // Check default values are displayed
    expect(querySelector('#active-users-value')).toHaveTextContent('0')
    expect(querySelector('#active-sessions-value')).toHaveTextContent('0')
    expect(querySelector('#avg-response-time-value')).toHaveTextContent('0ms')
    expect(querySelector('#system-load-value')).toHaveTextContent('0%')
    expect(querySelector('#storage-used-value')).toHaveTextContent('0GB')
    expect(querySelector('#messages-sent-value')).toHaveTextContent('0')
  })

  it('renders with metrics from API', async () => {
    // Mock successful API response
    const mockMetrics = {
      activeUsers: 100,
      activeSessions: 50,
      sessionsToday: 150,
      totalTherapists: 20,
      totalClients: 80,
      messagesSent: 1000,
      avgResponseTime: 250,
      systemLoad: 45,
      storageUsed: '5 GB',
      activeSecurityLevel: 'high',
    }
    vi.mocked(getSystemMetrics).mockResolvedValueOnce(mockMetrics)

    const { querySelector } = await renderAstro(AdminDashboard as any)

    // Check metrics are displayed correctly
    expect(querySelector('#active-users-value')).toHaveTextContent('100')
    expect(querySelector('#active-sessions-value')).toHaveTextContent('50')
    expect(querySelector('#avg-response-time-value')).toHaveTextContent('250ms')
    expect(querySelector('#system-load-value')).toHaveTextContent('45%')
    expect(querySelector('#storage-used-value')).toHaveTextContent('5GB')
    expect(querySelector('#messages-sent-value')).toHaveTextContent('1000')
    expect(querySelector('#security-level-value')).toHaveTextContent('high')

    // Check progress bars
    const storageBar = querySelector('#storage-bar')
    expect(storageBar).toHaveStyle({ width: '50%' }) // 5GB / 10 = 50%

    const messagesBar = querySelector('#messages-bar')
    expect(messagesBar).toHaveStyle({ width: '100%' }) // 1000 messages = 100% (capped)
  })

  it('initializes dashboard updates on mount', async () => {
    const { querySelector } = await renderAstro(AdminDashboard as any)
    // Simulate DOMContentLoaded
    const event = new Event('DOMContentLoaded')
    document.dispatchEvent(event)

    // The initDashboardUpdates function should be called
    // Note: We can't directly test this as it's in a separate module,
    // but we can verify the script tag is present
    const script = querySelector('script')
    expect(script).toContainHTML('initDashboardUpdates')
  })
})
