# System Architecture Overview

## High-Level Architecture
Pixelated Empathy follows a microservices architecture with clear separation of concerns:

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   Frontend      │    │   API Gateway    │    │ Authentication   │
│   (Astro/React) │◄──►│   (Node.js)      │◄──►│   (Better Auth)  │
└─────────────────┘    └──────────────────┘    └──────────────────┘
        │                       │                        │
        ▼                       ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Emotional       │    │ Bias Detection   │    │ Journal Research │
│ Intelligence    │    │ Service          │    │ Pipeline         │
│ Engine          │    │ (Python/Flask)   │    │ (Python/FastAPI) │
└─────────────────┘    └──────────────────┘    └──────────────────┘
        │                       │                        │
        ▼                       ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Training        │    │ Analytics        │    │ Data Storage     │
│ Platform        │    │ Dashboard        │    │ (MongoDB/Redis)  │
│ (React Three)   │    │ (Chart.js)       │    │                  │
└─────────────────┘    └──────────────────┘    └──────────────────┘
```

## Core Components

### 1. Frontend Layer
**Technology**: Astro 5.x + React 19 + TypeScript
**Location**: `/src/`
**Key Features**:
- Responsive design for desktop and mobile
- Real-time WebSocket communication
- 3D visualization components (Three.js)
- Progressive Web App capabilities

### 2. API Gateway
**Technology**: Node.js 24 + Express
**Location**: `/src/server.ts`
**Responsibilities**:
- Request routing and load balancing
- Authentication middleware
- Rate limiting and security controls
- Request/response logging

### 3. Emotional Intelligence Engine
**Technology**: Python 3.11 + PyTorch + Transformers
**Location**: `/ai/models/`
**Capabilities**:
- Sentiment and emotion classification
- Conversational dynamics analysis
- Trust and vulnerability detection
- Persona recognition and adaptation

### 4. Bias Detection Service
**Technology**: Python + Flask + Fairlearn
**Location**: `/src/lib/ai/bias-detection/`
**Features**:
- Real-time bias identification in text
- Multiple bias type detection (gender, racial, cultural)
- Confidence scoring and explanation
- Continuous learning from feedback

### 5. Journal Research Pipeline
**Technology**: Python + FastAPI + HuggingFace
**Location**: `/ai/journal_dataset_research/`
**Workflow**:
- Academic database crawling (PubMed, arXiv, IEEE Xplore)
- Dataset evaluation and scoring
- Automated acquisition and preprocessing
- Integration planning and metadata generation

### 6. Training Platform (Empathy Gym™)
**Technology**: React + Three.js + WebSocket
**Location**: `/src/components/training/`
**Components**:
- Scenario-based training modules
- AI persona simulation
- Real-time feedback system
- Performance analytics

### 7. Data Layer
**Primary**: MongoDB 7.0
**Cache**: Redis 5.x
**Storage**: S3-compatible object storage
**Security**: End-to-end encryption at rest and in transit

## Deployment Architecture

### Development
- Local development with Docker Compose
- Hot reloading for frontend and backend services
- Local database instances for testing

### Production
- Containerized deployment (Docker)
- Kubernetes orchestration
- Cloudflare Workers for edge computing
- Auto-scaling based on demand
- Multi-region deployment for redundancy

## Security Architecture
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- End-to-end encryption for sensitive data
- Regular security scanning and penetration testing
- HIPAA-compliant data handling procedures

## Monitoring & Observability
- OpenTelemetry for distributed tracing
- Prometheus for metrics collection
- Grafana for dashboard visualization
- Sentry for error tracking and reporting
- Custom health checks for all services

## Integration Points
- **Academic Databases**: PubMed API, arXiv API, IEEE Xplore API
- **Cloud Services**: AWS S3, Google Cloud Storage, Cloudflare R2
- **Authentication**: Auth0, Better Auth
- **Analytics**: Mixpanel, Google Analytics
- **Communication**: Twilio for SMS notifications