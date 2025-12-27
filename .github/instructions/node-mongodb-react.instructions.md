---
applyTo: '**/api/**/*.js,**/api/**/*.ts,**/api/**/*.py,**/src/pages/api/**/*,**/backend/**/*,**/server/**/*'
---

# Backend API Development Guidelines

## Technology Stack

### Core Backend Technologies
- **Runtime**: Node.js with Express.js for API routes
- **Database**: MongoDB with Mongoose ODM, PostgreSQL for relational data
- **Authentication**: JWT with proper rotation and validation
- **Python Services**: Flask microservices for AI/ML operations
- **Caching**: Redis for session management and performance optimization

### API Architecture Patterns
- **RESTful Design**: Follow REST conventions with proper HTTP methods and status codes
- **Microservices**: Separate AI services from main application logic
- **Error Handling**: Consistent error response format across all endpoints
- **Input Validation**: Comprehensive validation using Joi or Zod schemas
- **Rate Limiting**: Implement rate limiting for API protection

## Data Models & Business Logic

### Core Entity Relationships
```javascript
// Request → Entry workflow
Request {
  userId: ObjectId,
  poolId: ObjectId,
  status: 'pending' | 'approved' | 'rejected',
  paymentStatus: 'pending' | 'completed' | 'failed',
  createdAt: Date
}

Entry {
  requestId: ObjectId,
  userId: ObjectId,
  poolId: ObjectId,
  entryNumber: 1 | 2 | 3,
  status: 'active' | 'eliminated' | 'winner'
}
```

### Business Rules Implementation
- **Request Limits**: Maximum 3 requests per user per pool
- **State Transitions**: Request (pending → approved) → Entry creation
- **Payment Validation**: Entry creation only after payment completion
- **Pick Management**: Allow pick updates until deadline, track pick history

## API Development Standards

### Endpoint Structure
```javascript
// Standard API response format
{
  success: boolean,
  data?: any,
  error?: {
    code: string,
    message: string,
    details?: any
  },
  meta?: {
    pagination?: { page, limit, total },
    timestamp: string
  }
}
```

### Security Implementation
- **Authentication Middleware**: Verify JWT tokens on protected routes
- **Authorization**: Role-based access control (user, admin, moderator)
- **Input Sanitization**: Prevent NoSQL injection and XSS attacks
- **CORS Configuration**: Proper CORS setup for frontend integration
- **Audit Logging**: Log all critical operations for compliance

### Database Operations
- **Connection Management**: Use connection pooling for MongoDB/PostgreSQL
- **Transaction Handling**: Implement transactions for multi-step operations
- **Query Optimization**: Use proper indexing and query optimization
- **Data Validation**: Schema validation at database and application level

## Error Handling & Monitoring

### Error Response Standards
```javascript
// Consistent error handling middleware
app.use((error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    }
  });
});
```

### Performance Monitoring
- **Response Time Tracking**: Monitor API response times
- **Database Query Performance**: Log slow queries for optimization
- **Memory Usage**: Monitor memory consumption in long-running processes
- **Health Check Endpoints**: Implement `/health` and `/ready` endpoints

## Integration Guidelines

### Frontend Integration
- **API Client**: Centralized API client with error handling and retries
- **State Management**: Proper state synchronization between frontend and backend
- **Real-time Updates**: WebSocket implementation for live data updates
- **Caching Strategy**: Implement appropriate caching for frequently accessed data

### AI Service Integration
- **Async Processing**: Use message queues for AI processing tasks
- **Timeout Handling**: Implement proper timeouts for AI service calls
- **Fallback Mechanisms**: Graceful degradation when AI services are unavailable
- **Data Pipeline**: Secure data flow between main app and AI services