---
applyTo: '**'
description: 'Pixelated Empathy core development principles and technology stack guidelines'
name: 'code-guidelines'
---

# Pixelated Empathy Code Guidelines

## Core Development Principles

### Security & Privacy First
- **HIPAA++ Compliance**: All data handling must exceed standard HIPAA requirements
- **Zero-Knowledge Architecture**: Implement fully homomorphic encryption (FHE) with <50ms latency
- **Bias Detection**: Integrate real-time bias monitoring in all AI interactions
- **Audit Trails**: Log all therapeutic interactions for compliance validation

### Technology Stack Adherence
- **Frontend**: Astro 5.x + React 19.x + TypeScript, TailwindCSS 4.x + UnoCSS
- **Backend**: Python 3.11+ with uv, PyTorch, Flask microservices
- **Package Management**: pnpm (required), uv for Python
- **Database**: PostgreSQL, MongoDB, Redis with encryption at rest

### Performance Requirements
- **Response Time**: <50ms for AI conversational interactions
- **Availability**: 99.9% uptime for training sessions
- **Memory Optimization**: Use torch.cuda.amp, gradient checkpointing, PEFT methods
- **Bundle Optimization**: Implement code splitting, tree shaking, lazy loading

## Code Quality Standards

### File Organization
```
src/
├── components/           # Domain-organized React components
│   ├── admin/           # Admin dashboard components
│   ├── ai/              # AI chat and interaction components
│   ├── auth/            # Authentication components
│   └── ui/              # Reusable UI components (shadcn/ui)
├── lib/
│   ├── ai/              # AI service integrations
│   ├── security/        # FHE and encryption utilities
│   ├── fhe/             # Fully homomorphic encryption
│   └── bias-detection/  # Bias monitoring services
ai/
├── models/              # ML model definitions
├── inference/           # Model inference services
├── safety/              # Safety validation systems
└── api/                 # Python API services
```

### Naming Conventions
- **Components**: PascalCase (`BiasDetectionEngine.tsx`)
- **Files**: kebab-case for pages (`mental-health-chat.astro`), camelCase for utilities
- **Python**: snake_case (`bias_detection_engine.py`)
- **Constants**: UPPER_SNAKE_CASE (`MILLISECONDS_PER_DAY`)
- **Types**: PascalCase with descriptive suffixes (`TherapeuticSessionData`)

### Implementation Guidelines
- **Single Responsibility**: Functions should do one thing well (<20 lines)
- **Immutable State**: Prefer const, minimize mutable state
- **Error Handling**: Implement comprehensive error boundaries and validation
- **Type Safety**: Use strict TypeScript with explicit interfaces
- **Testing**: Maintain 70%+ coverage, focus on critical therapeutic logic

### AI/ML Specific Rules
- **Model Architecture**: Modular, configurable designs with proper memory management
- **Training**: Use mixed precision, gradient checkpointing, distributed training
- **Inference**: Optimize with quantization, ONNX/TorchScript for production
- **Validation**: Comprehensive bias testing and safety validation

### Security Implementation
- **Encryption**: All sensitive data encrypted with FHE
- **Authentication**: JWT with proper rotation and validation
- **Input Validation**: Sanitize all user inputs, especially therapeutic content
- **Logging**: Secure audit trails without exposing sensitive data

### Component Development (shadcn/ui)
- Use `cn()` utility for class merging
- Follow variant patterns with sensible defaults
- Ensure WCAG AA accessibility compliance
- Implement proper focus management and keyboard navigation

## Development Workflow

### Code Changes
- Make changes file by file for review
- Provide complete edits in single chunks per file
- Preserve existing functionality unless explicitly requested
- Use descriptive commit messages following conventional commits

### Quality Assurance
- Run type checking: `pnpm typecheck`
- Execute tests: `pnpm test` and `pytest`
- Security scanning: `pnpm security:scan`
- Performance testing: `./scripts/test-performance.sh`

### AI Assistant Behavior
- Verify information before presenting solutions
- Prioritize security and performance in all suggestions
- Include comprehensive error handling and edge case management
- Suggest appropriate tests for new or modified code
- Maintain compatibility with project's technology stack
- Focus on therapeutic use case requirements and compliance needs