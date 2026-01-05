---
title: 'Authentication'
description: 'Understanding Pixelated authentication and authorization system'
pubDate: '2025-01-01'
author: 'Pixelated Empathy Team'
draft: false
toc: true
share: true
---

## Overview

Pixelated uses Supabase Auth for secure user authentication and authorization.
This system provides robust security features while maintaining a smooth user
experience.

## Authentication Flow

## Authentication Methods

### Email and Password

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password',
})
```

### Magic Link

```typescript
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'user@example.com',
})
```

### OAuth Providers

```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
})
```

## Session Management

### Token Lifecycle

1. **Access Token**
   - JWT format
   - Short expiration (1 hour)
   - Contains user claims

2. **Refresh Token**
   - Long-lived (7 days)
   - Used to obtain new access tokens
   - Secure storage required

### Session Refresh

```typescript
const { data, error } = await supabase.auth.refreshSession()
```

## Authorization

### Role-Based Access Control

Available roles:

- `client`: Regular user role
- `therapist`: Professional role
- `admin`: System administrator

### Row Level Security

```sql
-- Example RLS policy for sessions
CREATE POLICY "Users can only access their own sessions"
ON sessions
FOR SELECT
USING (
  auth.uid() = user_id
);
```

## Security Features

### Password Requirements

- Minimum 8 characters
- At least one uppercase letter
- At least one number
- At least one special character

### Rate Limiting

```typescript
const rateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
})
```

### JWT Configuration

```typescript
const jwtConfig = {
  expiresIn: '1h',
  algorithm: 'RS256',
  audience: 'https://api.gemcity.xyz',
}
```

## Error Handling

### Common Authentication Errors

```typescript
try {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    switch (error.status) {
      case 400:
        // Invalid credentials
        break
      case 429:
        // Too many requests
        break
      default:
      // Other errors
    }
  }
} catch (err) {
  // Handle unexpected errors
}
```

## Security Best Practices

### Client-Side

1. **Token Storage**
   - Use secure storage (httpOnly cookies)
   - Clear on logout
   - Refresh automatically

2. **Input Validation**
   - Sanitize user input
   - Validate email format
   - Check password strength

3. **Error Messages**
   - Generic error messages
   - No sensitive information
   - User-friendly guidance

### Server-Side

1. **Request Validation**
   - Validate all inputs
   - Check content types
   - Verify token signatures

2. **Session Management**
   - Secure session storage
   - Proper timeout handling
   - Concurrent session limits

3. **Audit Logging**
   - Log authentication attempts
   - Track suspicious activity
   - Monitor rate limits

## Implementation Guide

### Frontend Setup

1. Initialize MongoDB Auth Service:

```typescript
import { mongoAuthService } from '@/services/mongoAuth.service'

// Create auth session
const session = await mongoAuthService.signIn(email, password)
```

2. Create Auth Context:

```typescript
const AuthContext = createContext<{
  user: User | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}>()
```

3. Implement Protected Routes:

```typescript
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth()

  if (!user) {
    return <Navigate to="/login" />
  }

  return children
}
```

### Backend Setup

1. Configure Middleware:

```typescript
app.use(async (req, rest, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) throw new Error('No token provided')

    const { user, error } = await supabase.auth.getUser(token)
    if (error) throw error

    req.user = user
    next()
  } catch (error) {
    rest.status(401).json({ error: 'Unauthorized' })
  }
})
```

2. Implement Role Checks:

```typescript
const requireRole = (role: string) => {
  return (req, rest, next) => {
    if (req.user?.role !== role) {
      return rest.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}
```

## Next Steps

```jsx
// Card components defined in a separate file
)

)
```

    Learn about session management
    View authentication API endpoints
    Review security measures
