# Auth0 Migration Guide

## Overview

This document provides a comprehensive guide for migrating from better-auth to Auth0 authentication system. The migration includes user data transfer, implementation of authentication services, role-based access control, social authentication, and security features.

## Migration Steps

### 1. Pre-Migration Preparation

#### Environment Setup
- Ensure all Auth0 environment variables are configured:
  - AUTH0_DOMAIN
  - AUTH0_CLIENT_ID
  - AUTH0_CLIENT_SECRET
  - AUTH0_AUDIENCE
  - AUTH0_MANAGEMENT_CLIENT_ID
  - AUTH0_MANAGEMENT_CLIENT_SECRET

#### Dependencies Installation
- Install required Auth0 SDKs:
  ```bash
  pnpm add auth0
  ```

#### Backup Current System
- Backup MongoDB user data
- Backup current authentication configuration
- Document current user roles and permissions

### 2. User Data Migration

#### MongoDB User Transfer
Run the MongoDB user migration script to transfer existing users to Auth0:

```bash
node scripts/migrate-users-to-auth0.js
```

This script will:
- Connect to MongoDB database
- Retrieve all existing users
- Create corresponding users in Auth0
- Map roles from MongoDB to Auth0 roles
- Preserve user metadata and preferences

#### Role Mapping
| MongoDB Role | Auth0 Role | Permissions |
|--------------|------------|-------------|
| admin | admin | Full system access |
| therapist | therapist | Patient management, session records |
| patient | patient | Personal health records, appointments |
| researcher | researcher | Analytics, research data |
| support | support | User support, basic administration |
| guest | guest | Limited public access |

### 3. Service Implementation

#### Auth0 Service Layer
The new authentication service (`src/services/auth0.service.ts`) replaces the MongoDB-based authentication:

```typescript
import { Auth0UserService } from './auth0.service';

const authService = new Auth0UserService();

// Sign in
const result = await authService.signIn(email, password);

// Create user
const newUser = await authService.createUser(email, password, role);

// Get user by ID
const user = await authService.getUserById(userId);
```

#### JWT Token Handling
JWT tokens are now managed through Auth0:

```typescript
import * as auth0JwtService from '../lib/auth/auth0-jwt-service';

// Validate token
const validationResult = await auth0JwtService.validateToken(token, tokenType);

// Refresh token
const refreshedTokens = await auth0JwtService.refreshAccessToken(refreshToken, context);

// Revoke token
await auth0JwtService.revokeToken(token, reason);
```

#### Role-Based Access Control
RBAC is implemented using Auth0 roles and permissions:

```typescript
import * as auth0RbacService from '../lib/auth/auth0-rbac-service';

// Assign role to user
await auth0RbacService.assignRoleToUser(userId, roleName);

// Check user permissions
const hasPermission = await auth0RbacService.userHasPermission(userId, permission);

// Get user roles
const roles = await auth0RbacService.getUserRoles(userId);
```

#### Social Authentication
Google OAuth integration is implemented:

```typescript
import { Auth0SocialAuthService } from '../lib/auth/auth0-social-auth-service';

const socialAuthService = new Auth0SocialAuthService();

// Generate authorization URL
const authUrl = socialAuthService.getGoogleAuthorizationUrl(redirectUri, state);

// Exchange code for tokens
const tokens = await socialAuthService.exchangeCodeForTokens(code, redirectUri);

// Complete authentication flow
const result = await socialAuthService.authenticate(code, redirectUri);
```

### 4. Middleware Updates

#### Authentication Middleware
Updated middleware uses Auth0 JWT validation:

```typescript
// src/middleware/auth.middleware.ts
import { authenticateRequest } from '../middleware/auth.middleware';

app.use('/api/*', authenticateRequest);
```

#### Role-Based Access Middleware
Middleware for checking user roles and permissions:

