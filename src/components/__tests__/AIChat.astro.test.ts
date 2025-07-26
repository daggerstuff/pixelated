import { cleanup } from '@testing-library/react'
import AIChat from '../AIChat.astro'

// Define interface for component props
interface AIChatProps {
  availableModels?: Array<{ id: string; name: string }>
  showModelSelector?: boolean
  title?: string
  description?: string
  [key: string]: any
}

// Mock the AIChatReact component
vi.mock('../AIChatReact', () => {
  const mockFn = vi.fn()
  mockFn.mockImplementation((props: AIChatProps) => {
    // Return a mock implementation description rather than JSX
    // This avoids TypeScript errors while still mocking the component
    return {
      type: 'div',
      props: {
        'data-testid': 'ai-chat-react',
        'data-props': JSON.stringify(props),
        'children': [
          {
            type: 'div',
            props: {
              className: 'chat-window',
              children: [
                {
                  type: 'div',
                  props: {
                    className: 'chat-messages',
                    children: 'AI: How can I assist you today?',
                  },
                },
                {
                  type: 'div',
                  props: {
                    className: 'chat-input',
                    children: [
                      {
                        type: 'input',
                        props: {
                          type: 'text',
                          placeholder: 'Type your message...',
                        },
                      },
                      {
                        type: 'button',
                        props: {
                          children: 'Send',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
          props.showModelSelector
            ? {
                type: 'div',
                props: {
                  className: 'model-selector',
                  children: [
                    {
                      type: 'label',
                      props: {
                        children: 'Select AI Model',
                      },
                    },
                    {
                      type: 'select',
                      props: {
                        children: props.availableModels?.map((model) => ({
                          type: 'option',
                          props: {
                            key: model.id,
                            value: model.id,
                            children: model.name,
                          },
                        })),
                      },
                    },
                  ],
                },
              }
            : null,
        ].filter(Boolean),
      },
    }
  })
  return { default: mockFn }
})

// Helper function to render Astro components in tests
async function renderAstroComponent(Component: any, props = {}) {
  const { default: defaultExport } = Component
  const html = await defaultExport.render(props)
  const container = document.createElement('div')
  container.innerHTML = html.html
  document.body.appendChild(container)
  return { container }
}

describe('AIChat.astro', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('renders with default props', async () => {
    const { container } = await renderAstroComponent(AIChat)

    // Check if the title and description are rendered with default values
    const h2Element = container.querySelector('h2')
    const pElement = container.querySelector('p')

    expect(h2Element?.textContent).toBe('AI Chat')
    expect(pElement?.textContent?.trim()).toBe(
      'Interact with our AI assistant powered by TogetherAI.',
    )

    // Check if client component placeholder exists
    expect(container.innerHTML).toContain('ai-chat-react')
  })

  it('renders with custom props', async () => {
    const customProps = {
      availableModels: [
        { id: 'openai/gpt-4', name: 'GPT-4' },
        { id: 'anthropic/claude-3', name: 'Claude 3' },
      ],
      showModelSelector: false,
      title: 'Custom AI Assistant',
      description: 'Specialized AI chat for technical support',
    }

    const { container } = await renderAstroComponent(AIChat, customProps)

    // Check if the custom title and description are rendered
    const h2Element = container.querySelector('h2')
    const pElement = container.querySelector('p')

    expect(h2Element?.textContent).toBe('Custom AI Assistant')
    expect(pElement?.textContent?.trim()).toBe(
      'Specialized AI chat for technical support',
    )

    // Verify client:load component would receive the right props
    const htmlContent = container.innerHTML
    expect(htmlContent).toContain('showModelSelector={false}')
    expect(htmlContent).toContain('openai/gpt-4')
    expect(htmlContent).toContain('anthropic/claude-3')
  })

  it('applies transition styles', async () => {
    const { container } = await renderAstroComponent(AIChat)

    // Check if transition styles are applied
    const mainDiv = container.querySelector('div')
    expect(mainDiv?.classList.contains('transition-colors')).toBe(true)
    expect(mainDiv?.classList.contains('duration-300')).toBe(true)

    // Check if style element is included
    const styleElement = container.querySelector('style')
    expect(styleElement).toBeTruthy()
    expect(styleElement?.textContent).toContain('--transition-duration: 300ms')
  })

  it('has responsive layout classes', async () => {
    const { container } = await renderAstroComponent(AIChat)

    const mainDiv = container.querySelector('div')
    expect(mainDiv?.classList.contains('w-full')).toBe(true)
    expect(mainDiv?.classList.contains('max-w-2xl')).toBe(true)
    expect(mainDiv?.classList.contains('mx-auto')).toBe(true)
  })
})
