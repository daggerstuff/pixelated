---
title: "Authentication Types and Protected Routes"
description: "Authentication Types and Protected Routes documentation"
pubDate: 2024-01-15
author: "Pixelated Team"
tags:
  - documentation
  - authentication
draft: false
toc: true
---

# Authentication Types and Protected Routes

## Overview

This document explains the type system for protected API routes in our Astro application. We've created a type-safe approach for protecting routes with authentication and authorization checks.

## Key Components

### 1. Type Definitions

The type definitions are located in `src/lib/auth/apiRouteTypes.ts`:

```typescript
import type { APIContext, APIRoute } from 'astro'
import type { AuthRole } from '../../config/auth.config'
import type { AuthUser } from './types'

// Extended APIContext with auth user information
export interface AuthAPIContext<
  Props extends Record<string, any> = Record<string, any>,
  Params extends Record<string, string | undefined> = Record<string, string | undefined>
> extends APIContext<Props, Params> {
  locals: {
    user: AuthUser
    [key: string]: unknown
  }
}

// Protected API route handler function type
export type ProtectedAPIRoute<
  Props extends Record<string, any> = Record<string, any>,
  Params extends Record<string, string | undefined> = Record<string, string | undefined>
> = (context: AuthAPIContext<Props, Params>) => Response | Promise<Response>

// Options for protecting an API route
export interface ProtectRouteOptions {
  requiredRole?: AuthRole
  validateIPMatch?: boolean
  validateUserAgent?: boolean
}

// Higher-order function to apply protection to an API route
export type ProtectRouteFunction = <
  Props extends Record<string, any> = Record<string, any>,
  Params extends Record<string, string | undefined> = Record<string, string | undefined>
>(
  options: ProtectRouteOptions
) => (
  handler: (context: AuthAPIContext<Props, Params>) => Response | Promise<Response>
) => APIRoute
```

### 2. The `protectRoute` Function

The `protectRoute` function in `src/lib/auth/serverAuth.ts` is a higher-order function that adds authentication and authorization checks to API routes:

```typescript
export function protectRoute<
  Props extends Record<string, any> = Record<string, any>,
  Params extends Record<string, string | undefined> = Record<string, string | undefined>
>(
  options: ProtectRouteOptions
): (
  handler: (context: AuthAPIContext<Props, Params>) => Response | Promise<Response>
) => APIRoute {
  return (handler) => {
    const apiRouteHandler: APIRoute = async (context) => {
      // Authentication and authorization checks...
      
      // If authenticated, create auth context with user
      context.locals.user = user
      const authContext = context as unknown as AuthAPIContext<Props, Params>
      
      // Call the handler with the auth context
      return handler(authContext)
    }
    
    return apiRouteHandler
  }
}
```

## How to Use

### Protected API Routes

Here's how to create a protected API route with proper typings:

```typescript
import { protectRoute } from '../../../lib/auth/serverAuth'

export const GET = protectRoute({
  requiredRole: 'admin', // Optional: require specific role
  validateIPMatch: true,  // Optional: validate IP consistency
  validateUserAgent: true // Optional: validate user agent consistency
})(async ({ locals, request }) => {
  // Access the authenticated user from locals
  const user = locals.user
  
  // Your protected route logic here...
  
  return new Response(
    JSON.stringify({ success: true, data: /* your data */ }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
})
```

### Important Notes

1. The TypeScript type system now handles the context conversion automatically
2. The user object is available in `locals.user` and is properly typed
3. You can specify role requirements and additional security checks in the options

## Security Features

The `protectRoute` function provides several security features:

1. **Authentication Verification**: Ensures the user is authenticated.
2. **Role-Based Access Control**: Optional role requirement check.
3. **IP Verification**: Optional IP consistency check.
4. **User Agent Verification**: Optional user agent consistency check.
5. **Rate Limiting**: Protection against brute force attacks.
6. **Audit Logging**: Comprehensive logging of authentication events.

## Example

Here's a complete example of a protected API route:

```typescript
import { protectRoute } from '../../../lib/auth/serverAuth'
import { getLogger } from '../../../lib/logging'

const logger = getLogger('my-api')

export const GET = protectRoute({
  requiredRole: 'user',
  validateIPMatch: true,
})(async ({ locals, request }) => {
  try {
    const user = locals.user
    logger.info(`User ${user.id} accessed protected resource`)
    
    // Your API logic here
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Protected resource accessed successfully'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    logger.error('Error in protected route:', error)
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```
