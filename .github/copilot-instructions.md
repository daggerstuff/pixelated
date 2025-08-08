# COPILOT EDITS OPERATIONAL GUIDELINES

## important 
always use byterover-retrive-knowledge tool to get the related context before any tasks 
always use byterover-store-knowledge to store all the critical informations after sucessful tasks

# Pixelated Empathy - Development Guidelines

*Last updated: 2025-07-29*

This document provides comprehensive development guidelines for the Pixelated Empathy project, covering build processes, testing infrastructure, and code style conventions.

## Project Overview

Pixelated Empathy is a complex full-stack application combining:
- **Frontend**: Astro framework with TypeScript/React components
- **AI/ML Backend**: Python-based bias detection and mental health processing
- **Data Pipeline**: Comprehensive dataset processing for mental health AI training
- **Deployment**: Multi-environment setup with Docker and Azure pipelines

## Build & Configuration Instructions

### Prerequisites

- **Node.js**: Version 22 (specified in package.json engines)
- **Python**: Version 3.11+ (specified in pyproject.toml)
- **Package Manager**: pnpm  (specified in package.json packageManager)
- **Docker**: For containerized deployment

### Environment Setup

1. **Install Dependencies**:
   ```bash
   # Install Node.js dependencies
   pnpm install
   
   # Install Python dependencies (using uv for faster installs)
   uv pip install -e .
   ```

2. **Development Server**:
   ```bash
   # Start Astro development server
   pnpm dev
   
   # Start all services (includes AI services, analytics, worker)
   pnpm dev:all-services
   ```

3. **Build Process**:
   ```bash
   # Standard build
   pnpm build
   
   # Vercel-optimized build (with increased memory)
   pnpm build:vercel
   
   # Docker build
   pnpm docker:build
   ```

### Key Configuration Files

- **package.json**: Node.js dependencies and scripts
- **pyproject.toml**: Python dependencies and tool configurations
- **astro.config.mjs**: Astro framework configuration
- **Dockerfile**: Multi-stage container build with security best practices
- **azure-pipelines.yml**: CI/CD pipeline with Qodana code quality checks

### Docker Configuration

The project uses a multi-stage Docker build:
- **Base**: Node.js 22 slim with pnpm and system dependencies
- **Build Stage**: Installs dependencies and builds the application
- **Runtime**: Optimized production image with non-root user
- **Health Check**: Built-in endpoint monitoring on port 4321

## Testing Infrastructure

### Test Types & Frameworks

1. **Unit Tests (Vitest)**:
   - **Framework**: Vitest with jsdom environment
   - **Coverage**: V8 provider with multiple reporters
   - **Configuration**: `vitest.config.ts`
   - **Run**: `pnpm test` or `pnpm test:unit`

2. **End-to-End Tests (Playwright)**:
   - **Browsers**: Chromium, Firefox, WebKit
   - **Configuration**: `playwright.config.ts`
   - **Run**: `pnpm e2e` or `pnpm test:e2e`

3. **Python Tests (pytest)**:
   - **Framework**: pytest with asyncio support
   - **Location**: AI/ML components in `src/lib/ai/`
   - **Run**: `python -m pytest`

### Test Configuration Details

#### Vitest Setup
- **Environment**: jsdom for DOM testing
- **Setup Files**: `./src/test/setup.ts`, `./vitest.setup.ts`
- **Coverage**: Enabled with text, json, html, cobertura reporters
- **CI Optimization**: Different timeouts and thread pools for CI vs local
- **Exclusions**: E2E, browser, accessibility, performance tests excluded from unit tests

#### Playwright Setup
- **Base URL**: http://localhost:4321
- **Auto Server**: Starts dev server automatically
- **Debugging**: Trace on first retry, screenshots on failure
- **CI Settings**: 2 retries, single worker in CI environment

#### Python Testing
- **Patterns**: Both unittest and pytest styles supported
- **Location**: Tests in `src/lib/ai/bias-detection/python-service/`
- **Coverage**: Configured in pyproject.toml with branch coverage

### Running Tests

```bash
# JavaScript/TypeScript unit tests
pnpm test                           # Watch mode
pnpm test:unit                      # Run once with coverage
pnpm vitest run src/test-demo.test.ts  # Specific file

# End-to-end tests
pnpm e2e                           # All E2E tests
pnpm e2e:smoke                     # Smoke tests only
pnpm e2e:ui                        # Interactive UI mode

# Python tests
python -m pytest test_demo.py -v   # Verbose output
python -m pytest --cov=src         # With coverage

# All tests
pnpm test:all                      # Comprehensive test suite
```

### Test Examples

#### JavaScript/TypeScript Test Pattern
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Component Tests', () => {
  beforeEach(() => {
    // Setup code
  })

  it('should test functionality', () => {
    expect(result).toBe(expected)
  })

  it('should handle async operations', async () => {
    vi.useFakeTimers()
    const promise = asyncFunction()
    vi.advanceTimersByTime(100)
    const result = await promise
    expect(result).toBeDefined()
    vi.useRealTimers()
  })
})
```

#### Python Test Pattern
```python
import pytest
import unittest
from unittest.mock import MagicMock, patch

