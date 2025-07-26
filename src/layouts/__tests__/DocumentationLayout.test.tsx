// Create a mock function for the Astro global
const Astro = {
  url: new URL('https://example.com/docs/page'),
  site: new URL('https://example.com'),
}

// Mock components used in the layout
vi.mock('@/components/base/Head.astro', () => ({
  default: ({ title, description }) =>
    `<mock-head title="${title}" description="${description}"></mock-head>`,
}))

vi.mock('@/components/layout/Header.astro', () => ({
  default: () => '<mock-header></mock-header>',
}))

vi.mock('@/components/layout/Footer.astro', () => ({
  default: () => '<mock-footer></mock-footer>',
}))

vi.mock('@/components/ui/ThemeToggle.astro', () => ({
  default: () => '<mock-theme-toggle></mock-theme-toggle>',
}))

vi.mock('astro:transitions', () => ({
  ClientRouter: () => '<mock-client-router></mock-client-router>',
  ViewTransitions: () => '<mock-view-transitions></mock-view-transitions>',
}))

// Test the DocumentationLayout component
test('DocumentationLayout renders with correct title and content', async () => {
  // Import the component
  const { default: DocumentationLayout } = await import(
    '../DocumentationLayout.astro'
  )

  // Prepare test props
  const props = {
    title: 'Test Documentation',
    description: 'Test Description',
    image: '/test-image.jpg',
    canonicalURL: 'https://example.com/docs/test',
    Astro,
    children: '<div id="test-content">Test Content</div>',
  }

  // Render the component - Astro components in tests typically return Response-like or HTML string
  // const result = await DocumentationLayout.render(props) // Use .render() which is common for Astro testing
  const result = await DocumentationLayout(props) // Call the component directly
  const renderedHtml = typeof result === 'string' ? result : await result.text() // Get text if Response-like

  // Check for important elements
  expect(renderedHtml).toContain(
    '<mock-head title="Test Documentation" description="Test Description"></mock-head>',
  )
  expect(renderedHtml).toContain('Test Documentation') // Check title usage within the body potentially
  // expect(renderedHtml).toContain('Test Description') // Description might only be in Head
  expect(renderedHtml).toContain('<mock-header>')
  expect(renderedHtml).toContain('<mock-footer>')
  expect(renderedHtml).toContain('<mock-theme-toggle>')
  // Check for content passed via slot/children
  expect(renderedHtml).toContain('<div id="test-content">Test Content</div>')
  // Add checks for potentially layout-specific elements if needed
  // expect(renderedHtml).toContain('id="on-this-page"') // Assuming sidebar exists
  // expect(renderedHtml).toContain('class="docs-content"')
})

// Test that the layout handles frontmatter props correctly
test('DocumentationLayout uses frontmatter props when available', async () => {
  // Import the component
  const { default: DocumentationLayout } = await import(
    '../DocumentationLayout.astro'
  )

  // Prepare test props with frontmatter
  const props = {
    title: 'Fallback Title',
    description: 'Fallback Description',
    frontmatter: {
      title: 'Frontmatter Title',
      description: 'Frontmatter Description',
      image: '/frontmatter-image.jpg',
    },
    Astro,
    children: '<div>Test Content</div>',
  }

  // Render the component
  // const result = await DocumentationLayout.render(props) // Use .render()
  const result = await DocumentationLayout(props) // Call the component directly
  const renderedHtml = typeof result === 'string' ? result : await result.text() // Get text if Response-like

  // Check that frontmatter props are used in head and potentially body
  expect(renderedHtml).toContain(
    '<mock-head title="Frontmatter Title" description="Frontmatter Description"></mock-head>',
  )
  // Check potentially in body too
  expect(renderedHtml).toContain('Frontmatter Title')
  // expect(renderedHtml).toContain('Frontmatter Description') // Description might only be in Head
  expect(renderedHtml).not.toContain('Fallback Title')
  // expect(renderedHtml).not.toContain('Fallback Description') // Description might only be in Head
  expect(renderedHtml).toContain('<div>Test Content</div>')
})
