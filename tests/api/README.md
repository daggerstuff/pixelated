# API Test Coverage

This directory contains comprehensive API tests for the Pixelated Empathy platform.

## Structure

- `api-endpoints.spec.ts` - Main API test suite covering all endpoints
- `api.config.json` - Configuration for API testing
- `utils/APITestUtils.ts` - Utility functions for API testing
- `README.md` - This documentation file

## Test Categories

### Authentication API
- User login/logout
- User registration
- Token validation and refresh
- Session management

### User Management API
- Profile retrieval and updates
- Account deletion
- User preferences
- Session management

### Chat API
- Conversation management
- Message sending and retrieval
- Chat history and search
- Real-time messaging

### AI Service API
- Text analysis and processing
- AI response generation
- Model management
- Feedback collection

### Analytics API
- Dashboard metrics
- Event tracking
- Report generation
- Usage analytics

### File Upload API
- File upload and storage
- File retrieval and download
- File deletion and management
- Metadata handling

### Error Handling
- Authentication errors (401)
- Validation errors (400)
- Not found errors (404)
- Rate limiting (429)
- Server errors (500)

### Performance Testing
- Response time validation
- Concurrent request handling
- Load testing
- Rate limit testing

### Security Testing
- SQL injection prevention
- XSS attack prevention
- CSRF protection
- Input validation
- File upload security

## Running API Tests

### Prerequisites
```bash
# Ensure the API server is running
npm run dev

# Install test dependencies
npm install
```

### Run All API Tests
```bash
pnpm dlx playwright test tests/api
```

### Run Specific Test Categories
```bash
# Authentication tests only
pnpm dlx playwright test tests/api --grep "Authentication API"

# Performance tests only
pnpm dlx playwright test tests/api --grep "Performance Tests"

# Security tests only
pnpm dlx playwright test tests/api --grep "Security"
```

### Run with Different Environments
```bash
# Test against staging
API_BASE_URL=https://staging.pixelatedempathy.com pnpm dlx playwright test tests/api

# Test against production (read-only tests)
API_BASE_URL=https://pixelatedempathy.com pnpm dlx playwright test tests/api --grep "GET"
```

## Configuration

The `api.config.json` file contains:

- **Endpoints**: All API endpoint definitions
- **Test Data**: Sample data for testing
- **Performance Thresholds**: Response time and load limits
- **Error Scenarios**: Expected error responses
- **Security Tests**: Security validation configurations
- **Monitoring**: Performance and error tracking settings

## Test Data Management

### Automatic Cleanup
- Test users are automatically created and cleaned up
- Test conversations and files are removed after tests
- No persistent test data remains after test completion

### Test User Creation
```typescript
// Create a test user for testing
const token = await apiUtils.createTestUser({
  email: 'custom@test.com',
  password: 'customPassword123',
  name: 'Custom Test User'
});
```

### Test Data Generation
```typescript
// Generate test data
const userData = APITestUtils.generateTestData('user');
const messageData = APITestUtils.generateTestData('message');
const fileData = APITestUtils.generateTestData('file');
```

## Performance Monitoring

### Response Time Tracking
```typescript
const { result, responseTime } = await APITestUtils.measureResponseTime(
  () => request.get('/api/user/profile')
);
expect(responseTime).toBeLessThan(1000); // Should respond within 1 second
```

### Concurrent Request Testing
```typescript
const requests = Array.from({ length: 10 }, () => 
  () => request.get('/api/user/profile')
);
const results = await APITestUtils.batchRequests(requests, 5);
```

## Security Validation

### XSS Prevention Testing
```typescript
await request.post('/api/chat/messages', {
  data: {
    content: '<script>alert("xss")</script>',
    conversationId: 'test_conv'
  }
});
// Verify script is escaped, not executed
```

### SQL Injection Prevention
```typescript
await request.post('/api/auth/login', {
  data: {
    email: "admin'; DROP TABLE users; --",
    password: 'password'
  }
});
// Should return validation error, not execute SQL
```

### Rate Limiting Validation
```typescript
// Make rapid requests to trigger rate limiting
const promises = Array.from({ length: 100 }, () =>
  request.get('/api/user/profile')
);
const responses = await Promise.all(promises);
const rateLimited = responses.filter(r => r.status() === 429);
expect(rateLimited.length).toBeGreaterThan(0);
```

## Error Handling

### Expected Error Responses
All API endpoints are tested for proper error handling:

- **400 Bad Request**: Invalid input data
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource doesn't exist
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server-side errors

### Error Response Format
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation error details"
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

## Reporting

### HTML Reports
```bash
pnpm dlx playwright test tests/api --reporter=html
```

### JSON Reports
```bash
pnpm dlx playwright test tests/api --reporter=json
```

### Custom Reporting
The test suite generates detailed reports including:
- Response time metrics
- Error rate analysis
- Security test results
- Performance benchmarks
- API coverage statistics

## Best Practices

### Test Organization
- Group related tests in describe blocks
- Use descriptive test names
- Include both positive and negative test cases
- Test edge cases and boundary conditions

### Data Management
- Always clean up test data
- Use unique identifiers for test data
- Avoid dependencies between tests
- Use factories for test data generation

### Performance Testing
- Set realistic performance thresholds
- Test under various load conditions
- Monitor resource usage
- Include network latency considerations

### Security Testing
- Test all input validation
- Verify authentication and authorization
- Check for common vulnerabilities
- Validate error message security

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify API server is running
   - Check test user credentials
   - Ensure token generation is working

2. **Network Timeouts**
   - Increase timeout values in config
   - Check API server performance
   - Verify network connectivity

3. **Test Data Conflicts**
   - Ensure proper cleanup between tests
   - Use unique identifiers
   - Check for race conditions

4. **Rate Limiting Issues**
   - Reduce concurrent request count
   - Add delays between requests
   - Check rate limit configuration

### Debug Mode
```bash
# Run with debug output
DEBUG=1 pnpm dlx playwright test tests/api

# Run single test with verbose output
pnpm dlx playwright test tests/api/api-endpoints.spec.ts --headed --debug
```

## Contributing

When adding new API tests:

1. Follow existing test patterns
2. Update configuration files
3. Add appropriate documentation
4. Include both success and failure cases
5. Ensure proper cleanup
6. Add performance and security validations
