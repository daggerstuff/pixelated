import React from 'react'

/**
 * Interface for props passed to the mock Astro component
 */
interface MockAstroComponentProps {
  title?: string
  description?: string
  [key: string]: unknown
}

/**
 * Mock component factory for Astro components in tests
 *
 * @param _componentPath Path to the Astro component (unused)
 * @returns React component that can be used in tests
 */
export function compileAstroComponent(
  _componentPath: string,
): React.FC<MockAstroComponentProps> {
  // Simple mock component that renders the main UI elements
  // This is a simplified approach for testing
  const MockAstroComponent: React.FC<MockAstroComponentProps> = (props) => {
    return React.createElement(
      'div',
      { 'data-testid': 'astro-component', 'className': 'rum-dashboard' },
      props.title && React.createElement('h2', {}, props.title),
      props.description && React.createElement('p', {}, props.description),
      React.createElement(
        'div',
        { className: 'metrics-container' },
        React.createElement(
          'div',
          { className: 'grid' },
          React.createElement(
            'div',
            { className: 'metric-card' },
            React.createElement('h3', {}, 'Loading Performance'),
            React.createElement(
              'div',
              { id: 'loading-metrics' },
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'TTFB:'),
                React.createElement('span', {}, 'Loading...'),
              ),
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'FCP:'),
                React.createElement('span', {}, 'Loading...'),
              ),
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'LCP:'),
                React.createElement('span', {}, 'Loading...'),
              ),
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'Speed Index:'),
                React.createElement('span', {}, 'Loading...'),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'metric-card' },
            React.createElement('h3', {}, 'Interactivity'),
            React.createElement(
              'div',
              { id: 'interactivity-metrics' },
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'FID:'),
                React.createElement('span', {}, 'Loading...'),
              ),
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'TBT:'),
                React.createElement('span', {}, 'Loading...'),
              ),
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'TTI:'),
                React.createElement('span', {}, 'Loading...'),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'metric-card' },
            React.createElement('h3', {}, 'Visual Stability'),
            React.createElement(
              'div',
              { id: 'stability-metrics' },
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'CLS:'),
                React.createElement('span', {}, 'Loading...'),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'metric-card' },
            React.createElement('h3', {}, 'User Demographics'),
            React.createElement(
              'div',
              { id: 'demographics-metrics' },
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'Devices:'),
                React.createElement('span', {}, 'Loading...'),
              ),
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'Browsers:'),
                React.createElement('span', {}, 'Loading...'),
              ),
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'Countries:'),
                React.createElement('span', {}, 'Loading...'),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'metric-card' },
            React.createElement('h3', {}, 'Resource Metrics'),
            React.createElement(
              'div',
              { id: 'resource-metrics' },
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'JS Size:'),
                React.createElement('span', {}, 'Loading...'),
              ),
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'CSS Size:'),
                React.createElement('span', {}, 'Loading...'),
              ),
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'Requests:'),
                React.createElement('span', {}, 'Loading...'),
              ),
            ),
          ),
          React.createElement(
            'div',
            { className: 'metric-card' },
            React.createElement('h3', {}, 'Error Rates'),
            React.createElement(
              'div',
              { id: 'error-metrics' },
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'JS Errors:'),
                React.createElement('span', {}, 'Loading...'),
              ),
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, 'API Errors:'),
                React.createElement('span', {}, 'Loading...'),
              ),
              React.createElement(
                'div',
                {},
                React.createElement('span', {}, '404s:'),
                React.createElement('span', {}, 'Loading...'),
              ),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'mt-6' },
          React.createElement(
            'span',
            { id: 'last-updated' },
            'Last updated: Never',
          ),
          React.createElement('button', { id: 'refresh-btn' }, 'Refresh Now'),
        ),
      ),
    )
  }

  return MockAstroComponent
}
