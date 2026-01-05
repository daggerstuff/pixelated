---
title: "Real User Monitoring (RUM) Documentation"
description: "Real User Monitoring (RUM) Documentation documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Real User Monitoring (RUM) Documentation

This guide provides information about our Real User Monitoring (RUM) implementation, how to use it, and how to interpret the data.

## Overview

Real User Monitoring collects performance data from actual users of our application. Unlike synthetic testing, RUM provides insights into real-world experiences across different devices, network conditions, geographic locations, and browsers.

Our RUM implementation uses the Grafana Faro Web SDK to collect and visualize real user metrics.

## Key Metrics Collected

### Loading Performance

- **Time to First Byte (TTFB)**: Time from request to first byte of response
- **First Contentful Paint (FCP)**: Time until first content is rendered
- **Largest Contentful Paint (LCP)**: Time until largest content element is rendered
- **Speed Index**: How quickly content is visually displayed

### Interactivity

- **First Input Delay (FID)**: Time from user interaction to response
- **Total Blocking Time (TBT)**: Sum of time when main thread is blocked
- **Time to Interactive (TTI)**: Time until page is fully interactive

### Visual Stability

- **Cumulative Layout Shift (CLS)**: Measures visual stability and unexpected layout shifts

### Resource Metrics

- **JavaScript bundle size**: Total size of JS assets
- **CSS size**: Total size of CSS assets
- **Request count**: Number of HTTP requests made

### User Demographics

- Device types
- Browsers
- Geographic locations

### Error Rates

- JavaScript errors
- API errors
- 404 errors

## Implementation Details

Our RUM implementation consists of several components:

1. **Monitoring Service**: Core service that initializes monitoring (`src/lib/monitoring/service.ts`)
2. **Monitoring Component**: Astro component that loads the monitoring service (`src/components/Monitoring.astro`)
3. **RUM Dashboard**: Interactive dashboard for viewing metrics (`src/components/monitoring/RealUserMonitoring.astro`)
4. **React Hooks**: Hooks for accessing RUM data in React components (`src/lib/monitoring/hooks.ts`)

## Configuration

RUM configuration is defined in `src/lib/monitoring/config.ts`. The key settings are:

```typescript
const defaultConfig: MonitoringConfig = {
  grafana: {
    url: process.env.GRAFANA_URL || 'https://grafana.pixelatedempathy.com',
    apiKey: process.env.GRAFANA_API_KEY || '',
    orgId: process.env.GRAFANA_ORG_ID || '',
    enableRUM: true,
    rumApplicationName: 'gradiant-astro',
    rumSamplingRate: 1.0, // 100% sampling in production
  },
  metrics: {
    enablePerformanceMetrics: true,
    slowRequestThreshold: 500, // ms
    errorRateThreshold: 0.01, // 1%
    resourceUtilizationThreshold: 0.8, // 80%
  },
  alerts: {
    enableAlerts: true,
    slackWebhookUrl: process.env.SLACK_WEBHOOK,
    emailRecipients: process.env.MONITORING_EMAIL_RECIPIENTS?.split(','),
  },
}
```

### Environment Variables

To configure RUM, set the following environment variables:

- `GRAFANA_URL`: URL of your Grafana instance
- `GRAFANA_API_KEY`: API key for Grafana (required for RUM)
- `GRAFANA_ORG_ID`: Organization ID in Grafana
- `SLACK_WEBHOOK`: Webhook URL for Slack alerts
- `MONITORING_EMAIL_RECIPIENTS`: Comma-separated list of email recipients for alerts

## Using the Real User Monitoring Dashboard

The RUM dashboard is available at `/admin/real-user-monitoring` and provides a visual representation of all collected metrics.

### Access

The dashboard is accessible to administrators and is found in the Admin Dashboard under the Monitoring section.

### Reading the Dashboard

Metrics are color-coded based on our performance budgets:

- **Green**: Good - Meeting performance targets
- **Yellow**: Needs Improvement - Under acceptable limits but could be better
- **Red**: Poor - Exceeding acceptable limits, requires attention

### Refreshing Data

The dashboard automatically refreshes every 30 seconds. You can manually refresh the data by clicking the "Refresh Now" button.

## Using RUM in React Components

To access RUM data in React components, use the provided hooks:

```tsx
import { useMonitoring, useRUMData } from '../lib/monitoring/hooks';

function MyComponent() {
  // Get monitoring utilities
  const { trackEvent, trackError, trackMetric, 
          trackUserInteraction, trackPageView } = useMonitoring();
  
  // Access RUM data
  const { 
    loadingPerformance, 
    interactivityMetrics, 
    visualStability,
    isLoading, 
    lastUpdated, 
    refreshData 
  } = useRUMData();
  
  // Track custom event
  const handleClick = () => {
    trackUserInteraction('button', 'click', { buttonId: 'my-button' });
    // Your component logic here
  };
  
  return (
    <div>
      <h2>Performance Metrics</h2>
      {isLoading ? (
        <p>Loading metrics...</p>
      ) : (
        <div>
          <p>TTFB: {loadingPerformance.ttfb}ms</p>
          <p>FCP: {loadingPerformance.fcp}ms</p>
          <p>LCP: {loadingPerformance.lcp}ms</p>
          <p>CLS: {visualStability.cls}</p>
        </div>
      )}
      <button onClick={handleClick}>Track Interaction</button>
    </div>
  );
}
```

## Performance Budgets

We've established the following performance budgets:

| Metric | Target (Good) | Maximum (Acceptable) |
|--------|---------------|----------------------|
| TTFB   | < 300ms       | < 600ms              |
| FCP    | < 1.8s        | < 3s                 |
| LCP    | < 2.5s        | < 4s                 |
| CLS    | < 0.1         | < 0.25               |
| TBT    | < 200ms       | < 600ms              |
| FID    | < 100ms       | < 300ms              |
| JS Size| < 500KB       | < 1MB                |
| CSS Size| < 100KB      | < 200KB              |
| Requests| < 50         | < 80                 |

## Troubleshooting

### Common Issues

1. **No data appears in the dashboard**
   - Check that the Grafana Faro Web SDK is loaded correctly
   - Verify that your API key and organization ID are correct
   - Check browser console for any JavaScript errors

2. **Metrics are not updating**
   - The refresh interval may be too long
   - Check network connectivity
   - Verify that the monitoring service is initialized

3. **Performance metrics seem inaccurate**
   - Check sampling rate configuration
   - Verify that the performance observers are initialized correctly
   - Check for any browser extensions or proxies that may affect performance

### Debug Mode

To enable debug mode for more detailed logging:

```typescript
// In your development environment
window.localStorage.setItem('rum-debug', 'true');
```

## Future Enhancements

Planned improvements to our RUM implementation:

1. **Custom event tracking**: Enable tracking of business-specific events
2. **User journey tracking**: Map user flows and identify bottlenecks
3. **Advanced alerting**: Set up proactive alerts based on RUM data
4. **Integration with CI/CD**: Block deployments if performance metrics degrade
5. **Expanded demographics**: More detailed user segmentation by device type, browser version
6. **Historical trends**: View performance changes over time
