# Project Knowledge Base & Learning Repository

## Core Concepts

### Emotional Intelligence Engine
The heart of Pixelated Empathy analyzes conversations through multiple dimensions:

**Primary Analysis Layers**:
1. **Sentiment Classification**: Positive, negative, neutral intensity scoring
2. **Emotion Recognition**: Joy, sadness, anger, fear, surprise, disgust with granular intensity
3. **Vulnerability Detection**: Identifies openness, trust indicators, emotional exposure
4. **Trust Building Signals**: Recognizes rapport establishment moments
5. **Conversational Dynamics**: Analyzes turn-taking, response timing, emotional reciprocity

**Technical Implementation**:
- Transformer-based models fine-tuned on therapeutic conversation datasets
- Ensemble approach combining multiple models for accuracy
- Real-time processing with <200ms response time target
- Confidence scoring with uncertainty quantification

### Bias Detection Framework
Multi-layered approach to identifying bias in professional communications:

**Bias Categories Detected**:
- Demographic bias (gender, age, race, ethnicity)
- Cultural bias and stereotyping
- Linguistic bias in professional settings
- Implicit bias patterns in therapeutic contexts

**Detection Methods**:
- Statistical parity analysis
- Equal opportunity measurement
- Counterfactual fairness testing
- Adversarial debiasing techniques

### Journal Research Pipeline
Automated system for discovering and evaluating academic datasets:

**Discovery Process**:
1. **Source Crawling**: PubMed, arXiv, IEEE Xplore, PsycINFO
2. **Relevance Filtering**: Keyword matching, citation analysis, author reputation
3. **Quality Assessment**: Methodology evaluation, sample size analysis, peer review status
4. **Integration Planning**: Metadata extraction, preprocessing requirements, licensing verification

**Evaluation Criteria**:
- Clinical relevance and validity
- Dataset quality and completeness
- Ethical considerations and consent documentation
- Technical feasibility for integration

## System Architecture Patterns

### Microservices Communication
Services communicate through well-defined APIs with:
- **Event-driven architecture** for asynchronous operations
- **RESTful APIs** for synchronous requests
- **Message queues** (Redis) for background processing
- **WebSocket connections** for real-time updates

### Data Flow Patterns
```
User Input → API Gateway → Authentication → Service Router → 
Processing Service → Database → Cache → Response → Client
```

### Error Handling Strategy
- **Graceful degradation** for non-critical failures
- **Circuit breaker pattern** for external service calls
- **Retry mechanisms** with exponential backoff
- **Comprehensive logging** for debugging and monitoring

## Development Best Practices

### Code Quality Standards
**TypeScript Guidelines**:
- Strict mode enabled (`strict: true`)
- Explicit typing for all functions and variables
- No unused variables or imports
- Consistent naming conventions (camelCase for variables, PascalCase for classes)

**Python Standards**:
- Type hints required for all functions
- PEP 8 compliance enforced
- Docstrings for all public functions
- Black formatting with 100-character line limit

### Testing Strategies
**Coverage Requirements**:
- Unit tests: Minimum 80% coverage
- Integration tests: Critical path coverage
- E2E tests: Key user journeys
- Performance tests: Load and stress scenarios

**Testing Tools**:
- Frontend: Vitest + React Testing Library
- Backend: Jest + Supertest
- Python: Pytest with asyncio support
- E2E: Playwright with multiple browser support

### Security Practices
**Input Validation**:
- Server-side validation for all inputs
- Sanitization of user-generated content
- Parameterized queries to prevent SQL injection
- Content Security Policy implementation

**Authentication Security**:
- JWT tokens with short expiration
- Refresh token rotation
- Secure cookie attributes (HttpOnly, SameSite)
- Rate limiting on authentication endpoints

## Troubleshooting Guides

### Common Development Issues

**TypeScript Compilation Errors**:
```bash
# Clear cache and rebuild
rm -rf node_modules/.cache
pnpm typecheck --clean

# Check specific file issues
npx tsc --noEmit --watch src/problematic-file.ts
```

**Python Dependency Conflicts**:
```bash
# Use uv for faster resolution
uv sync --refresh
uv pip compile pyproject.toml --upgrade

# Clear Python cache
find . -name "*.pyc" -delete
```