```typescript
// src/middleware/rbac.middleware.ts
import { requireRole, requirePermission } from '../middleware/rbac.middleware';

app.get('/admin/*', requireRole('admin'));
app.post('/api/patients/*', requirePermission('write:patients'));
```

### 5. Testing and Validation

#### Unit Tests
Comprehensive unit tests have been created for all Auth0 services:
- Auth0 User Service tests
- Auth0 JWT Service tests
- Auth0 RBAC Service tests
- Auth0 Social Auth Service tests

#### Integration Tests
Integration tests verify complete authentication workflows:
- Email/password authentication flow
- Social authentication flow
- JWT token validation and refresh
- Role-based access control
- Security features and logging

#### Manual Testing
Manual testing should verify:
- User sign in with existing credentials
- User registration
- Password reset flow
- Social login (Google)
- Role-based access to different features
- Session management
- Security event logging

## Rollback Plan

### When to Rollback
Rollback should be considered if:
- Critical authentication failures occur
- User data migration issues are detected
- Security vulnerabilities are identified
- Performance degradation is observed
- User experience is significantly impacted

### Rollback Steps

#### 1. Immediate Response
1. Disable new Auth0 authentication endpoints
2. Re-enable better-auth authentication endpoints
3. Redirect authentication requests to backup system
4. Notify system administrators and stakeholders

#### 2. Data Rollback
1. Restore MongoDB backup if user data was corrupted
2. Revert any user role changes made during migration
3. Restore original authentication configuration
4. Validate data integrity

#### 3. Service Rollback
1. Revert to better-auth service implementations:
   ```bash
   git checkout HEAD~1 -- src/services/auth.service.ts
   git checkout HEAD~1 -- src/lib/auth/
   ```
2. Restore original middleware:
   ```bash
   git checkout HEAD~1 -- src/middleware/auth.middleware.ts
   git checkout HEAD~1 -- src/middleware/rbac.middleware.ts
   ```
3. Reinstall better-auth dependencies:
   ```bash
   pnpm remove auth0
   pnpm add better-auth
   ```

#### 4. Configuration Rollback
1. Remove Auth0 environment variables
2. Restore better-auth configuration
3. Update application configuration files
4. Restart application services

#### 5. Validation
1. Verify authentication functionality with better-auth
2. Test user sign in with original credentials
3. Validate role-based access control
4. Confirm security event logging
5. Monitor system performance and stability

### Rollback Testing
Regular rollback testing should be performed:
- Monthly rollback drills
- Validation of backup restoration procedures
- Testing of service reversion processes
- Performance impact assessment of rollback

## Monitoring and Maintenance

### Post-Migration Monitoring
- Monitor authentication success/failure rates
- Track security event logs
- Monitor token validation and refresh activities
- Watch for unusual access patterns
- Monitor system performance metrics

### Maintenance Tasks
- Regular review of user roles and permissions
- Periodic audit of authentication logs
- Update of Auth0 SDKs and dependencies
- Review and update of security policies
- Performance optimization of authentication flows

## Troubleshooting

### Common Issues

#### Authentication Failures
- Verify Auth0 environment variables are correctly set
- Check Auth0 tenant configuration
- Validate client credentials
- Review Auth0 logs for error details

#### User Migration Issues
- Check MongoDB connection settings
- Verify user data format compatibility
- Review role mapping configuration
- Validate migrated user accounts

#### Token Validation Problems
- Check token signing configuration
- Verify audience and issuer settings
- Review token expiration policies
- Validate refresh token handling

#### RBAC Issues
- Confirm role definitions in Auth0
- Verify permission assignments
- Check role hierarchy configuration
- Review user role assignments

### Support Contacts
- Auth0 Support: https://support.auth0.com/
- System Administrator: [Contact Information]
- Development Team: [Contact Information]

## Conclusion

This migration guide provides a comprehensive roadmap for transitioning from better-auth to Auth0. By following these steps, you can ensure a smooth migration with minimal disruption to users while gaining the enhanced security and scalability features of Auth0.