class TestComponent(unittest.TestCase):
    def setUp(self):
        self.test_data = {"key": "value"}
    
    def test_functionality(self):
        self.assertEqual(result, expected)
    
    @patch('module.dependency')
    def test_with_mock(self, mock_dep):
        mock_dep.return_value = "mocked"
        result = function_under_test()
        self.assertEqual(result, "expected")

def test_pytest_style():
    assert result == expected
```

## Code Style & Development Practices

### JavaScript/TypeScript Standards

#### ESLint Configuration
- **Config**: Modern flat config format in `eslint.config.js`
- **Rules**: TypeScript recommended + React rules
- **Multi-language**: Supports JS, TS, JSX, JSON, Markdown, CSS
- **Key Rules**:
  - No unused variables (with underscore prefix exception)
  - React JSX without React imports
  - TypeScript-aware linting

#### Prettier Configuration
- **Line Width**: 80 characters
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for JS/TS, double for JSX
- **Semicolons**: Disabled
- **Trailing Commas**: Always
- **Special Handling**: Astro files with prettier-plugin-astro

#### Code Formatting Commands
```bash
# Format all files
pnpm format

# Check formatting without changes
pnpm format:check

# Lint and fix issues
pnpm lint:fix

# Type checking
pnpm typecheck

# All quality checks
pnpm check:all
```

### Python Standards

#### Tool Configuration (pyproject.toml)
- **Black**: Line length 100, Python 3.11 target
- **Ruff**: Comprehensive rule set with line length 100
- **MyPy**: Type checking with ignore missing imports
- **PyRight**: Basic type checking mode

#### Key Python Rules
- **Line Length**: 100 characters
- **Import Sorting**: First-party modules (ai, src, api)
- **Type Checking**: Enabled for src, tests, ai, api directories
- **Coverage**: Branch coverage enabled

### File Organization

#### Directory Structure
```
pixelated/
├── src/                    # Frontend source code
│   ├── components/         # Astro/React components
│   ├── lib/               # Utility libraries
│   │   └── ai/            # AI/ML components
│   └── test/              # Test utilities
├── ai/                    # AI/ML pipeline code
│   └── dataset_pipeline/  # Dataset processing scripts
├── tests/                 # Test files
│   ├── e2e/              # End-to-end tests
│   ├── integration/      # Integration tests
│   └── accessibility/    # Accessibility tests
├── infra/                # Infrastructure code
└── docs/                 # Documentation
```

#### Naming Conventions
- **Files**: kebab-case for components, camelCase for utilities
- **Components**: PascalCase for React/Astro components
- **Variables**: camelCase for JavaScript, snake_case for Python
- **Constants**: UPPER_SNAKE_CASE
- **Types/Interfaces**: PascalCase with descriptive names

### Git Workflow

#### Commit Standards
- Use conventional commits format
- Include type prefixes: feat, fix, docs, style, refactor, test, chore
- Keep commits atomic and descriptive

#### Branch Strategy
- **main**: Production-ready code
- **develop**: Integration branch
- **feature/***: Feature development
- **hotfix/***: Critical fixes

### Development Tools

#### Recommended VS Code Extensions
- Astro (astro-build.astro-vscode)
- Prettier (esbenp.prettier-vscode)
- ESLint (dbaeumer.vscode-eslint)
- Python (ms-python.python)
- TypeScript (ms-vscode.vscode-typescript-next)

#### IDE Configuration
- Enable format on save
- Configure ESLint and Prettier integration
- Set up Python type checking with PyRight/MyPy

### Performance Considerations

#### Build Optimization
- Use `pnpm build:vercel` for memory-intensive builds
- Docker multi-stage builds for production
- Asset optimization through Astro's build process

#### Development Performance
- Use `pnpm dev:all-services` only when needed
- File watcher limits may require system configuration
- Consider using `vitest run` instead of watch mode for large test suites

### Security Practices

#### Code Security
- Regular dependency updates via `pnpm update`
- Security scanning with `pnpm security:scan`
- Credential sanitization scripts available
- Docker runs with non-root user

#### AI/ML Security
- Bias detection service with audit logging
- Encrypted session data handling
- JWT token verification
- HIPAA compliance testing available

### Deployment

#### Environment Configuration
- **Development**: `pnpm dev`
- **Staging**: `pnpm deploy`
- **Production**: `pnpm deploy:prod`
- **Vercel**: `pnpm deploy:vercel`

#### CI/CD Pipeline
- Qodana code quality checks
- Automated testing and deployment
- Container registry integration

### Troubleshooting

#### Common Issues
1. **File Watcher Limits**: Use `vitest run` instead of watch mode
2. **Memory Issues**: Use `pnpm build:vercel` for large builds
3. **Python Dependencies**: Ensure Python 3.11+ and proper virtual environment
4. **Docker Issues**: Check port 4321 availability and Docker daemon

#### Debug Commands
```bash
# Test specific services
pnpm ai:test
pnpm redis:check
pnpm memory:test

# Performance testing
pnpm performance:test

# Security checks
pnpm security:check
```

This document should be updated as the project evolves and new practices are established.[byterover-mcp]

# important 
always use byterover-retrive-knowledge tool to get the related context before any tasks 
always use byterover-store-knowledge to store all the critical informations after sucessful tasks