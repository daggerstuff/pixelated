# Bias Detection Engine Developer Setup & Contribution Guide

## Prerequisites

- **Node.js:** v18.x or later (v22.x recommended)
- **pnpm:** 10.11.0+ (required)
- **Python:** 3.11+ (for backend service integration)
- **Git:** Latest version

## Initial Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/pixelated-empathy/bias-detection-engine.git
   cd bias-detection-engine
   ```

2. **Install dependencies:**
   ```bash
   pnpm install --no-frozen-lockfile
   ```

3. **Set up environment variables:**
   - Copy the example file:
     ```bash
     cp env.example .env.local
     ```
   - Edit `.env.local` with your configuration values.
   - For CI/CD and production, see [Environment Setup](./environment-setup.md).

4. **Run setup scripts:**
   ```bash
   pnpm run setup:env
   ```

## Running the Engine

- **Start development server:**
  ```bash
  pnpm dev
  ```
  The Astro server runs at http://localhost:3000.

- **Build for production:**
  ```bash
  pnpm build
  ```

## Testing, Linting, and Formatting

- **Run tests:**
  ```bash
  pnpm test
  ```
- **Lint code:**
  ```bash
  pnpm lint
  ```
- **Type checking:**
  ```bash
  pnpm typecheck
  ```
- **Format code:**
  ```bash
  pnpm format
  ```

## Python Backend Integration

- Ensure Python 3.11+ is installed.
- Install backend dependencies:
  ```bash
  cd src/lib/ai/bias-detection/python-service
  pip install -r requirements.txt
  ```
- Start the Python service:
  ```bash
  python bias_detection_service.py
  ```

## Contribution Workflow

1. **Branching:**
   - Create a feature branch from `develop`:
     ```bash
     git checkout -b feature/my-feature
     ```

2. **Commits:**
   - Use [Conventional Commits](https://www.conventionalcommits.org/) for all changes.

3. **Pull Requests:**
   - Push your branch and open a PR to `develop`.
   - Ensure all tests pass and code is linted.

4. **Documentation:**
   - Update documentation for any new features or changes.
   - Follow Markdown formatting and keep docs up to date.

5. **Code Style:**
   - Use strict TypeScript typing.
   - Run `pnpm run typecheck:strict` before submitting.

## Troubleshooting

- Run diagnostics:
  ```bash
  pnpm run diagnostics
  ```
- Check environment variables and Node.js/Python versions.
- For Sentry issues, verify DSN and auth token.
- See [Troubleshooting Guide](./TROUBLESHOOTING.md).

## Support

- Create an issue in the repository for technical questions.
- Contact the development team for urgent issues.
- Review the troubleshooting guide and FAQ.
