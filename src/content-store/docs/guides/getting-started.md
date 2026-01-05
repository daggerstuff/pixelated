---
title: 'Getting Started'
description: 'Learn how to get started with Pixelated'
pubDate: '2025-01-01'
author: 'Pixelated Empathy Team'
draft: false
toc: true
share: true
---

## Getting Started with Pixelated

This guide will help you set up and start using Pixelated. Follow these steps to get your environment ready and begin development.

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v18 or later)
- pnpm (v8 or later)
- AWS CLI (configured with appropriate credentials)
- Docker (for local development)

## Installation

1. Clone the repository:

```bash
git clone https://github.com/gradiant/gradiant.git
cd gradiant
```

2. Install dependencies:

```bash
pnpm install --no-frozen-lockfile
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Edit `.env` with your configuration values.

## Configuration

### Basic Setup

1. Configure AWS credentials:

```bash
aws configure
```

2. Set up the development database:

```bash
pnpm db:setup
```

3. Initialize the development environment:

```bash
pnpm dev:init
```

### Security Configuration

1. Generate encryption keys:

```bash
pnpm security:init
```

2. Configure HIPAA compliance settings:

```bash
pnpm hipaa:setup
```

## Running the Application

1. Start the development server:

```bash
pnpm dev
```

2. Access the application:

- Frontend: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:3001](http://localhost:3001)
- Documentation: [http://localhost:3002](http://localhost:3002)

## Development Workflow

### Code Structure

```bash
gradiant/
├── apps/
│   ├── web/          # Frontend application
│   ├── api/          # Backend API
│   └── docs/         # Documentation
├── packages/
│   ├── core/         # Shared core functionality
│   ├── ui/           # UI component library
│   └── config/       # Shared configuration
└── tools/            # Development tools
```

### Key Commands

- `pnpm dev` - Start development environment
- `pnpm test` - Run tests
- `pnpm build` - Build for production
- `pnpm lint` - Run linting
- `pnpm format` - Format code

## Next Steps

- Review the [Architecture Overview](/docs/architecture)
- Explore the [API Documentation](/api/overview)
- Learn about [Security Features](/docs/security)
- Check out [Advanced Features](/docs/advanced-features)

## Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Verify PostgreSQL is running
   - Check connection string in `.env`
   - Ensure proper permissions

2. **AWS Configuration**
   - Verify AWS credentials
   - Check region settings
   - Confirm IAM permissions

3. **Development Server**
   - Clear `.next` cache
   - Verify port availability
   - Check Node.js version

### Getting Help

- Join our [Discord community](https://discord.gg/gradiant)
- Check [GitHub Issues](https://github.com/gradiant/issues)
- Contact [support@gradiant.dev](mailto:support@gradiant.dev)
