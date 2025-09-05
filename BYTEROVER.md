# BYTEROVER HANDBOOK

## Layer 1: System Overview

### Purpose
This project is a web application called "Pixelated" that provides AI-powered services, including crisis session flagging and various mental health and AI features. It appears to be a comprehensive platform for AI-driven applications with a focus on user safety and mental health support.

### Tech Stack
- **Runtime**: Node.js 24
- **Framework**: Astro with React
- **Database**: MongoDB with Mongoose
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI Services**: OpenAI, Google GenAI, custom bias detection
- **Deployment**: Docker, Kubernetes, various cloud providers
- **Testing**: Vitest, Playwright
- **Package Manager**: pnpm

### Architecture
The project follows a modern web application architecture using Astro as the meta-framework, with React for interactive components. It uses MongoDB for data persistence and integrates multiple AI services for various functionalities like bias detection, crisis flagging, and content analysis.

## Layer 2: Module Map

### Core Modules
- **src/lib/ai/**: AI services including bias detection, crisis session flagging, and various AI integrations
- **src/lib/db/**: Database connection and models
- **src/components/**: Reusable React components
- **src/pages/**: Astro pages for routing
- **src/services/**: External service integrations
- **src/utils/**: Utility functions and helpers

### Key Responsibilities
- AI Module: Handles all AI-related operations including model inference and data processing
- Database Module: Manages data persistence and queries
- Components: Provides UI building blocks
- Pages: Defines application routes and layouts

## Layer 3: Integration Guide

### APIs and Services
- **MongoDB**: Primary database for application data
- **OpenAI API**: For AI model interactions
- **Google GenAI**: Alternative AI service
- **Redis**: Caching and session management
- **External APIs**: Various third-party services for enhanced functionality

### Configuration
- Environment variables for API keys and database connections
- Docker Compose for local development
- Kubernetes manifests for production deployment

## Layer 4: Extension Points

### Design Patterns
- React functional components with hooks
- Astro page components for routing
- Service layer pattern for external integrations
- Repository pattern for data access

### Customization Areas
- AI service providers can be swapped
- Database backends are configurable
- UI components are modular and extensible
- Plugin system for additional features

### Development Workflow
- TypeScript for type safety
- ESLint and Prettier for code quality
- Vitest for unit testing
- Playwright for E2E testing