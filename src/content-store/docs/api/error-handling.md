---
title: 'API Error Handling'
description: 'Standardized error handling for API endpoints'
pubDate: '2025-01-01'
author: 'Pixelated Empathy Team'
draft: false
toc: true
share: true
---

# API Error Handling

This document describes the standardized error handling system for API endpoints. The system provides consistent error responses across all API endpoints, making it easier for clients to handle errors.

## Error Response Format

All API errors follow a consistent JSON format:

```json
{
  "error": {
    "type": "error_type",
    "code": "error.code",
    "message": "Human-readable error message",
    "details": {
      // Additional error details specific to the error type
    }
  }
}
```

- **type**: A string identifying the general category of error (e.g., `validation_error`, `authentication_error`)
- **code**: A more specific error code with a namespaced format (e.g., `api.invalid_input`, `api.resource_not_found`)
- **message**: A human-readable description of the error
- **details**: An optional object containing additional information about the error

## HTTP Status Codes

API errors are mapped to appropriate HTTP status codes:

| Error Type                  | HTTP Status Code | Description                       |
| --------------------------- | ---------------- | --------------------------------- |
| `validation_error`          | 400              | Invalid input data                |
| `authentication_error`      | 401              | Authentication required or failed |
| `authorization_error`       | 403              | Insufficient permissions          |
| `not_found_error`           | 404              | Resource not found                |
| `method_not_allowed_error`  | 405              | HTTP method not allowed           |
| `conflict_error`            | 409              | Resource conflict                 |
| `rate_limit_error`          | 429              | Rate limit exceeded               |
| `internal_server_error`     | 500              | Server encountered an error       |
| `service_unavailable_error` | 503              | Service temporarily unavailable   |
| `database_error`            | 500              | Database error                    |
| `unknown_error`             | 500              | Unknown error                     |

## Common Error Codes

The following error codes are used across the API:

### Validation Errors (400)

| Code                         | Description                                |
| ---------------------------- | ------------------------------------------ |
| `api.invalid_input`          | General validation error for invalid input |
| `api.missing_required_field` | A required field is missing                |
| `api.invalid_format`         | Field has incorrect format                 |

### Authentication Errors (401)

| Code                      | Description                      |
| ------------------------- | -------------------------------- |
| `api.invalid_credentials` | Provided credentials are invalid |
| `api.expired_token`       | Authentication token has expired |
| `api.invalid_token`       | Authentication token is invalid  |

### Authorization Errors (403)

| Code                           | Description                     |
| ------------------------------ | ------------------------------- |
| `api.insufficient_permissions` | User lacks required permissions |
| `api.resource_forbidden`       | Access to resource is forbidden |

### Resource Errors (404/409)

| Code                          | Description                       |
| ----------------------------- | --------------------------------- |
| `api.resource_not_found`      | Requested resource does not exist |
| `api.resource_already_exists` | Resource already exists (409)     |
| `api.resource_conflict`       | Resource conflict (409)           |

### Rate Limiting (429)

| Code                      | Description                  |
| ------------------------- | ---------------------------- |
| `api.rate_limit_exceeded` | Rate limit has been exceeded |

### Method Errors (405)

| Code                     | Description                               |
| ------------------------ | ----------------------------------------- |
| `api.method_not_allowed` | HTTP method not allowed for this endpoint |

### Service Errors (503)

| Code                         | Description                        |
| ---------------------------- | ---------------------------------- |
| `api.service_unavailable`    | Service is temporarily unavailable |
| `api.dependency_unavailable` | A dependent service is unavailable |

### Database Errors (500)

| Code                     | Description                 |
| ------------------------ | --------------------------- |
| `api.database_error`     | General database error      |
| `api.transaction_failed` | Database transaction failed |

### Internal Errors (500)

| Code                   | Description           |
| ---------------------- | --------------------- |
| `api.internal_error`   | Internal server error |
| `api.unexpected_error` | Unexpected error      |

## Error Examples

### Validation Error

```json
{
  "error": {
    "type": "validation_error",
    "code": "api.invalid_input",
    "message": "Validation error",
    "details": {
      "invalidFields": {
        "email": "Invalid email format",
        "age": "Must be a positive number"
      }
    }
  }
}
```

### Authentication Error

```json
{
  "error": {
    "type": "authentication_error",
    "code": "api.invalid_credentials",
    "message": "Invalid username or password"
  }
}
```

### Resource Not Found Error

```json
{
  "error": {
    "type": "not_found_error",
    "code": "api.resource_not_found",
    "message": "User not found: 123",
    "details": {
      "resourceType": "User",
      "identifier": "123"
    }
  }
}
```

### Rate Limit Error

```json
{
  "error": {
    "type": "rate_limit_error",
    "code": "api.rate_limit_exceeded",
    "message": "Rate limit exceeded",
    "details": {
      "retryAfter": 60
    }
  }
}
```

