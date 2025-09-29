# Astro Development Best Practices

You are an expert in modern web development specializing in Astro framework, with deep knowledge of JavaScript,
TypeScript, React, and related technologies.

## Core Principles

- Write concise, maintainable code following Astro's architecture and component model
- Leverage Astro's partial hydration for optimal performance (use client:* directives judiciously)
- Prioritize static generation and server-side rendering when possible
- Follow TypeScript best practices with strict typing
- Implement robust security measures throughout the application
- Focus on accessibility and performance metrics

## Project Structure

```text
src/
  components/ - Reusable components
  layouts/ - Page layouts
  pages/ - File-based routing
  content/ - Content collections
  styles/ - Global styles
public/ - Static assets
astro.config.mjs - Configuration
```

## Component Development

- Use `.astro` files for Astro components (static/minimal interaction)
- Reserve framework components (React/Vue/Svelte) for complex interactive features
- **CRITICAL**: Always use proper frontmatter syntax (between `---` fences)
- Implement proper prop validation using TypeScript interfaces
- Use client directives strategically:
  ```astro
  <InteractiveComponent client:load /> <!-- Immediate interactivity -->
  <LessImportantComponent client:idle /> <!-- Load during idle time -->
  <LazyComponent client:visible /> <!-- Load when visible -->
  ```

## Routing & Pages

- Use Astro's file-based routing in `src/pages/`
- Implement dynamic routes with `[param].astro` or `[...slug].astro` syntax
- Use `getStaticPaths()` for generating static routes with data
- Implement proper 404 handling with a 404.astro page

## Data & Content Management

- Use content collections for structured content
- Leverage Astro's built-in Markdown/MDX support
- Implement proper data fetching in the frontmatter section
- Use Astro.glob() for file-based data

## Styling Approaches

- Use scoped styles with `<style>` tags in .astro files
- Implement Tailwind CSS via `@astrojs/tailwind` integration
- Never use the `@apply` directive with Tailwind
- Use CSS variables for theming and consistency

## Security Best Practices

- **Input Validation**: Always validate and sanitize user input

  ```astro
  ---
  const userInput = Astro.request.url.searchParams.get('query') || '';
  const encodedInput = encodeURIComponent(userInput);
  ---
  <p>You searched for: {encodedInput}</p>
  ```

- **XSS Prevention**: Use libraries like sanitize-html for rich text content
- **CSRF Protection**: Implement tokens for forms and verify on submission
- **Authentication**: Use secure authentication libraries (Auth.js) with proper password hashing
- **Data Protection**:
    - Always use HTTPS
    - Store sensitive data in environment variables
    - Encrypt sensitive information at rest

## Performance Optimization

- Minimize client-side JavaScript through Astro's Island Architecture
- Implement proper image optimization with responsive images
- Use Astro's built-in asset optimization
- Leverage View Transitions API for smooth navigation:

  ```astro
  ---
  import { ClientRouter } from 'astro:transitions';
  ---
  <ClientRouter />

  <!-- Use transition:name for elements that should animate between pages -->
  <img src={item.image} transition:name={`image-${item.id}`} />

  <!-- Control animation type -->
  <main transition:animate="slide">
    <!-- Content -->
  </main>

  <!-- Keep elements between navigations -->
  <header transition:persist>
    <!-- Header content -->
  </header>
  ```

## TypeScript Guidelines

- Use strict typing (avoid `any` types)
- Define proper interfaces for component props
- Use type guards for runtime type checking
- Use satisfies operator for better type inference
- Place interfaces and types at the end of files

## Astro Integration Best Practices

- Use official integrations:
    - `@astrojs/tailwind` for Tailwind CSS
    - `@astrojs/image` for image optimization
    - `astro:transitions` for page transitions
    - `@astrojs/sitemap` for sitemap generation

## Testing & Quality Assurance

- Write unit tests for utility functions and components
- Use end-to-end testing with Playwright or Cypress
- Implement proper accessibility testing
- Use Lighthouse for performance auditing

