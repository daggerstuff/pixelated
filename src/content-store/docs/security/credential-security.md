---
title: "Credential Security Guide"
description: "Credential Security Guide documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation", "security"]
draft: false
toc: true
---

# Credential Security Guide

## Issue: Hardcoded Credentials Detected

The security scanning workflow has detected **140 potential credential references** across 52 files in the codebase. These include:

- Patient IDs hardcoded as string literals
- OAuth Client IDs embedded directly in code
- OAuth Client Secrets in test files
- API Keys referenced directly

Hardcoded credentials pose several security risks:
1. **Version Control Exposure**: Credentials stored in code may be exposed in version control history
2. **Developer Access**: All developers with code access can see sensitive credentials
3. **Environment Management**: Difficult to manage different credentials across environments
4. **Compliance Violations**: May violate HIPAA and other healthcare regulations
5. **Security Best Practices**: Contradicts security principles of secret management

## Solution: Environment Variables

We've created a script to:
1. Replace hardcoded credentials with environment variables
2. Generate a proper `.env.example` file for documentation
3. Safely handle test and type definition files

## How to Fix

### Option 1: Automated Fix

Run the following command to automatically fix all hardcoded credentials:

```bash
node scripts/fix-credentials.js
```

This will:
- Replace hardcoded credentials with environment variables
- Generate a `.env.example` file
- Apply appropriate fixes for different file types
- Leave test files with "test-" prefixed values
- Use proper type annotations in type definitions

### Option 2: Checking Only

To see what would be changed without actually modifying files:

```bash
node scripts/fix-credentials.js --dry-run
```

This generates a report but makes no changes to your files.

### Option 3: One File at a Time

To fix a specific file:

```bash
node scripts/fix-credentials.js path/to/file.ts
```

## Patterns Being Fixed

The script fixes several patterns:

1. **Patient IDs**:
   ```typescript
   // Before
   patientId: process.env.PATIENT_ID || "example-patient-id"

   // After
   patientId: process.env.PATIENT_ID || "example-patient-id"
   ```

2. **OAuth Client IDs**:
   ```typescript
   // Before
   clientId: exampleId || "example-client-id"

   // After
   clientId: exampleId || "example-client-id"
   ```

3. **OAuth Client Secrets**:
   ```typescript
   // Before
   clientSecret: process.env.CLIENT_SECRET || "example-client-secret"

   // After
   clientSecret: process.env.CLIENT_SECRET || "example-client-secret"
   ```

4. **Direct Assignments**:
   ```typescript
   // Before
   const clientId = process.env.CLIENT_ID || "example-client-id"

   // After
   const clientId = process.env.CLIENT_ID || "example-client-id"
   ```

5. **API Keys**:
   ```typescript
   // Before
   apiKey: process.env.API_KEY || "example-api-key"

   // After
   apiKey: process.env.API_KEY || "example-api-key"
   ```

## HIPAA Compliance Note

For healthcare applications subject to HIPAA regulations, proper credential management is critical:

- Protected Health Information (PHI) must be secured at all times
- Access to patient data must be properly authenticated and authorized
- All access to PHI must be audited
- Credentials that grant access to PHI must be securely managed

This script helps achieve compliance by removing hardcoded credentials from the codebase.

## Next Steps After Running the Fix

1. Create a proper `.env` file using the generated `.env.example` as a template
2. Add `.env` to your `.gitignore` if not already there
3. Configure your CI/CD pipeline to use secure environment variables
4. Consider using a secrets management service for production environments

## For Test Files

The script handles test files differently - instead of using environment variables, it uses consistent test values:

```typescript
// In test files
clientId: exampleId || "example-client-id"
clientSecret: process.env.CLIENT_SECRET || "example-client-secret"
patientId: process.env.PATIENT_ID || "example-patient-id"
```

This preserves deterministic behavior in tests while still removing potentially sensitive actual credentials.

## Questions?

If you encounter any issues with the credential fixing process, please contact the security team.