**Docker Build Failures**:
```bash
# Clean build context
docker system prune -a
docker builder prune --all

# Multi-stage build debugging
docker build --target=builder -t debug-image .
```

### Performance Optimization Tips

**Database Queries**:
- Use indexes strategically (compound indexes for multi-field queries)
- Implement pagination for large result sets
- Use aggregation pipelines for complex operations
- Monitor slow query logs regularly

**Frontend Performance**:
- Code splitting for route-based chunks
- Image optimization (WebP format, responsive sizing)
- Lazy loading for non-critical components
- Bundle analysis to identify large dependencies

**API Performance**:
- Implement caching strategies (Redis for frequently accessed data)
- Use connection pooling for database connections
- Optimize serialization/deserialization
- Implement request batching where appropriate

## Useful Commands & Scripts

### Development Workflow
```bash
# Start full development environment
pnpm dev:all-services

# Run all checks and tests
pnpm check:all && pnpm test:all

# Security scanning
pnpm security:check && pnpm security:scan

# Database operations
pnpm mongodb:seed
pnpm mongodb:migrate
```

### Debugging Tools
```bash
# TypeScript debugging
pnpm ts:debug:verbose

# Memory profiling
node --inspect-brk src/server.ts

# Network debugging
DEBUG=* pnpm dev

# Database profiling
mongosh --eval "db.currentOp()"
```

### Deployment Utilities
```bash
# Build for different targets
pnpm build:vercel
pnpm build:cloudflare
pnpm build:analyze

# Test deployment locally
docker-compose -f docker/docker-compose.prod.yml up --build

# Health checks
curl -f http://localhost:4321/api/health
```

## External Resources & Documentation

### Official Documentation
- [Astro Documentation](https://docs.astro.build)
- [React 19 Beta Docs](https://beta.reactjs.org)
- [MongoDB Manual](https://www.mongodb.com/docs/manual/)
- [FastAPI Documentation](https://fastapi.tiangolo.com)

### Research Papers & References
- Emotional intelligence in AI systems
- Bias detection in NLP models
- Therapeutic conversation analysis
- Healthcare data privacy regulations

### Community Resources
- Stack Overflow tags: [pixelated-empathy], [emotional-ai]
- GitHub discussions in project repository
- Discord community server
- Monthly virtual meetups

## Team Knowledge Sharing

### Onboarding Checklist
- [ ] Access to development environments
- [ ] Review of architecture documentation
- [ ] Pair programming session with senior developer
- [ ] Security training completion
- [ ] HIPAA compliance certification

### Cross-Team Communication
- Daily standups: 9:00 AM PST
- Architecture review: Fridays 2:00 PM PST
- Knowledge sharing sessions: Wednesdays 3:00 PM PST
- Incident retrospectives: Post-incident analysis meetings

### Documentation Maintenance
- Update relevant docs with each significant change
- Review and refresh documentation quarterly
- Archive deprecated documentation with clear notices
- Maintain glossary of technical terms and acronyms

## Glossary of Terms

**AIT**: Artificial Intelligence Therapy assistant
**HIPAA**: Health Insurance Portability and Accountability Act
**PWA**: Progressive Web Application
**RBAC**: Role-Based Access Control
**SOC2**: Service Organization Control 2 compliance standard
**WASM**: WebAssembly for performance-critical computations

## Quick Reference Cards

### Environment Variables
```bash
# Required for development
MONGODB_URI=mongodb://localhost:27017/pixelated
REDIS_URL=redis://localhost:6379
AUTH_SECRET=your-jwt-secret
OPENAI_API_KEY=sk-...

# Optional for enhanced features
SENTRY_DSN=https://...
CLOUDFLARE_ACCOUNT_ID=...
AWS_ACCESS_KEY_ID=...
```

### Common API Endpoints
```
GET  /api/health           - System health check
POST /api/emotions/analyze - Emotional analysis
POST /api/bias/detect      - Bias detection
GET  /api/training/scenarios - Available training modules
POST /api/research/search  - Journal research queries
```

### Git Workflow
```bash
# Feature branch workflow
git checkout -b feature/new-feature-name
git add .
git commit -m "feat: brief description of changes"
git push origin feature/new-feature-name

# Pull request process
# 1. Create PR with detailed description
# 2. Request code review from 2+ team members
# 3. Address feedback and iterate
# 4. Merge after approval and CI passes
```