---
description: 'Comprehensive, technology-agnostic prompt for analyzing and documenting project folder structures. Auto-detects project types (.NET, Java, React, Angular, Python, Node.js, Flutter), generates detailed blueprints with visualization options, naming conventions, file placement patterns, and extension templates for maintaining consistent code organization across diverse technology stacks.'
mode: 'agent'
tools: ['codebase', 'search', 'editFiles', 'fetch', 'runCommands', 'runTasks', 'runTests', 'usages']
---
# Project Folder Structure Blueprint Generator

Analyze the current project folder structure and generate a detailed blueprint for optimal organization, naming conventions, file placement, and extension templates. Ensure the structure aligns with best practices for the detected technology stack (Astro, React, TypeScript, Python, etc.).

## Process

1. **Scan Project Folders**: List all top-level and nested folders, identifying technology indicators (e.g., astro.config.mjs, package.json, pyproject.toml).
2. **Detect Project Type**: Determine the main frameworks/languages in use (Astro, React, Python, etc.).
3. **Compare to Best Practices**: Reference official documentation and community standards for folder structure.
4. **Generate Blueprint**: Output a markdown blueprint with recommended folder hierarchy, naming conventions, and file placement for each technology detected.
5. **Highlight Issues**: Identify deviations from best practices and suggest improvements.
6. **Provide Extension Templates**: Offer templates for new folders/files to maintain consistency.
7. **Output**: Present the blueprint and recommendations in markdown format for easy review and implementation.

## Output Format

- **Folder Hierarchy Diagram** (mermaid or indented markdown)
- **Naming Conventions Table**
- **File Placement Guidelines**
- **Extension Templates**
- **Deviation Analysis & Recommendations**

## Example

```
project-root/
├── src/
│   ├── components/
│   ├── pages/
│   ├── layouts/
│   ├── lib/
│   └── styles/
├── public/
├── tests/
├── .github/
│   ├── prompts/
│   └── instructions/
├── package.json
├── astro.config.mjs
└── README.md
```

| Folder         | Purpose                                 | Naming Convention |
|---------------|-----------------------------------------|-------------------|
| components/   | Reusable UI components                  | PascalCase        |
| pages/        | Route-level pages                       | kebab-case        |
| layouts/      | Page layouts/templates                  | PascalCase        |
| lib/          | Utilities/shared logic                  | camelCase         |
| styles/       | Global and component styles             | kebab-case        |

## Next Steps

- Use this blueprint to refactor or create new folders/files.
- Apply recommended naming conventions and file placement.
- Review deviation analysis and address issues for improved maintainability.
