# Pixelated Empathy Project Overview

## Project Summary
Pixelated Empathy is an AI-first training simulation platform for mental health professionals that provides a zero-risk environment for practicing with AI-simulated clients presenting challenging, rare, and complex cases.

## Core Purpose
To transform mental health education by eliminating barriers between training and real-world competency, ensuring every therapist enters practice confident to help their most challenging clients.

## Key Features
- **Zero-risk training environment** with AI-simulated clients
- **Edge case generator** for rare scenarios
- **Dynamic AI responses** based on therapeutic interventions
- **HIPAA++ compliant** privacy and security
- **Bias detection engine** for ensuring fairness across demographic groups
- **Real-time monitoring** and performance analytics

## Technology Stack

### Frontend & Infrastructure
- **Framework**: Astro (with React integration)
- **Languages**: TypeScript, JavaScript
- **Styling**: Tailwind CSS, UnoCSS
- **Package Manager**: pnpm
- **Node.js Version**: 22

### Backend & AI Services
- **Primary Language**: TypeScript (Node.js)
- **Secondary Language**: Python 3.11+
- **AI Frameworks**: 
  - IBM AIF360 for algorithmic fairness
  - Microsoft Fairlearn for constraint-based fairness
  - Hugging Face Transformers for NLP
  - spaCy and NLTK for linguistic analysis
- **Databases**: MongoDB, PostgreSQL, Redis
- **Cloud Services**: AWS (S3, DynamoDB, KMS)

### Key Dependencies
- **AI/ML**: @ai-sdk/openai && @google/genai && transformers && torch
- **UI Components**: @headlessui/react && @radix-ui/react && lucide-react
- **3D Graphics**: three.js && @react-three/fiber && @react-three/drei
- **Monitoring**: @sentry/astro && @sentry/node
- **Data Processing**: pandas && numpy && scikit-learn

## Core Architecture

### Bias Detection Engine
Multi-layer analysis system for identifying and mitigating bias in therapeutic training:
1. **Preprocessing Layer** (spaCy/NLTK) - Linguistic bias detection, demographic analysis
2. **Model-Level Detection** (IBM AIF360) - Algorithmic fairness metrics
3. **Interactive Analysis** (Google What-If Tool concepts) - Counterfactual analysis
4. **Evaluation Layer** (Hugging Face evaluate) - NLP bias metrics

### AI Training Partners
Cognitive AI models that simulate complex client presentations:
- Crisis Presentations (suicidal ideation, acute psychosis)
- Personality Disorders (borderline, narcissistic)
- Trauma Survivors (complex PTSD)
- Resistant Clients (boundary-testing)
- Substance Users (denial, manipulation)

### Privacy & Security
- Fully Homomorphic Encryption (FHE)
- Zero-Knowledge Proofs
- HIPAA++ Compliance
- Real-time bias detection across all interactions

## Project Structure
```
pixelated/
├── ai/                    # Python AI components and services
├── src/                   # Main source code
│   ├── lib/               # Core libraries
│   │   ├── ai/            # AI services and bias detection
│   │   ├── analytics/     # Analytics and monitoring
│   │   ├── chat/          # Chat and communication
│   │   ├── crypto/        # Cryptographic services
│   │   └── security/      # Security implementations
│   └── components/        # UI components
├── astro/                 # Astro-specific configurations
├── public/                # Static assets
├── docs/                  # Documentation
├── tests/                 # Test suite
└── scripts/               # Utility scripts
```

## Development Commands

### Core Development
- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm preview` - Preview production build

### Testing
- `pnpm test` - Run all tests
- `pnpm test:unit` - Run unit tests
- `pnpm test:e2e` - Run end-to-end tests
- `pnpm test:coverage` - Run tests with coverage

### Code Quality
- `pnpm lint` - Run linter
- `pnpm format` - Format code with Prettier
- `pnpm typecheck` - Check TypeScript types

### AI Services
- `pnpm dev:ai-service` - Start AI service development server
- `pnpm dev:bias-detection` - Start bias detection service
- `pnpm initialize-models` - Initialize cognitive models

## Deployment
- **Containerization**: Docker support with provided Dockerfiles
- **Cloud Platforms**: Vercel, AWS, Azure with specific deployment scripts
- **Infrastructure**: Kubernetes configurations available

## Compliance & Standards
- HIPAA++ Compliant
- SOC2 Ready
- GDPR Considerations
- Zero-Knowledge Architecture

## Key URLs
- **Live Demo**: https://pixelatedempathy.com
- **Documentation**: https://docs.pixelatedempathy.com
- **Repository**: (local project)

## Team & Contact
- **Organization**: Pixelated Empathy
- **Contact**: team@pixelatedempathy.com
- **Support**: https://pixelatedempathy.com/support

## Beta Program
Early access available with extended license, personal onboarding, and CE credits for mental health professionals.

---
*Last Updated: August 24, 2025*