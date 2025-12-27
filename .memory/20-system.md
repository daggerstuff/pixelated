# System Architecture

> **Builds on**: `00-description.md`, `01-brief.md`, `10-product.md`  
> **Focus**: The Structure

---

## Architecture Overview

Pixelated Empathy uses a **microservices-based architecture** with clear separation of concerns, enabling scalability, security, and maintainability while maintaining HIPAA compliance.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                         │
│  Astro 5.x + React 19 | UnoCSS | Radix UI              │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                   API Gateway Layer                     │
│  REST APIs | WebSocket | Express 5 | Rate Limiting     │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼──────┐ ┌──────▼──────┐ ┌─────▼──────┐
│ Auth Service │ │ AI Services  │ │ Analytics  │
│ Better Auth  │ │ MentalLLaMA  │ │ Service    │
│ Azure AD     │ │ Python       │ │ Custom     │
└──────────────┘ └──────────────┘ └────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                    Data Layer                           │
│  MongoDB Atlas | PostgreSQL (Supabase) | Redis         │
└─────────────────────────────────────────────────────────┘
```

## Component Breakdown

### Frontend Layer

**Framework**: Astro 5.x with React 19 integration

**Key Components:**
- **Component Structure**: Atomic Design Principles
- **State Management**: 
  - Jotai for atomic state
  - Zustand for global state
  - React Context for shared context
- **Styling**: UnoCSS (utility-first), TailwindCSS
- **UI Components**: Radix UI primitives, custom component library
- **Accessibility**: WCAG 2.1 AA compliance, ARIA labels, keyboard navigation

**Data Flow:**
1. User actions trigger state changes
2. State updates propagate to components
3. Side effects handled by middleware
4. Server state synchronized via WebSocket

### Backend Layer

**API Layer:**
- RESTful endpoints for standard operations
- WebSocket for real-time communication
- Express 5 for HTTP server
- Rate limiting and request validation
- CORS configuration

**Core Services:**
- **Authentication Service**: Better Auth, JWT token management, Azure AD integration
- **AI Analysis Service**: Custom Python services with MentalLLaMA integration
- **Bias Detection Service**: Real-time bias monitoring and mitigation
- **Analytics Service**: Custom analytics with performance tracking
- **Session Service**: Training session management and state
- **Knowledge Base Service**: Enhanced psychology knowledge base with 10,960 concepts including therapeutic conversation examples and psychology book references

**Zero-Knowledge System:**
- Fully Homomorphic Encryption (FHE) with sub-50ms latency
- Client-side key generation
- Secure message passing
- Zero-knowledge proofs

### Data Layer

**Primary Database**: MongoDB Atlas
- User data and profiles
- Session records and transcripts
- Training progress and analytics
- System configuration

**Secondary Database**: PostgreSQL (via Supabase)
- Relational data (treatment plans, goals, objectives)
- User authentication data
- Audit logs

**Cache Layer**: Redis
- Session state caching
- Real-time data
- Performance optimization
- Rate limiting data

**Storage**: S3-compatible (AWS, Azure Blob, Google Cloud Storage)
- File storage
- Backup data
- Media files

## Design Patterns

### Microservices Pattern
- Service isolation for security and scalability
- Independent deployment and scaling
- Clear service boundaries

### Repository Pattern
- Data access abstraction
- Database-agnostic business logic
- Easier testing and maintenance

### Factory Pattern
- Service creation and configuration
- Provider abstraction (AI models, storage, etc.)
- Dependency injection

### Observer Pattern
- Real-time updates via WebSocket
- Event-driven architecture
- State synchronization

### Strategy Pattern
- Multiple AI model providers
- Different storage backends
- Pluggable authentication methods

## Data Flow

### Training Session Flow

1. **User Initiates Session**
   - User selects scenario type
   - System creates session record
   - AI client persona initialized

2. **Real-Time Conversation**
   - User messages sent via WebSocket
   - AI client responds through MentalLLaMA
   - Real-time bias detection analyzes input
   - Feedback provided to user

3. **Session Analysis**
   - Conversation analyzed for therapeutic techniques
   - Bias incidents logged
   - Performance metrics calculated
   - Feedback report generated

4. **Session Review**
   - Transcript stored securely
   - Supervisor can review and annotate
   - Trainee can reflect on performance
   - Progress metrics updated

### AI Processing Flow

1. **Input Processing**
   - Text input validated and sanitized
   - Sentiment and emotion analysis
   - Bias detection algorithms run
   - Context extracted

2. **Model Inference**
   - MentalLLaMA model processes input
   - Therapeutic pattern recognition
   - Response generation
   - Risk assessment

3. **Output Generation**
   - Structured response created
   - Feedback recommendations generated
   - Performance metrics calculated
   - Results encrypted and stored

## Integration Points

### External Services

- **Azure AD**: Authentication and user management
- **Supabase**: PostgreSQL database and authentication
- **AWS/Azure/GCP**: Cloud storage and infrastructure
- **Sentry**: Error tracking and monitoring
- **MentalLLaMA**: AI model inference

### Internal Services

- **Bias Detection Service**: Real-time bias monitoring
- **Analytics Service**: Performance tracking and reporting
- **Session Service**: Training session management
- **FHE Service**: Privacy-preserving computations

## Non-Functional Requirements

### Security Architecture

- **Encryption**: End-to-end encryption for messages, at-rest encryption for stored data
- **Access Control**: Role-based access control (RBAC), audit logging
- **Authentication**: Multi-factor authentication support, JWT token management
- **Compliance**: HIPAA++ compliance, automated security checks

### Performance Architecture

- **Caching**: Redis for session state and frequently accessed data
- **CDN**: Static asset delivery via Cloudflare
- **Load Balancing**: Multi-region deployment with load balancing
- **Database Optimization**: Indexing, query optimization, connection pooling

### Scalability Architecture

- **Horizontal Scaling**: Microservices can scale independently
- **Containerization**: Docker containers for consistent deployment
- **Orchestration**: Kubernetes for container orchestration
- **Auto-scaling**: Automatic scaling based on load

### Reliability Architecture

- **Redundancy**: Multi-region deployment with failover
- **Monitoring**: Prometheus and Grafana for metrics
- **Logging**: Centralized logging with structured logs
- **Error Handling**: Comprehensive error handling and recovery

---

*Last Updated: December 2025*
