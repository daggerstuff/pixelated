# Pixelated Empathy API Documentation

## Overview

The Pixelated Empathy API provides comprehensive access to bias detection, mental health analysis, and therapy session management capabilities. Built with performance and security in mind, the API supports real-time analysis, batch processing, and extensive analytics.

## 🚀 Quick Start

### Authentication

All API endpoints require authentication via JWT tokens:

```bash
curl -H "Authorization: Bearer <your-jwt-token>" \
     https://api.pixelatedempathy.com/v1/bias-analysis/analyze
```

### Basic Bias Analysis

```bash
curl -X POST https://api.pixelatedempathy.com/v1/bias-analysis/analyze \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Patient expressed frustration about systemic inequalities...",
    "context": "Individual therapy session",
    "demographics": {
      "age": 35,
      "gender": "non-binary",
      "ethnicity": "Latinx"
    }
  }'
```

## 📋 API Categories

### 🔍 **Core Analysis APIs**
- **[Bias Analysis](./bias-analysis/)** - ML-powered bias detection and analysis
- **[Mental Health](./mental-health/)** - Emotional and psychological assessment
- **[Session Management](./session/)** - Therapy session lifecycle management

### 👥 **User & Authentication**
- **[Authentication](./auth/)** - JWT-based authentication and authorization
- **[User Management](./admin/users/)** - User account and profile management
- **[Patient Rights](./patient-rights/)** - GDPR/HIPAA compliance endpoints

### 📊 **Analytics & Insights**
- **[Dashboard](./dashboard/)** - Real-time dashboard data and metrics
- **[Analytics](./analytics/)** - Comprehensive reporting and trends
- **[Export](./export/)** - Data export for research and compliance

### 🛠️ **Administrative APIs**
- **[Admin](./admin/)** - Platform administration and management
- **[Health](./health/)** - System health monitoring and diagnostics
- **[Security](./security/)** - Security events and audit logs

### 🤖 **AI & Machine Learning**
- **[AI Services](./ai/)** - Advanced AI analysis and recommendations
- **[Crisis Detection](./crisis/)** - Crisis intervention and safety monitoring
- **[Pattern Analysis](./pattern-analysis/)** - Cross-session pattern recognition

## 🔐 Authentication & Security

### Authentication Methods
- **JWT Bearer Tokens** - Primary authentication method
- **API Keys** - For service-to-service communication
- **Session Management** - Secure session handling with automatic expiry

### Security Features
- **Rate Limiting** - Role-based request limits (10-1000 req/min)
- **Input Validation** - Comprehensive validation with Zod schemas
- **CORS Protection** - Configurable cross-origin policies
- **Audit Logging** - Complete security event tracking

## 📈 Performance Characteristics

### Response Times
- **Bias Analysis**: < 2 seconds (target: < 1.5s)
- **Health Checks**: < 1 second (target: < 500ms)
- **Dashboard Data**: < 3 seconds
- **Batch Processing**: Variable based on input size

### Rate Limits
- **Anonymous**: 10 requests/minute
- **Authenticated**: 100 requests/minute
- **Admin**: 1000 requests/minute

### Caching Strategy
- **L1 Cache**: In-memory (future)
- **L2 Cache**: Redis with intelligent invalidation
- **L3 Cache**: Database with query optimization

## 🌐 API Versions

| Version | Status | Description |
|---------|--------|-------------|
| **v1** | ✅ Current | Main production API |
| **v1/legacy** | ⚠️ Deprecated | Legacy endpoints for compatibility |
| **v2** | 🔄 Planning | Enhanced features and optimizations |

## 📚 Documentation Structure

### **[OpenAPI Specification](./openapi-spec.yaml)**
Complete API specification with request/response schemas, authentication details, and examples.

### **[API Guides](./guides/)**
- **[Authentication Guide](./guides/authentication.md)** - JWT setup and usage
- **[Rate Limiting Guide](./guides/rate-limiting.md)** - Understanding and managing rate limits
- **[Error Handling](./guides/error-handling.md)** - Error codes and troubleshooting
- **[WebSocket Guide](./guides/websockets.md)** - Real-time communication setup

### **[SDK & Tools](./tools/)**
- **[JavaScript SDK](./tools/javascript-sdk.md)** - Client library usage
- **[Postman Collection](./tools/postman-collection.json)** - Ready-to-use API collection
- **[Testing Tools](./tools/testing.md)** - API testing utilities

### **[Examples](./examples/)**
- **[Basic Usage](./examples/basic-usage.md)** - Simple API integration examples
- **[Advanced Patterns](./examples/advanced-patterns.md)** - Complex integration scenarios
- **[Batch Processing](./examples/batch-processing.md)** - High-throughput processing examples

## 🔧 Development & Testing

### Local Development
```bash
# Start development server
pnpm dev

# Run API tests
pnpm test:api

# Generate API documentation
pnpm docs:api
```

### Testing APIs
```bash
# Unit tests
pnpm test:unit

# Integration tests
pnpm test:integration:api

# Load testing
pnpm test:performance
```

## 🚀 Deployment

### Production Deployment
- **Server**: Node.js 24+ with optimized configuration
- **Database**: PostgreSQL with connection pooling
- **Cache**: Redis with advanced caching strategies
- **CDN**: Global asset delivery optimization

### Environment Configuration
- **Development**: Local configuration with development settings
- **Staging**: Pre-production environment for testing
- **Production**: Optimized production configuration

## 📞 Support & Contact

### Getting Help
- **API Issues**: Check [troubleshooting guide](./guides/troubleshooting.md)
- **Feature Requests**: Submit via [GitHub Issues](https://github.com/pixelated-empathy/issues)
- **Security Concerns**: Contact security team immediately

### Service Level Agreements (SLA)
- **Uptime**: 99.9% for production API
- **Response Time**: < 2 seconds for 95% of requests
- **Support**: 24/7 for critical issues

## 🔄 Changelog

### Recent Updates
- **v1.0.0**: Initial production release with comprehensive bias detection
- **Performance**: Sub-2-second response times achieved
- **Security**: Enhanced authentication and rate limiting
- **Documentation**: Complete API reference and guides

### Upcoming Features
- **WebSocket APIs**: Real-time bias alerts and session monitoring
- **Advanced Analytics**: Machine learning insights and predictions
- **Mobile SDK**: Native mobile application support
- **API v2**: Enhanced performance and new capabilities

---

**Built with ❤️ for mental health professionals and researchers**