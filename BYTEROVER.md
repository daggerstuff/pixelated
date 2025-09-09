# BYTEROVER HANDBOOK

## Layer 1: System Overview

### Purpose
This project is a web application called "Pixelated" that provides AI-powered services, including crisis session flagging and various mental health and AI features. It appears to be a comprehensive platform for AI-driven applications with a focus on user safety and mental health support.

### Tech Stack
- **Runtime**: Node.js 24 (as specified in `package.json`)
- **Framework**: Astro with React
- **Package Manager**: pnpm (`v10.15.0`)
- **Database**: MongoDB with Mongoose
- **Language**: TypeScript
- **Styling**: Tailwind CSS, UnoCSS
- **AI Services**: OpenAI, Google GenAI, custom bias detection
- **Testing**: Vitest (unit), Playwright (E2E)
- **Monitoring**: Sentry, Spotlight.js
- **Deployment**: Docker, Kubernetes, Vercel, Azure

### Key Development Scripts
A developer's primary commands are defined in `package.json`:
- `pnpm dev`: Starts the Astro development server.
- `pnpm dev:all-services`: Starts all microservices concurrently.
- `pnpm build`: Builds the application for production.
- `pnpm test`: Runs unit tests in watch mode.
- `pnpm test:unit`: Runs all unit tests with coverage.
- `pnpm e2e`: Runs end-to-end tests with Playwright.
- `pnpm format`: Formats all code with Prettier.
- `pnpm lint`: Lints the codebase with OxcLint.
- `pnpm typecheck`: Runs the TypeScript compiler to check for type errors.

### Architecture
The project follows a modern web application architecture using Astro as the meta-framework, with React for interactive components. It uses MongoDB for data persistence and integrates multiple AI services for various functionalities like bias detection, crisis flagging, and content analysis. A key performance optimization is the externalization of heavy libraries (like `@tensorflow/tfjs`, `three`, `mongodb`) from the server-side rendering bundle, as configured in `astro.config.mjs`.

## Layer 2: Module Map

### Core Modules
- **`src/lib/ai/`**: AI services including bias detection, crisis session flagging, and various AI integrations.
- **`src/lib/db/`**: Database connection and models.
- **`src/components/`**: Reusable React components.
- **`src/pages/`**: Astro pages for routing.
- **`src/services/`**: External service integrations.
- **`src/utils/`**: Utility functions and helpers.

### Path Aliases
To simplify imports, the project uses path aliases configured in `tsconfig.json` and `astro.config.mjs`:
- `@/*`: Maps to `src/*`
- `@lib/*`: Maps to `src/lib/*`
- `~/*`: Maps to `src/*`
- `@components`: Maps to `src/components`

### Key Responsibilities
- AI Module: Handles all AI-related operations including model inference and data processing.
- Database Module: Manages data persistence and queries.
- Components: Provides UI building blocks.
- Pages: Defines application routes and layouts.

## Layer 3: Integration Guide

### APIs and Services
- **MongoDB**: Primary database for application data.
- **OpenAI API**: For AI model interactions.
- **Google GenAI**: Alternative AI service.
- **Redis**: Caching and session management.
- **External APIs**: Various third-party services for enhanced functionality.

### Configuration
- Environment variables for API keys and database connections.
- Docker Compose for local development (`docker-compose.yml`).
- Kubernetes manifests for production deployment.

### Serena (SSE) Integration

- **Purpose**: Server-Sent Events (SSE) endpoint used for event streaming, notifications, and onboarding coordination with developer tooling.
- **Endpoint**: `https://serena.pixelatedempathy.tech/sse`
- **Type**: `http` (SSE)
- **Usage**: Tools and MCP clients may subscribe to this endpoint for real-time project events. If onboarding is required, POST requests or a specialized onboarding message may be accepted by the Serena service (check service docs).
- **Notes**: The project stores a reference to this endpoint in user/editor `mcp.json` settings. Ensure network access and any required tokens or proxies are configured for CI and developer machines.

### Known Issues & Workarounds
- **Astro `APIContext` Bug**: Due to a type inheritance bug in Astro 5.x, the native `APIContext` is missing the `request` property. **Do not import `APIContext` from `astro`**. Instead, use the custom `BaseAPIContext` defined in `src/lib/auth/apiRouteTypes.ts`.

## Layer 4: Extension Points

### Design Patterns
- React functional components with hooks.
- Astro page components for routing.
- Service layer pattern for external integrations.
- Repository pattern for data access.

### Customization Areas
- AI service providers can be swapped.
- Database backends are configurable.
- UI components are modular and extensible.
- Plugin system for additional features.

### Development Workflow
1.  **Install Dependencies**: Run `pnpm install`.
2.  **Run Dev Server**: Run `pnpm dev` for frontend work or `pnpm dev:all-services` for full-stack development.
3.  **Code Quality**: Use `pnpm format` and `pnpm lint` before committing.
4.  **Type Checking**: Run `pnpm typecheck` to ensure type safety.
5.  **Testing**:
    - Write unit tests for new logic and run with `pnpm test:unit`.
    - Write E2E tests for new features and run with `pnpm e2e`.
6.  **Committing**: Follow conventional commit standards.