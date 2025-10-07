---
title: 'API Security Features'
description: 'API Security Features documentation'
pubDate: 2024-01-15
author: 'Pixelated Team'
tags: ['documentation', 'security']
draft: false
toc: true
---

# API Security Features

This document outlines the security features implemented in our API endpoints.

## Rate Limiting

Our API implements rate limiting to prevent abuse and ensure fair usage of resources. The rate limits are enforced using a Redis-based implementation for distributed environments.

### Rate Limits by Role

Different rate limits apply based on user roles:

| Role      | General API | AI Endpoints | Auth Endpoints |
| --------- | ----------- | ------------ | -------------- |
| Admin     | 300/min     | 120/min      | 30/min         |
| Therapist | 200/min     | 80/min       | 30/min         |
| User      | 100/min     | 40/min       | 20/min         |
| Anonymous | 30/min      | 10/min       | 5/min          |

### Rate Limit Headers

All API responses include the following rate limit headers:

- `X-RateLimit-Limit`: The maximum number of requests allowed per window
- `X-RateLimit-Remaining`: The number of requests remaining in the current window
- `X-RateLimit-Reset`: The time when the rate limit window resets (Unix timestamp)

When rate limits are exceeded, the API returns a `429 Too Many Requests` response with a `Retry-After` header indicating when to retry.

## CORS (Cross-Origin Resource Sharing)

Our API implements strict CORS policies to ensure secure cross-origin communication.

### Development Environment

Allowed origins in development:

- `http://localhost:3000`
- `http://localhost:3000`
- `http://localhost:4321` (Astro dev server)

### Production Environment

Allowed origins in production:

- `https://app.yourdomain.com`
- `https://api.yourdomain.com`
- `https://admin.yourdomain.com`
- `https://*.yourdomain.com` (Subdomains)

### CORS Headers

The following headers are supported:

#### Allowed Headers

- `Content-Type`
- `Authorization`
- `Accept`
- `X-Requested-With`
- `X-Request-ID`

#### Exposed Headers

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `X-Request-ID`

### Security Headers

All API responses include the following security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

## Error Handling

### Rate Limit Errors

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later."
}
```

### CORS Errors

```json
{
  "error": "Forbidden",
  "message": "Origin not allowed"
}
```

### Server Errors

```json
{
  "error": "Internal Server Error",
  "message": "An error occurred while processing the request"
}
```

## Best Practices

1. **Authentication**: Always include a valid `Authorization` header for authenticated endpoints.
2. **Rate Limits**: Implement proper rate limit handling in your client applications.
3. **Error Handling**: Handle rate limit and CORS errors gracefully in your applications.
4. **Request IDs**: Include `X-Request-ID` in requests to help with request tracing.

## Monitoring and Logging

All security-related events are logged, including:

- Unauthorized CORS attempts
- Rate limit violations
- Authentication failures
- Server errors

Logs include relevant context such as:

- Request path
- HTTP method
- Origin
- Headers
- Error details (when applicable)

## Configuration

The security configuration can be customized through environment variables:

```bash
# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com,https://api.yourdomain.com
CORS_MAX_AGE=86400

# Security
HSTS_MAX_AGE=31536000
HSTS_INCLUDE_SUBDOMAINS=true
```

## Future Improvements

1. **API Key Management**: Implementation of API key-based rate limiting
2. **IP-based Rate Limiting**: Additional rate limiting based on IP addresses
3. **Geo-blocking**: Region-based access control
4. **Request Signing**: Request signature verification for enhanced security
5. **OAuth2 Integration**: Support for OAuth2 authorization

# API Security Features

This document outlines the security features implemented in our API endpoints.

## Rate Limiting

Our API implements rate limiting to prevent abuse and ensure fair usage of resources. The rate limits are enforced using a Redis-based implementation for distributed environments.

### Rate Limits by Role

Different rate limits apply based on user roles:

| Role      | General API | AI Endpoints | Auth Endpoints |
| --------- | ----------- | ------------ | -------------- |
| Admin     | 300/min     | 120/min      | 30/min         |
| Therapist | 200/min     | 80/min       | 30/min         |
| User      | 100/min     | 40/min       | 20/min         |
| Anonymous | 30/min      | 10/min       | 5/min          |

### Rate Limit Headers

All API responses include the following rate limit headers:

- `X-RateLimit-Limit`: The maximum number of requests allowed per window
- `X-RateLimit-Remaining`: The number of requests remaining in the current window
- `X-RateLimit-Reset`: The time when the rate limit window resets (Unix timestamp)

When rate limits are exceeded, the API returns a `429 Too Many Requests` response with a `Retry-After` header indicating when to retry.

## CORS (Cross-Origin Resource Sharing)

Our API implements strict CORS policies to ensure secure cross-origin communication.

### Development Environment

Allowed origins in development:

- `http://localhost:3000`
- `http://localhost:3000`
- `http://localhost:4321` (Astro dev server)

### Production Environment

Allowed origins in production:

- `https://app.yourdomain.com`
- `https://api.yourdomain.com`
- `https://admin.yourdomain.com`
- `https://*.yourdomain.com` (Subdomains)

### CORS Headers

The following headers are supported:

#### Allowed Headers

- `Content-Type`
- `Authorization`
- `Accept`
- `X-Requested-With`
- `X-Request-ID`

#### Exposed Headers

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `X-Request-ID`

### Security Headers

All API responses include the following security headers:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

## Error Handling

### Rate Limit Errors

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. Please try again later."
}
```

### CORS Errors

```json
{
  "error": "Forbidden",
  "message": "Origin not allowed"
}
```

### Server Errors

```json
{
  "error": "Internal Server Error",
  "message": "An error occurred while processing the request"
}
```

## Best Practices

1. **Authentication**: Always include a valid `Authorization` header for authenticated endpoints.
2. **Rate Limits**: Implement proper rate limit handling in your client applications.
3. **Error Handling**: Handle rate limit and CORS errors gracefully in your applications.
4. **Request IDs**: Include `X-Request-ID` in requests to help with request tracing.

## Monitoring and Logging

All security-related events are logged, including:

- Unauthorized CORS attempts
- Rate limit violations
- Authentication failures
- Server errors

Logs include relevant context such as:

- Request path
- HTTP method
- Origin
- Headers
- Error details (when applicable)

## Configuration

The security configuration can be customized through environment variables:

```bash
# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com,https://api.yourdomain.com
CORS_MAX_AGE=86400

# Security
HSTS_MAX_AGE=31536000
HSTS_INCLUDE_SUBDOMAINS=true
```

## Future Improvements

1. **API Key Management**: Implementation of API key-based rate limiting
2. **IP-based Rate Limiting**: Additional rate limiting based on IP addresses
3. **Geo-blocking**: Region-based access control
4. **Request Signing**: Request signature verification for enhanced security
5. **OAuth2 Integration**: Support for OAuth2 authorization
