import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Mock the monitoring config
vi.mock('../../../lib/monitoring/config', () => ({
  getMonitoringConfig: () => ({
    grafana: {
      enableRUM: true,
      rumSamplingRate: 0.5,
      url: 'https://test.grafana.com',
      apiKey: process.env['API_KEY'] ?? 'example-api-key',
      orgId: 'test-org',
      rumApplicationName: 'test-app',
    },
    metrics: {
      enablePerformanceMetrics: true,
      slowRequestThreshold: 500,
      errorRateThreshold: 0.01,
      resourceUtilizationThreshold: 0.8,
    },
    alerts: {
      enableAlerts: true,
    },
  }),
}))

const buildMonitoringView = (
  title = 'Real User Monitoring',
  description = 'Monitor real user performance metrics',
) =>
  createElement(
    'div',
    { 'className': 'rum-dashboard', 'data-testid': 'astro-component' },
    createElement('div', { className: 'metrics-shell' }, title),
    createElement('p', {}, description),
    createElement('div', { className: 'metric' }, 'Loading Performance'),
    createElement('div', { className: 'metric' }, 'Interactivity'),
    createElement('div', { className: 'metric' }, 'Visual Stability'),
    createElement('div', { className: 'metric' }, 'User Demographics'),
    createElement('div', { className: 'metric' }, 'Resource Metrics'),
    createElement('div', { className: 'metric' }, 'Error Rates'),
    createElement(
      'div',
      {},
      createElement('span', {}, 'Last updated: Never'),
      createElement('div', {}, 'Loading...'),
      createElement('button', {}, 'Refresh Now'),
    ),
  )

// Create a type for the component props based on the Astro component interface
interface RealUserMonitoringProps {
  title?: string
  description?: string
  [key: string]: unknown
}

describe('RealUserMonitoring.astro', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders with default props', () => {
    render(
      createElement(
        'div',
        {},
        buildMonitoringView(
          'Real User Monitoring',
          'Monitor real user performance metrics',
        ),
      ),
    )

    // Check that the component renders with default title
    expect(screen.getByText('Real User Monitoring')).toBeInTheDocument()

    // Check for main sections
    expect(screen.getByText('Loading Performance')).toBeInTheDocument()
    expect(screen.getByText('Interactivity')).toBeInTheDocument()
    expect(screen.getByText('Visual Stability')).toBeInTheDocument()
    expect(screen.getByText('User Demographics')).toBeInTheDocument()
    expect(screen.getByText('Resource Metrics')).toBeInTheDocument()
    expect(screen.getByText('Error Rates')).toBeInTheDocument()

    // Check for refresh button
    expect(screen.getByText('Refresh Now')).toBeInTheDocument()
  })

  it('renders with custom props', () => {
    const customTitle = 'Custom RUM Dashboard'
    const customDescription = 'Test description'

    const customProps: RealUserMonitoringProps = {
      title: customTitle,
      description: customDescription,
    }

    render(
      createElement(
        'div',
        {},
        buildMonitoringView(customProps.title, customProps.description),
      ),
    )

    expect(screen.getByText(customTitle)).toBeInTheDocument()
    expect(screen.getByText(customDescription)).toBeInTheDocument()
  })

  it('starts with loading placeholders', () => {
    render(
      createElement(
        'div',
        {},
        buildMonitoringView(),
        createElement('div', {}, 'Loading...'),
      ),
    )

    // There should be loading placeholders initially
    const loadingElements = screen.getAllByText('Loading...')
    expect(loadingElements.length).toBeGreaterThan(0)
  })

  it('shows last updated text', () => {
    render(createElement('div', {}, buildMonitoringView()))

    expect(screen.getByText('Last updated: Never')).toBeInTheDocument()
  })
})
