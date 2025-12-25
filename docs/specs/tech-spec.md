# Technical Architecture Specification: Pixelated Empathy Therapist Training Simulator (Beastmode)

## 1. Overview
This document translates the Epic PRD into a detailed technical architecture and actionable engineering plan for the MVP.

---

## 2. System Architecture

### Frontend
- **Framework:** Astro + React
- **Key Components:**
  - Training session UI (`TrainingSession.tsx`)
  - Therapist dashboard
  - Evaluation feedback panel
  - Progress tracking dashboard
- **State Management:**
  - `useConversationMemory` for session state
  - Context API for global state
- **Accessibility:**
  - WCAG 2.1 compliance

### Backend
- **API:** Node.js/TypeScript (REST/SSE)
- **Endpoints:**
  - `/api/mock-client-response` (returns mock agent responses)
  - `/api/session` (session context, history)
  - `/api/evaluation` (therapist feedback)
- **Database:** PostgreSQL (via `pixelated_db`)
- **Session Storage:**
  - Store therapist actions, session context, and feedback

### AI & Evaluation
- **Agent:** Mock agent for MVP (upgradeable to LLM)
- **Modules:**
  - Bias detection
  - Evaluation logic (risk assessment, feedback)
- **Integration:**
  - Modular API for agent responses and evaluation

### Hosting & Security
- **Deployment:** Dockerized multi-stage builds
- **Cloud:** Azure, GCP, or AWS
- **CI/CD:** Azure Pipelines
- **Security:**
  - Non-root containers
  - Encrypted data
  - Audit logging
  - HIPAA compliance

---

