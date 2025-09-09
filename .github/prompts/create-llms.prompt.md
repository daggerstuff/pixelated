---
mode: 'agent'
description: 'Create an llms.txt file from scratch based on repository structure following the llms.txt specification at https://llmstxt.org/'
tools: ['changes', 'codebase', 'editFiles', 'extensions', 'fetch', 'githubRepo', 'openSimpleBrowser', 'problems', 'runTasks', 'search', 'searchResults', 'terminalLastCommand', 'terminalSelection', 'testFailure', 'usages', 'vscodeAPI']
---
# Create LLMs.txt File from Repository Structure

Create a new `llms.txt` file from scratch in the root of the repository following the official llms.txt specification at [llms.txt specification](https://llmstxt.org/). This file provides high-level guidance to large language models (LLMs) on where to find relevant content for understanding the repository's purpose and specifications.

## Primary Directive

Create a comprehensive `llms.txt` file that serves as an entry point for LLMs to understand and navigate the repository effectively. The file must comply with the llms.txt specification and be optimized for LLM consumption while remaining human-readable.

## Analysis and Planning Phase

Before creating the `llms.txt` file, you must complete a thorough analysis:

### Step 1: Review llms.txt Specification

- Review the official specification at [llms.txt specification](https://llmstxt.org/) to ensure full compliance
- Understand the required format structure and guidelines
- Note the specific markdown structure requirements

### Step 2: Repository Structure Analysis

- Examine the complete repository structure using appropriate tools
- Identify the primary purpose and scope of the repository
- Catalog all important directories and their purposes
- List key files that would be valuable for LLM understanding

### Step 3: Content Discovery

- Identify README files and their locations
- Find documentation files (`.md` files in `/docs/`, `/spec/`, etc.)
- Locate specification files and their purposes
- Discover configuration files and their relevance
- Find example files and code samples
- Identify any existing documentation structure

### Step 4: Create Implementation Plan

Based on your analysis, create a structured plan that includes:

- Repository purpose and scope summary
- Priority-ordered list of essential files for LLM understanding
- Secondary files that provide additional context
- Organizational structure for the llms.txt file

## Implementation Requirements

### Format Compliance

The `llms.txt` file must follow this exact structure per the specification:

1. **H1 Header**: Single line with repository/project name (required)
2. **Blockquote Summary**: Brief description in blockquote format (optional but recommended)
3. **Additional Details**: Zero or more markdown sections without headings for context
4. **File List Sections**: Zero or more H2 sections containing markdown lists of links

### Content Requirements

#### Required Elements

- **Project Name**: Clear, descriptive title as H1
- **Summary**: Concise blockquote explaining the repository's purpose
- **Key Files**: Essential files organized by category (H2 sections)

#### File Link Format

Each file link must follow: `[descriptive-name](relative-url): optional description`

#### Section Organization

Organize files into logical H2 sections such as:

- **Documentation**: Core documentation files
- **Specifications**: Technical specifications and requirements
- **Examples**: Sample code and usage examples
- **Configuration**: Setup and configuration files
- **Optional**: Secondary files (special meaning - can be skipped for shorter context)

### Content Guidelines

#### Language and Style

- Use concise, clear, unambiguous language
- Avoid jargon without explanation
- Write for both human and LLM readers
- Be specific and informative in descriptions

#### File Selection Criteria

Include files that:
- Explain the repository's purpose and scope
- Provide essential technical documentation
- Show usage examples and patterns
- Define interfaces and specifications
- Contain configuration and setup instructions

Exclude files that:
- Are purely implementation details
- Contain redundant information
- Are build artifacts or generated content
- Are not relevant to understanding the project

## Execution Steps

### Step 1: Repository Analysis

1. Examine the repository structure completely
2. Read the main README.md to understand the project
3. Identify all documentation directories and files
4. Catalog specification files and their purposes
5. Find example files and configuration files

### Step 2: Content Planning

1. Determine the primary purpose statement
2. Write a concise summary for the blockquote
3. Group identified files into logical categories
4. Prioritize files by importance for LLM understanding
5. Create descriptions for each file link

### Step 3: File Creation

1. Create the `llms.txt` file in the repository root
2. Follow the exact format specification
3. Include all required sections
4. Use proper markdown formatting
5. Ensure all links are valid relative paths

### Step 4: Validation
1. Verify compliance with [llms.txt specification](https://llmstxt.org/) 
2. Check that all links are valid and accessible
3. Ensure the file serves as an effective LLM navigation tool
4. Confirm the file is both human and machine readable

## Quality Assurance

### Format Validation

- ✅ H1 header with project name
- ✅ Blockquote summary (if included)
- ✅ H2 sections for file lists
- ✅ Proper markdown link format
- ✅ No broken or invalid links
- ✅ Consistent formatting throughout

### Content Validation

- ✅ Clear, unambiguous language
- ✅ Comprehensive coverage of essential files
- ✅ Logical organization of content
- ✅ Appropriate file descriptions
- ✅ Serves as effective LLM navigation tool

### Specification Compliance

- ✅ Follows [llms.txt specification](https://llmstxt.org/) format exactly
- ✅ Uses required markdown structure
- ✅ Implements optional sections appropriately
- ✅ File located at repository root (`/llms.txt`)

## Example Structure Template

```txt
# Pixelated - AI-Powered Mental Health & Empathy Platform

> Comprehensive full-stack Astro application focused on AI-powered mental health support, empathy training, and bias detection with HIPAA-compliant security.

## Documentation

- [Project README](../../README.md): Primary project overview, setup instructions, and development workflow
- [Project Documentation](../../docs/PERFORMANCE_OPTIMIZATION.md): Detailed project structure, architecture, and best practices

## Configuration

- [Astro Configuration](../../astro.config.mjs): Main Astro configuration with SSR setup
- [Package Dependencies](../../package.json): Dependencies and npm scripts
- [TypeScript Config](../../tsconfig.json): TypeScript configuration settings
- [UnoCSS Config](../../uno.config.ts): Styling configuration with UnoCSS

## Core Implementation

- [AI Services](../../src/lib/ai/index.ts): AI integration including OpenAI, Google GenAI, and bias detection models
- [Authentication Utils](../../src/lib/auth/index.ts): Clerk-based authentication utilities
- [Security Module](../../src/lib/security.ts): HIPAA-compliant security and FHE support
- [Redis Caching](../../src/lib/redis.ts): Session and performance caching implementation

## Deployment & DevOps

- [Docker Compose](../../docker-compose.yml): Development environment orchestration
- [Deployment Docs](../../docs/DUAL_DEPLOYMENT_GUIDE.md): Production deployment guidelines and infrastructure docs
```

## Success Criteria

The created `llms.txt` file should:
1. Enable LLMs to quickly understand the repository's purpose
2. Provide clear navigation to essential documentation
3. Follow the official llms.txt specification exactly
4. Be comprehensive yet concise
5. Serve both human and machine readers effectively
6. Include all critical files for project understanding
7. Use clear, unambiguous language throughout
8. Organize content logically for easy consumption
