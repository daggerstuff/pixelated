---
title: "Credential and PHI Management Guide"
description: "Credential and PHI Management Guide documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Credential and PHI Management Guide

This document outlines best practices for handling credentials and Protected Health Information (PHI) in the Pixelated Empathy codebase.

## Overview

As a healthcare application, Pixelated Empathy must maintain stringent security standards, particularly regarding:

1. **Credentials**: API keys, client IDs, secrets, tokens
2. **Protected Health Information (PHI)**: Patient identifiers, medical record numbers, etc.

This guide provides tools and practices to prevent accidental exposure of sensitive data.

## Tools Provided

### 1. Credential Cleanup Script

We provide a script (`scripts/clean-credentials.js`) to detect and remediate hardcoded credentials:

```bash
# To check for hardcoded credentials without modifying files
node scripts/clean-credentials.js --check-only

# To automatically replace hardcoded credentials with environment variables
node scripts/clean-credentials.js
```

The script:
- Scans for hardcoded credentials and PHI in code files
- Replaces direct values with environment variable references
- Provides special handling for documentation files
- Generates reports of findings

### 2. GitLeaks Configuration

The `.gitleaks.toml` file is configured to detect and prevent accidental credential commits. It:
- Scans for various credential patterns
- Applies appropriate allowlists for test files and example values
- Functions as a pre-commit check in CI/CD pipelines

## Best Practices

### Using Environment Variables

Always use environment variables for sensitive values:

```typescript
// ❌ Bad - hardcoded credentials
const clientId = process.env.CLIENT_ID || "example-client-id";

// ✅ Good - environment variables with fallback for development
const clientId = process.env.CLIENT_ID || "example-client-id";
```

### Documentation Examples

When showing code examples in documentation:

```mdx
// ❌ Bad - realistic-looking credentials
$1=YOUR_API_KEY_HERE

// ✅ Good - obvious placeholder
$1=YOUR_API_KEY_HERE
```

### PHI Handling

For PHI data:

1. Never hardcode real patient identifiers
2. Use environment variables or secure data stores
3. Mark PHI fields clearly in type definitions

```typescript
interface PatientRecord {
  // Clearly marked as PHI
  /** @PHI - Patient identifier */
  patientId: string;

  // Non-PHI data
  recordCount: number;
}
```

## Pre-Commit and CI/CD Validation

Our GitHub Actions workflows include:

1. Secret scanning using GitLeaks
2. PHI detection using specialized tools
3. Automated credential cleanup checks

When these scans identify potential issues:
1. Review the generated reports
2. Run the cleanup script if appropriate
3. Update allowlists for legitimate false positives

## Required Environment Variables

The following environment variables should be defined in your `.env` file (and added to deployment environments):

```
# API Keys
$1=YOUR_API_KEY_HERE

# OAuth Credentials
CLIENT_ID=your_client_id_here
CLIENT_SECRET=your_client_secret_here

# Development PHI
PATIENT_ID=example-patient-id
```

## Questions and Support

If you have questions about credential security or encounter issues with the scanning tools, please contact the security team.

# Credential Management Report

## Summary
- Date: 2025-05-05T23:51:07.668Z
- Environment files checked: 2

## Environment Variables Status

### API VARIABLES
| Variable | Development | Production | Test | Description |
|----------|-------------|------------|------|-------------|
| API_KEY | ✅ | ❌ | ❌ | API key for general authentication |
| TOGETHER_API_KEY | ✅ | ✅ | ❌ | API key for Together.ai services |
| ANTHROPIC_API_KEY | ❌ | ❌ | ❌ | API key for Anthropic AI services |
| OPENAI_API_KEY | ❌ | ❌ | ❌ | API key for OpenAI services |

### OAUTH VARIABLES
| Variable | Development | Production | Test | Description |
|----------|-------------|------------|------|-------------|
| CLIENT_ID | ✅ | ❌ | ❌ | OAuth client ID for authentication |
| CLIENT_SECRET | ✅ | ❌ | ❌ | OAuth client secret for authentication |
| OAUTH_REDIRECT_URI | ❌ | ❌ | ❌ | OAuth redirect URI |

### SECURITY VARIABLES
| Variable | Development | Production | Test | Description |
|----------|-------------|------------|------|-------------|
| ENCRYPTION_KEY | ❌ | ❌ | ❌ | Key for data encryption |
| CSRF_SECRET | ❌ | ❌ | ❌ | Secret for CSRF protection |

### PHI VARIABLES
| Variable | Development | Production | Test | Description |
|----------|-------------|------------|------|-------------|
| PHI_ENCRYPTION_KEY | ❌ | ❌ | ❌ | Key for PHI data encryption |

### DATABASE VARIABLES
| Variable | Development | Production | Test | Description |
|----------|-------------|------------|------|-------------|
| SUPABASE_URL | ✅ | ✅ | ❌ | URL for Supabase connection |
| SUPABASE_KEY | ❌ | ❌ | ❌ | Supabase service key |

### MONITORING VARIABLES
| Variable | Development | Production | Test | Description |
|----------|-------------|------------|------|-------------|
| SENTRY_DSN | ✅ | ✅ | ❌ | Sentry monitoring DSN |

### EMAIL VARIABLES
| Variable | Development | Production | Test | Description |
|----------|-------------|------------|------|-------------|
| SMTP_HOST | ❌ | ❌ | ❌ | SMTP server host |
| SMTP_PORT | ❌ | ❌ | ❌ | SMTP server port |
| SMTP_USER | ❌ | ❌ | ❌ | SMTP authentication username |
| SMTP_PASSWORD | ❌ | ❌ | ❌ | SMTP authentication password |
| EMAIL_FROM | ✅ | ✅ | ❌ | Default sender email address |

## Missing Required Variables

### DEVELOPMENT
- SMTP_HOST: SMTP server host
- SMTP_PORT: SMTP server port
- SMTP_USER: SMTP authentication username
- SMTP_PASSWORD: SMTP authentication password

### PRODUCTION
- SMTP_HOST: SMTP server host
- SMTP_PORT: SMTP server port
- SMTP_USER: SMTP authentication username
- SMTP_PASSWORD: SMTP authentication password

## Recommendations

1. **Credentials Storage:**
   - Store all credentials in environment variables
   - Never commit .env files to version control
   - Use different .env files for different environments (.env.local, .env.production)

2. **Sensitive Data Handling:**
   - Use the `clean-credentials.js` script to scan for hardcoded credentials
   - Encrypt PHI data at rest and in transit
   - Implement proper access controls for sensitive data

3. **HIPAA Compliance:**
   - Enable proper audit logging for PHI access
   - Use role-based access control
   - Implement automatic session timeout
   - Secure encrypted backups

4. **Deployment:**
   - Set environment variables securely in your deployment platform
   - Validate environment variables on application startup
   - Rotate credentials regularly