---
inclusion: always
---

# Pixelated Empathy Product Guidelines

**Pixelated Empathy** is an AI-first training simulation platform for mental health professionals providing zero-risk environments for practicing with AI-simulated clients presenting challenging, rare, and complex therapeutic scenarios.

## Core Mission
Eliminate barriers between mental health training and real-world competency, ensuring every therapist enters practice confident to help their most challenging clients.

## Product Principles
- **Safety First**: All interactions must be secure, private, and compliant with healthcare regulations
- **Evidence-Based**: Training modules grounded in clinical research and best practices
- **Bias-Free**: Continuous monitoring and mitigation of algorithmic bias
- **Performance-Optimized**: Sub-50ms response times for natural conversation flow
- **Privacy-Preserving**: Zero-knowledge architecture with fully homomorphic encryption

## Key Features & Implementation Guidelines

### AI Client Simulations
- Complex presentations: crisis scenarios, personality disorders, trauma survivors, resistant clients
- Use `EmotionValidationPipeline` for emotional authenticity validation
- Implement `MultidimensionalEmotionMapper` for nuanced emotional responses
- Edge case generation for comprehensive training coverage

### Security & Privacy Architecture
- **FHE Implementation**: Sub-50ms latency requirement for real-time conversations
- **HIPAA++ Compliance**: Advanced privacy measures beyond standard requirements
- **Zero-Knowledge Training**: No sensitive data exposure during model training
- Encryption at rest and in transit for all therapeutic data

### Bias Detection & Mitigation
- **Real-time Monitoring**: `BiasDetectionEngine` with configurable thresholds
- Continuous bias assessment across all user interactions
- Automated alerts for bias threshold violations
- Regular fairness audits and model retraining

### Performance Requirements
- **Response Time**: <50ms for conversational interactions
- **Availability**: 99.9% uptime for training sessions
- **Scalability**: Support concurrent sessions for institutional deployments
- **Accessibility**: WCAG AA compliance for all interfaces

## Target Users & Use Cases

### Primary Users
- Mental health professionals in training
- Licensed therapists seeking specialized skill development
- Clinical supervisors conducting training assessments

### Institutional Partners
- Medical schools (Harvard Medical School, Johns Hopkins, Mayo Clinic)
- Healthcare organizations requiring compliance training
- Professional licensing boards for continuing education

### Training Scenarios
- Crisis intervention and suicide assessment
- Personality disorder management
- Trauma-informed therapy techniques
- Substance use disorder counseling
- Cultural competency and bias awareness

## Development Guidelines

### Code Organization
- Separate AI/ML services in `ai/` directory
- Frontend components in domain-specific folders (`components/admin/`, `components/chat/`)
- Security utilities in `src/lib/security/`
- Bias detection services in dedicated microservices

### Quality Standards
- Comprehensive test coverage for all therapeutic simulation logic
- Security audits for encryption and privacy implementations
- Performance benchmarking for response time requirements
- Accessibility testing for inclusive design

### Compliance Requirements
- HIPAA compliance validation for all data handling
- SOC 2 Type II certification requirements
- Regular penetration testing and vulnerability assessments
- Audit trail implementation for all user interactions