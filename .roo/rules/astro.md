---
inclusion: fileMatch
fileMatchPattern: ['**/*.astro', '**/astro.config.*', '**/pages/**/*', '**/components/**/*', '**/layouts/**/*']
---

# Astro Development Guidelines

Expert guidance for Astro 5.x development with TypeScript, React integration, and SSR/SSG optimization.

## Architecture Principles

- **Islands Architecture**: Use client:* directives sparingly - prefer static generation
- **Component Hierarchy**: `.astro` for static content, React/framework components for interactivity
- **TypeScript First**: Strict typing with proper interfaces, avoid `any` types
- **Performance Priority**: Target Core Web Vitals, minimize client-side JavaScript
- **Security by Design**: Input validation, XSS prevention, secure authentication patterns

## File Organization

```
src/
├── components/
│   ├── ui/           # Reusable UI components (Button, Card, Badge)
│   ├── admin/        # Admin-specific components
│   ├── chat/         # Chat interface components
│   └── dashboard/    # Dashboard components
├── layouts/          # Page layouts and templates
├── pages/
│   ├── api/          # API endpoints (.ts files)
│   └── [dynamic]/    # Dynamic routes
├── content/          # Content collections (markdown/MDX)
├── lib/              # Utilities and shared logic
└── styles/           # Global styles and theme system
```

## Component Patterns

### Astro Component Structure
```astro
---
// 1. Imports (types first, then components)
import type { ComponentProps } from '../types';
import Layout from '../layouts/Layout.astro';

// 2. Props interface and validation
interface Props {
  title: string;
  items?: string[];
}
const { title, items = [] } = Astro.props;

// 3. Data fetching and logic
const processedData = await fetchData();
---

<Layout title={title}>
  <main>
    <h1>{title}</h1>
    {items.map(item => <p>{item}</p>)}
  </main>
</Layout>

<style>
  h1 { color: var(--heading-color); }
</style>
```

### Client Directive Strategy
- `client:load` - Critical interactivity (auth forms, navigation)
- `client:idle` - Secondary features (analytics, non-essential widgets)  
- `client:visible` - Below-fold content (lazy-loaded components)
- `client:only` - Framework-specific components that can't SSR

## API Routes & Data Fetching

### API Endpoint Pattern
```typescript
// src/pages/api/data.ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, cookies }) => {
  try {
    // Use AstroCookies for authentication
    const token = cookies.get('auth-token')?.value;
    if (!token) {
      return new Response('Unauthorized', { status: 401 });
    }
    
    const data = await fetchSecureData(token);
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};
```

### Content Collections
- Define schemas in `src/content/config.ts`
- Use `getCollection()` for type-safe content queries
- Implement proper error handling for missing content

## Styling System

### Theme Architecture
```css
/* src/styles/pixelated-theme.css */
:root {
  --primary: 221.2 83.2% 53.3%;
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

### Component Styling Rules
- Scoped `<style>` tags in `.astro` files for component-specific styles
- Tailwind classes for utility-first styling (NO `@apply` directive)
- CSS variables for consistent theming across components
- Centralized theme system in `src/styles/` directory

## Security Requirements

### Input Sanitization
```astro
---
import { sanitizeHtml } from 'sanitize-html';

const userInput = Astro.request.url.searchParams.get('query') || '';
const safeInput = encodeURIComponent(userInput);
const richContent = sanitizeHtml(userContent, { allowedTags: ['p', 'strong'] });
---
```

### Authentication Patterns
- Use `AstroCookies` for secure session management
- Implement role-based access with TypeScript enums
- Validate authentication in API routes before processing
- Store sensitive data in environment variables only

## Performance Optimization

### View Transitions
```astro
---
import { ViewTransitions } from 'astro:transitions';
---
<head>
  <ViewTransitions />
</head>

<!-- Persistent elements across navigation -->
<header transition:persist>Navigation</header>

<!-- Named transitions for specific elements -->
<img transition:name={`hero-${id}`} src={image} alt={title} />
```

### Core Web Vitals
- Target <50ms response times for AI interactions
- Minimize JavaScript bundles with strategic hydration
- Use `loading="lazy"` for below-fold images
- Implement proper caching strategies for API responses

## TypeScript Patterns

### Component Props
```typescript
interface ComponentProps {
  title: string;
  variant?: 'primary' | 'secondary';
  items?: readonly string[];
}

// Use satisfies for better inference
const config = {
  theme: 'dark',
  features: ['auth', 'chat']
} satisfies AppConfig;
```

### Type Guards & Validation
```typescript
function isValidUser(data: unknown): data is User {
  return typeof data === 'object' && 
         data !== null && 
         'id' in data && 
         'email' in data;
}
```

## Error Handling Strategy

### API Route Errors
```typescript
export const GET: APIRoute = async ({ request }) => {
  try {
    const data = await riskyOperation();
    return Response.json(data);
  } catch (error) {
    console.error('API Error:', error);
    return Response.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
};
```

### Component Error Boundaries
- Use early returns for invalid props
- Provide fallback UI for missing data
- Log errors appropriately without exposing sensitive information

## Rendering Strategy

### SSG vs SSR Decision Matrix
- **SSG**: Marketing pages, documentation, blog posts
- **SSR**: User dashboards, personalized content, real-time data
- **Hybrid**: Use `output: 'hybrid'` with per-page `export const prerender = false`

### Development Workflow
```bash
# Development with verbose logging
ASTRO_VERBOSE=1 pnpm dev

# Debug server-side code
node --inspect node_modules/.bin/astro dev

# Performance profiling
pnpm build:analyze
```

## Project-Specific Patterns

### Pixelated Empathy Requirements
- Maintain <50ms response times for AI chat interactions
- Implement HIPAA-compliant data handling in all components
- Use centralized theme system for consistent UI across admin/user interfaces
- Apply bias detection monitoring in AI-related components
- Ensure accessibility compliance (WCAG AA) for all interactive elements

### Component Reusability
- Use shared UI components (Badge, Button, Card) from `components/ui/`
- Maintain consistent styling through centralized theme variables
- Implement proper TypeScript interfaces for all component props
- Follow domain-driven organization in component folders