# GitHub Copilot SDK Cookbook

This cookbook collects small, focused recipes showing how to accomplish common
tasks with the GitHub Copilot SDK across languages. Each recipe is intentionally
short and practical, with copy‑pasteable snippets and pointers to fuller
examples and tests.

## Recipes by Language

### Node.js / TypeScript

- [Ralph Loop](nodejs/ralph-loop.md): Build autonomous AI coding loops with
  fresh context per iteration, planning/building modes, and backpressure.
- [Error Handling](nodejs/error-handling.md): Handle errors gracefully including
  connection failures, timeouts, and cleanup.
- [Multiple Sessions](nodejs/multiple-sessions.md): Manage multiple independent
  conversations simultaneously.
- [Managing Local Files](nodejs/managing-local-files.md): Organize files by
  metadata using AI-powered grouping strategies.
- [PR Visualization](nodejs/pr-visualization.md): Generate interactive PR age
  charts using GitHub MCP Server.
- [Persisting Sessions](nodejs/persisting-sessions.md): Save and resume sessions
  across restarts.
- [Accessibility Report](nodejs/accessibility-report.md): Generate WCAG
  accessibility reports using the Playwright MCP server.

### Python

- [Ralph Loop](python/ralph-loop.md): Build autonomous AI coding loops with
  fresh context per iteration, planning/building modes, and backpressure.
- [Error Handling](python/error-handling.md): Handle errors gracefully including
  connection failures, timeouts, and cleanup.
- [Multiple Sessions](python/multiple-sessions.md): Manage multiple independent
  conversations simultaneously.
- [Managing Local Files](python/managing-local-files.md): Organize files by
  metadata using AI-powered grouping strategies.
- [PR Visualization](python/pr-visualization.md): Generate interactive PR age
  charts using GitHub MCP Server.
- [Persisting Sessions](python/persisting-sessions.md): Save and resume sessions
  across restarts.
- [Accessibility Report](python/accessibility-report.md): Generate WCAG
  accessibility reports using the Playwright MCP server.

## How to Use

- Browse your language section above and open the recipe links
- Each recipe includes runnable examples in a `recipe/` subfolder with
  language-specific tooling
- See existing examples and tests for working references:
  - Node.js examples: `nodejs/examples/basic-example.ts`
  - E2E tests: `python/e2e`, `nodejs/test/e2e`

## Running Examples

### Node.js

```bash
cd nodejs/cookbook/recipe
npm install
npx tsx <filename>.ts
```

### Python

```bash
cd python/cookbook/recipe
pip install -r requirements.txt
python <filename>.py
```

## Contributing

- Propose or add a new recipe by creating a markdown file in your language's
  `cookbook/` folder and a runnable example in `recipe/`
- Follow repository guidance in [CONTRIBUTING.md](../../../CONTRIBUTING.md)

## Status

Cookbook structure is complete with 7 recipes across Node.js and Python. Each
recipe includes both markdown documentation and runnable examples.
