# System Patterns

## Architecture Overview
Pixelated follows a microservices architecture with the following components:

### Frontend Layer
- **Main Framework**: React/Angular with TypeScript
- **State Management**: RxJS, Redux Toolkit, or NgRx
- **Component Pattern**: Smart/Dumb component pattern
- **Style Approach**: Tailwind CSS or Angular Material

### Backend Services
- **API Gateway**: Node.js/Express with TypeScript (Astro SSR)
- **Microservices**: Python (FastAPI/Flask) for AI services
- **Database Layer**: PostgreSQL primary, MongoDB for documents, Redis for caching
- **Message Queue**: RabbitMQ or Redis streams
- **Health Monitoring**: Custom health endpoints with detailed diagnostics
- **Load Balancing**: Traefik reverse proxy with dynamic configuration

### AI/ML Layer
- **Bias Detection Engine**: Custom Python service with TensorFlow/PyTorch, Fairlearn, SHAP/LIME
- **Model Serving**: MLflow or custom REST API with real ML model integration
- **Data Processing**: Python with pandas, numpy, scikit-learn, AIF360
- **Feature Store**: Custom implementation or Feast
- **Real ML Models**: Integrated Fairlearn, SHAP/LIME, Hugging Face evaluate
- **Frontend Integration**: Complete production API integration with client-side data transformation

## Component Relationships

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend     │◄──►│   API Gateway  │◄──►│   Microservices │
│  (React/Ng)    │    │   (Node.js)    │    │  (Python/Java)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                         │
         ▼                        ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL   │    │     Redis      │    │     MongoDB    │
│ (Relational)   │    │   (Cache)      │    │ (Document)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▼                        ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Traefik LB   │    │   Prometheus   │    │   Health Check │
│ (Load Balancer)│    │  (Monitoring)  │    │   Endpoints    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Design Patterns

### Repository Pattern
```typescript
interface IRepository<T> {
  find(id: string): Promise<T>;
  save(entity: T): Promise<T>;
  delete(id: string): Promise<void>;
}
```

### Service Layer Pattern
```typescript
class BiasDetectionService {
  constructor(
    private readonly repository: BiasDetectionRepository,
    private readonly aiModel: AIModelService
  ) {}

  async detectBias(content: string): Promise<BiasResult> {
    const result = await this.aiModel.predict(content);
    await this.repository.save(result);
    return result;
  }
}
```

### Command/Query Responsibility Segregation (CQRS)
- **Commands**: Modify state (create, update, delete)
- **Queries**: Read data without side effects
- **Handlers**: Process commands and queries

## Communication Patterns

### Synchronous Communication
- HTTP REST APIs for user-facing operations
- gRPC for service-to-service communications

### Asynchronous Communication
- Event-driven architecture using RabbitMQ
- Background job processing with Celery
- Real-time notifications with WebSocket

## Data Flow Patterns

### Request Flow
1. User request → Traefik Load Balancer
2. Route to API Gateway (Astro SSR)
3. Authenticate and validate request
4. Route to appropriate microservice
5. Process request and return response

### Health Check Flow
1. Kubernetes/Traefik → Health Check Endpoint
2. Service status validation (database, cache, AI services)
3. Response with health status and metrics
4. Monitoring system processes results

### Event Flow
1. State change triggers event
2. Event published to message broker
3. Subscribers receive and process event
4. Each subscriber handles event independently

## Caching Strategies

### Multi-Level Caching
1. **Browser Cache**: HTTP headers and localStorage
2. **CDN Cache**: Static assets and common requests
3. **Application Cache**: Redis for server-side caching
4. **Database Query Cache**: Connection pooling and prepared statements

### Cache Keys
```
user:profile:{userId}
bias:result:{contentHash}
session:{sessionId}
config:global
```

## Error Handling

### Error Propagation
```typescript
class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number
  ) {
    super(message);
  }
}
```

### Centralized Error Handling
- Global error boundary in React/Angular
- Error middleware in Express
- Consistent error response format
- Logging and monitoring integration

## Security Patterns

### Input Validation
- Zod schemas for runtime validation
- TypeScript interfaces for compile-time checking
- SQL injection prevention with parameterized queries
- XSS prevention with content sanitization
- HIPAA compliance validation for healthcare data

### Authentication & Authorization
- JWT tokens with refresh mechanism
- Role-based access control (RBAC)
- API key authentication for services
- OAuth2 integration for third-party login

### Health Check Security
- Health endpoints exposed for monitoring
- No sensitive data in health responses
- Rate limiting on health endpoints
- Network policies for health check access
