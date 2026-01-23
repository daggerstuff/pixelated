# User Registration Endpoint

## Overview
Adds a `POST /register` endpoint that validates input, creates a user record, and returns a JWT token.

## Endpoint
- **Method:** `POST /register`
- **URL:** `/register`

## Request Body
```json
{
  "email": "string (valid email format)",
  "password": "string (min 6 characters, max 128 characters)",
  "confirmPassword": "string (must match password)"
}
```

## Validation Rules
- Email must be a valid email address.
- Password must be at least 6 characters and at most 128 characters.
- `confirmPassword` must match `password`.

## Response
- **201 Created**: User created successfully.
  ```json
  {
    "token": "jwt-token-here"
  }
  ```
- **400 Bad Request**: Validation errors.
- **409 Conflict**: Email already registered.

## Error Codes
- `400` - Validation errors.
- `409` - Email already registered.

## Example
```bash
curl -X POST http://localhost:3000/register \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"secret123","confirmPassword":"secret123"}'
```

Response:
```json
{
  "token": "jwt-token-here"
}
```

## Testing
Run the test suite to verify the endpoint:
```bash
npm test
```