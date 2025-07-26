---
title: "Server-Side Authentication Security"
description: "Server-Side Authentication Security documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags: ["documentation", "authentication"]
draft: false
toc: true
---

# Server-Side Authentication Security

This document outlines the enhanced server-side authentication security features implemented in the application.

## Overview

The server-side authentication system provides:

1. **Strict token validation** - Enhanced cookie-based token validation
2. **Rate limiting** - Protection against brute force attacks
3. **IP verification** - Detects suspicious login locations
4. **User agent monitoring** - Alerts on unusual device changes
5. **Role-based access control** - Fine-grained permission enforcement
6. **Comprehensive audit logging** - Detailed security event tracking

## Implementation

The core implementation is in the `src/lib/auth/serverAuth.ts` file, which provides:

- `verifyServerAuth()` - Core authentication function with multiple security checks
- `protectRoute()` - Higher-order function that wraps Astro API routes
- `trackSuspiciousActivity()` - Utility for logging suspicious behaviors

## Usage

### Protecting API Routes

```typescript
import { protectRoute } from '../lib/auth/serverAuth'

// Basic protection - requires authentication
export const GET: APIRoute = protectRoute({})(
  async ({ locals }) => {
    const user = locals.user
    // Your route logic here
    return new Response(JSON.stringify({ data: 'success' }))
  }
)

// Role-based protection - requires specific role
export const POST: APIRoute = protectRoute({
  requiredRole: 'admin',
  validateIPMatch: true,
  validateUserAgent: true,
})(
  async ({ locals, request }) => {
    const admin = locals.user
    // Your admin-only logic here
    return new Response(JSON.stringify({ data: 'success' }))
  }
)
```

### Configuration Options

The `protectRoute()` function accepts the following options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `requiredRole` | `AuthRole` | `undefined` | Required role for accessing the route |
| `validateIPMatch` | `boolean` | `true` | Check if IP matches previous requests |
| `validateUserAgent` | `boolean` | `true` | Check if user agent matches previous requests |

### Manual Authentication

For custom authentication flows, use the `verifyServerAuth()` function directly:

```typescript
import { verifyServerAuth } from '../lib/auth/serverAuth'

async function customAuthFlow(context: APIContext) {
  const { cookies, request } = context
  const requestIp = request.headers.get('x-forwarded-for') || 'unknown'
  
  const { authenticated, user, reason } = await verifyServerAuth({
    cookies,
    request,
    requestIp,
    requiredRole: 'user',
  })
  
  if (!authenticated) {
    // Handle authentication failure
    console.log(`Auth failed: ${reason}`)
    return new Response('Unauthorized', { status: 401 })
  }
  
  // User is authenticated
  return user
}
```

## Security Features

### Rate Limiting

The system implements IP-based rate limiting to prevent brute force attacks:

- Maximum 5 failed auth attempts in 15 minutes
- IP is blocked for 1 hour after exceeding attempts
- Failed attempts are logged for security auditing

### IP Verification

The system tracks IP addresses and detects when a user logs in from a new location:

- Previous IP addresses are stored in Redis
- Changes trigger security alerts and audit logs
- Admins can review suspicious location changes

### User Agent Monitoring

Changes in device fingerprints are tracked:

- Browser and device information is stored
- Significant changes trigger security alerts
- Helps detect potential account takeovers

### Audit Logging

Comprehensive security events are logged:

- All authentication attempts (success/failure)
- Suspicious activity with detailed metadata
- IP and user agent changes
- Rate limit triggers and blocks

## Integration with Existing Auth

The server-side auth system builds on the existing authentication framework:

- Uses the same token validation mechanisms
- Extends with additional security features
- Fully compatible with existing auth middleware

## Best Practices

When implementing authentication:

1. **Always use `protectRoute()`** for API endpoints that require authentication
2. **Set appropriate roles** for admin-only functionality
3. **Check locals.user** instead of making redundant auth calls
4. **Handle auth errors** with appropriate status codes and messages
5. **Log security events** for auditing and monitoring

## Security Considerations

- Redis is used for rate limiting and session tracking
- IP and user agent data is stored for 7 days
- Security alerts are logged but don't block legitimate access
- Consider adding email notifications for suspicious events

## Testing

Unit tests are available in the `src/lib/auth/__tests__/serverAuth.test.ts` file, which tests:

- Authentication validation logic
- Role-based access control
- IP and user agent verification
- Rate limiting functionality

## Performance Impact

The enhanced security checks add minimal overhead:

- Redis operations are optimized for low latency
- Authentication results are not cached to ensure security
- Failed attempts have rate limiting applied
- Successful auth has quick pathway with minimal checks