## Using the Error Handling Utility

### For API Route Developers

Our codebase includes a utility for standardized error handling. Import and use it in your API endpoints like this:

```typescript
  createNotFoundError,
  createValidationError,
  handleAPIError,
  validateMethod,
} from '../lib/api/error-handling'

  try {
    // Validate HTTP method
    const methodValidation = validateMethod(request.method, ['GET'])
    if (methodValidation) return methodValidation

    // Get resource ID
    const { id } = params

    // Validate input
    if (!id) {
      return createValidationError('ID is required').toResponse()
    }

    // Find resource
    const resource = await findResourceById(id)

    // Handle not found
    if (!resource) {
      return createNotFoundError('Resource', id).toResponse()
    }

    // Return success response
    return new Response(JSON.stringify({ data: resource }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    // Handle all errors with the utility
    return handleAPIError(error)
  }
}
```

### Helper Functions

The utility includes several helper functions to create specific types of errors:

| Function                        | Description                                                 |
| ------------------------------- | ----------------------------------------------------------- |
| `createAPIError`                | Creates a generic API error                                 |
| `createValidationError`         | Creates a validation error with invalid fields              |
| `createNotFoundError`           | Creates a resource not found error                          |
| `createAuthenticationError`     | Creates an authentication error                             |
| `createAuthorizationError`      | Creates an authorization error                              |
| `createMethodNotAllowedError`   | Creates a method not allowed error                          |
| `createServiceUnavailableError` | Creates a service unavailable error                         |
| `createConflictError`           | Creates a resource conflict error                           |
| `createDatabaseError`           | Creates a database error                                    |
| `validateMethod`                | Validates HTTP method and returns error response if invalid |

## Client-Side Error Handling

When consuming the API in client-side code, you can handle errors like this:

```typescript
async function fetchResource(id: string) {
  try {
    const response = await fetch(`/api/resources/${id}`)

    if (!response.ok) {
      const errorData = await response.json()

      // Handle specific error types
      switch (errorData.error.code) {
        case 'api.resource_not_found':
          // Handle not found
          showNotFoundMessage(errorData.error.message)
          break
        case 'api.authentication_error':
          // Handle authentication error
          redirectToLogin()
          break
        case 'api.rate_limit_exceeded':
          // Handle rate limiting
          const retryAfter = errorData.error.details?.retryAfter || 60
          scheduleRetry(retryAfter)
          break
        default:
          // Handle other errors
          showErrorMessage(errorData.error.message)
      }

      return null
    }

    const data = await response.json()
    return data
  } catch (error) {
    // Handle network or parsing errors
    showErrorMessage('Unable to connect to the server')
    return null
  }
}
```

## Best Practices

When implementing API endpoints, follow these best practices for error handling:

1. **Always use the error utility:** Use the error handling utility for all API endpoints to ensure consistent error responses.

2. **Be specific with error types:** Choose the most specific error type and code that applies to the situation.

3. **Provide helpful messages:** Error messages should be clear, concise, and helpful. They should help the user understand what went wrong and how to fix it.

4. **Include relevant details:** Add relevant details to the error response to help clients understand and fix the issue.

5. **Validate input early:** Validate input as early as possible in the request handler to avoid unnecessary processing.

6. **Handle all errors:** Catch all exceptions and convert them to standardized error responses using `handleAPIError`.

7. **Don't expose sensitive information:** Be careful not to include sensitive information in error details.

8. **Log errors appropriately:** Log errors for monitoring and debugging purposes, but be mindful of sensitive data.

9. **Return appropriate status codes:** Ensure the HTTP status code in the response matches the error type.

10. **Document errors:** Document all possible error responses in your API documentation.

## Extending the Error System

To add new error types or codes:

1. Add the new error type to the `APIErrorType` enum in `src/lib/api/error-handling.ts`
2. Add the mapping to HTTP status code in the `errorTypeToStatusCode` object
3. Add the new error code to the `APIErrorCodes` object
4. Create a helper function for the new error type if appropriate
5. Update this documentation to include the new error type and code

## Handling Route Method Validation

For routes that only support specific HTTP methods, use the `validateMethod` function:

```typescript

  try {
    // Validate HTTP method - returns undefined if valid, Response if invalid
    const methodValidation = validateMethod(request.method, ['POST'])
    if (methodValidation) return methodValidation

    // Continue with request handling...
  } catch (error) {
    return handleAPIError(error)
  }
}
```

This function automatically sets the appropriate `Allow` header on the response for 405 Method Not Allowed errors.

## Conclusion

By using this standardized error handling system, we ensure that all API endpoints provide consistent and helpful error responses, making it easier for clients to handle errors and improving the overall developer experience.