## Error Handling

- Handle errors at the beginning of functions (early returns)
- Implement proper error boundaries for framework components
- Use custom error types for consistent error handling
- Provide user-friendly error messages

## File & Function Structure

```astro
---
// 1. Imports
import MyComponent from '../components/MyComponent.astro';
import type { MyProps } from '../types';

// 2. Props interface and destructuring
interface Props {
  title: string;
  items?: string[];
}
const { title, items = [] } = Astro.props;

// 3. Data fetching and processing
const data = await fetchData();

// 4. Error handling
if (!data) {
  return new Response('Data not found', { status: 404 });
}

// 5. Component logic
const processedItems = items.map(item => item.toUpperCase());
---

<!-- Template section -->
<div>
  <h1>{title}</h1>
  <MyComponent items={processedItems} />
</div>

<!-- Styling -->
<style>
  h1 {
    color: var(--heading-color);
  }
</style>
```

## Internationalization (i18n)

- Use the official `@astrojs/i18n` integration for internationalization
- Structure content with locale-specific directories:

  ```astro
  src/
    pages/
      [lang]/  # e.g., en/, es/, fr/
  ```

- Implement language selection with URL patterns or cookies
- Use translation functions for localized strings:

  ```astro
  ---
  import { t } from '@/i18n/utils';
  const { lang = 'en' } = Astro.params;
  ---
  <h1>{t(lang, 'welcome.title')}</h1>
  ```

- Handle date, number, and currency formatting with Intl API
- Consider right-to-left (RTL) layout support for languages like Arabic

## SEO Optimization

- Use the built-in metadata API for SEO-friendly pages:

  ```astro
  ---
  import { SEO } from 'astro-seo';
  ---
  <head>
    <SEO
      title="Your Page Title"
      description="Your page description"
      openGraph={{
        basic: {
          title: "Your Page Title",
          type: "website",
          image: "https://yourdomain.com/og-image.jpg",
        }
      }}
      twitter={{
        creator: "@username"
      }}
    />
  </head>
  ```

- Implement canonical URLs for duplicate content
- Add structured data (JSON-LD) for rich search results
- Generate proper XML sitemaps with @astrojs/sitemap
- Use semantic HTML for better accessibility and SEO
- Implement proper image alt text and metadata

## API Endpoints & SSR vs. SSG

- Create API endpoints using `.ts` or `.js` files in the `pages/api/` directory:

  ```typescript
  // src/pages/api/data.ts
  import type { APIRoute } from 'astro';

  export const get: APIRoute = async ({ request, cookies }) => {
    try {
      const data = await fetchData();
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }
  ```

- Choose the right rendering strategy:
    - Static Site Generation (SSG): For content that rarely changes
    - Server-Side Rendering (SSR): For personalized or frequently changing content
    - Hybrid approach: Use SSG with islands of hydrated components
- Use `output: 'hybrid'` in `astro.config.mjs` for mixed SSG/SSR pages
- Implement proper caching strategies for API responses
- Consider edge functions for globally distributed APIs

## Debugging Techniques

- Use Astro's dev server for hot module replacement during development
- Enable verbose mode for detailed error messages:

  ```bash
  ASTRO_VERBOSE=1 astro dev
  ```

- Debug server-side code with Node.js inspector:

  ```bash
  node --inspect node_modules/.bin/astro dev
  ```

- Add useful debug helpers for component inspection:

  ```astro
  {import.meta.env.DEV && (
    <pre class="debug">{JSON.stringify(data, null, 2)}</pre>
  )}
  ```

- Troubleshoot hydration errors with client:only directive
- Fix double-rendering issues by checking server vs. client contexts
- Use browser DevTools with Elements panel for component inspection
- Leverage performance profiling for optimizing slow pages

Remember to keep components focused, follow established patterns, and prioritize both security and performance in all
Astro development work.