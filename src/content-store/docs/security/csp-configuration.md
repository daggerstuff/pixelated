---
title: "Content Security Policy (CSP) Configuration"
description: "Content Security Policy (CSP) Configuration documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation"]
draft: false
toc: true
---

# Content Security Policy (CSP) Configuration

## Overview

This document describes the Content Security Policy implementation for enhanced security against cross-site scripting (XSS) and data injection attacks.

## Security Improvements Made

### 1. Removed Broad Wildcards
- **Before**: `img-src` included `https:` wildcard allowing any HTTPS image source
- **After**: Specific trusted domains only for image sources
- **Before**: `connect-src` used wildcards like `*.supabase.co` and `*.upstash.io`
- **After**: Specific endpoints documented and reviewed

### 2. Structured Configuration
- Moved CSP from inline string to structured TypeScript configuration
- Added environment-specific policies (development vs production)
- Improved maintainability with categorized domain lists

### 3. Domain Categorization
The CSP is now organized by purpose:
- **AI/ML APIs**: OpenAI, Together.xyz, Replicate, etc.
- **Analytics & Monitoring**: Vercel, Google Analytics, Sentry
- **Authentication**: Google OAuth
- **CDN & Assets**: Fonts, images, static resources
- **Database**: Supabase connections (specific endpoints)

## Configuration File

The CSP configuration is located in `src/config/security.ts`:

```typescript
import { getCSP } from '@/config/security'

// Usage in Astro components
<meta http-equiv="Content-Security-Policy" content={getCSP()}>
```

## Adding New Domains

When adding new external services:

1. **Identify the purpose** of the new domain
2. **Add to the appropriate directive** in `src/config/security.ts`
3. **Use the most restrictive directive** possible
4. **Document the reason** for the addition with comments

### Common CSP Directives

- `script-src`: JavaScript sources
- `style-src`: CSS sources  
- `img-src`: Image sources
- `connect-src`: AJAX, WebSocket, and fetch() sources
- `font-src`: Font sources
- `media-src`: Audio/video sources

## Development vs Production

The configuration automatically handles environment differences:

- **Development**: Adds localhost endpoints for hot reloading
- **Production**: Strict policy with only necessary external domains

## Security Benefits

1. **Prevents XSS**: Blocks inline scripts and unauthorized external scripts
2. **Limits Data Exfiltration**: Restricts where data can be sent
3. **Reduces Attack Surface**: Only allows necessary external connections
4. **Provides Audit Trail**: Clear documentation of all allowed external resources

## Monitoring CSP Violations

CSP violations can be monitored through:
- Browser developer console
- Sentry error reporting (if configured)
- Server logs (when CSP reports are enabled)

## Testing

When testing new features:

1. Check browser console for CSP violation warnings
2. Test functionality in both development and production builds
3. Verify that all external resources load correctly
4. Monitor for any blocked requests

## Maintenance

Regular maintenance tasks:

1. **Review quarterly**: Remove unused domains
2. **Update on service changes**: When external services change endpoints
3. **Monitor violations**: Address any legitimate blocked requests
4. **Security audit**: Ensure minimum necessary permissions

## Troubleshooting

### Common Issues

1. **Resource blocked**: Add the domain to appropriate directive
2. **Inline scripts failing**: Consider using nonces or moving to external files
3. **Development features broken**: Check if dev-specific endpoints are needed

### Debugging Steps

1. Open browser developer tools
2. Check Console tab for CSP violations
3. Identify the blocked resource and its purpose
4. Add to appropriate CSP directive
5. Test in both dev and production environments

## Future Improvements

Consider implementing:

1. **Nonce-based CSP**: Replace `'unsafe-inline'` with nonces
2. **Report-Only mode**: Test new policies without breaking functionality
3. **Automated testing**: CSP validation in CI/CD pipeline
4. **Subresource Integrity**: Add integrity checks for external resources 