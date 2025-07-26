# Pixelated Empathy - Microservices Architecture

This document describes the microservices architecture for the Pixelated Empathy project, which breaks down the monolithic application into scalable, maintainable services.

## Architecture Overview

The application is split into the following services:

### Core Services

1. **Web Frontend** (Port 3000)
   - Astro-based frontend application
   - Serves the main user interface
   - Handles client-side routing and static assets

2. **Bias Detection Service** (Port 8001)
   - Analyzes content for various types of bias
   - Machine learning models for bias detection
   - Real-time and batch processing capabilities

3. **AI Service** (Port 8002)
   - Handles AI/ML model interactions
   - Interfaces with external AI APIs (OpenAI, Anthropic, etc.)
   - Model caching and optimization

4. **Analytics Service** (Port 8003)
   - Collects and processes analytics data
   - Real-time metrics and reporting
   - Data aggregation and insights

5. **Background Jobs Service**
   - Processes asynchronous tasks
   - Queue management with Redis
   - Email notifications, data processing, etc.

### Infrastructure Services

6. **PostgreSQL Database** (Port 5432)
   - Primary data store
   - Separate schemas for each service
   - ACID compliance and reliability

7. **Redis Cache** (Port 6379)
   - Caching layer
   - Session storage
   - Job queue management

8. **NGINX Reverse Proxy** (Port 80/443)
   - Load balancing
   - SSL termination
   - Rate limiting and security

### Monitoring Services

9. **Prometheus** (Port 9090)
   - Metrics collection
   - Service health monitoring
   - Custom application metrics

10. **Grafana** (Port 3001)
    - Visualization dashboards
    - Alerting and notifications
    - Performance monitoring

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Node.js 22.x
- pnpm package manager

### Development Setup

1. **Clone and setup:**
   ```bash
   git clone <repository-url>
   cd pixelated2
   pnpm install
   ```

2. **Setup development environment:**
   ```bash
   ./scripts/setup-dev.sh
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

4. **Start all services:**
   ```bash
   ./scripts/deploy.sh
   ```

### Development Commands

```bash
# Start individual services for development
pnpm dev                    # Main Astro application
pnpm dev:bias-detection     # Bias detection service
pnpm dev:ai-service         # AI service
pnpm dev:analytics          # Analytics service
pnpm dev:worker             # Background jobs

# Start all services at once
pnpm dev:all-services

# Docker commands
pnpm docker:up              # Deploy all services
pnpm docker:down            # Stop all services
pnpm docker:logs            # View logs
pnpm docker:restart         # Restart services
pnpm docker:reset           # Reset development environment
```

## Service Communication

Services communicate through:

1. **HTTP APIs** - REST endpoints for synchronous communication
2. **Redis Queues** - Asynchronous job processing
3. **PostgreSQL** - Shared data store with service-specific schemas
4. **Environment Variables** - Configuration and secrets

### API Endpoints

- **Web Frontend**: `https://localhost`
- **Bias Detection**: `http://localhost:8001/api`
- **AI Service**: `http://localhost:8002/api`
- **Analytics**: `http://localhost:8003/api`

### Monitoring Endpoints

- **Grafana Dashboard**: `http://localhost:3001` (admin/admin)
- **Prometheus**: `http://localhost:9090`

## Database Schema

Each service has its own database schema:

```sql
-- Bias Detection Service
bias_detection.analysis_results
bias_detection.model_configs
bias_detection.training_data

-- AI Service
ai_service.model_cache
ai_service.api_usage
ai_service.conversations

-- Analytics Service
analytics.events
analytics.metrics
analytics.reports
```

## Security

### Network Security
- Services communicate over internal Docker network
- NGINX handles SSL termination
- Rate limiting on public endpoints

### Data Security
- Encrypted connections between services
- Secrets managed through environment variables
- Input validation and sanitization

### Authentication
- JWT tokens for service-to-service communication
- User sessions managed by main web application
- API key authentication for external services

## Deployment

### Development
```bash
./scripts/setup-dev.sh  # Setup development environment
./scripts/deploy.sh     # Deploy all services locally
```

### Production
1. Configure production environment variables
2. Setup SSL certificates
3. Configure external databases and Redis
4. Deploy using Docker Compose or Kubernetes

### Environment Variables

Key environment variables:

```bash
# Database
POSTGRES_DB=pixelated_empathy
POSTGRES_USER=pixelated_user
POSTGRES_PASSWORD=your_secure_password

# Redis
REDIS_URL=redis://redis:6379

# AI APIs
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key

# Monitoring
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
```

## Monitoring and Observability

### Metrics
- **Application Metrics**: Custom metrics for each service
- **Infrastructure Metrics**: CPU, memory, disk usage
- **Business Metrics**: User engagement, AI usage, bias detection results

### Logging
- Centralized logging with structured JSON format
- Log aggregation across all services
- Error tracking and alerting

### Health Checks
- HTTP health endpoints for each service
- Database connection monitoring
- External API availability checks

## Development Guidelines

### Adding New Services

1. Create service directory: `src/lib/[service-name]/`
2. Add Dockerfile: `docker/[service-name]/Dockerfile`
3. Update Docker Compose: `docker-compose.yml`
4. Add service scripts to `package.json`
5. Update NGINX configuration for routing

### API Design
- RESTful endpoints with consistent naming
- JSON request/response format
- Proper HTTP status codes
- Error handling with meaningful messages

### Testing
```bash
pnpm test                   # Unit tests
pnpm test:integration       # Integration tests
pnpm test:e2e              # End-to-end tests
pnpm test:bias-detection   # Service-specific tests
```

## Troubleshooting

### Common Issues

1. **Services not starting**
   ```bash
   docker-compose logs [service-name]
   ```

2. **Database connection issues**
   ```bash
   docker-compose exec postgres psql -U pixelated_user -d pixelated_empathy
   ```

3. **Redis connection issues**
   ```bash
   docker-compose exec redis redis-cli ping
   ```

4. **Port conflicts**
   - Check if ports are already in use
   - Modify port mappings in docker-compose.yml

### Reset Development Environment
```bash
./scripts/reset-dev.sh
```

## Performance Optimization

### Caching Strategy
- Redis for session and API response caching
- Browser caching for static assets
- Database query optimization

### Load Balancing
- NGINX handles load balancing
- Horizontal scaling of stateless services
- Database connection pooling

### Resource Management
- Docker resource limits
- Memory optimization for AI models
- Background job throttling

## Contributing

1. Follow the coding guidelines in `.github/instructions/`
2. Write tests for new features
3. Update documentation
4. Submit pull requests with clear descriptions

## License

MIT License - See LICENSE file for details
