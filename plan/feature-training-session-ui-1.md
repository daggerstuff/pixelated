---
goal: Implement Training Session UI & Session Loop for Therapist Simulator
version: 1.0
date_created: 2025-09-10
last_updated: 2025-09-10
owner: Pixelated Empathy Team
status: 'Planned'
tags: [feature, frontend, backend, accessibility, audit, beastmode]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan details the implementation of the Training Session UI and Session Loop for the Pixelated Empathy Therapist Training Simulator (Beastmode). The goal is to deliver a robust, accessible, and auditable training environment for therapist trainees, supporting session state, mock client interaction, feedback, and progress tracking.

## 1. Requirements & Constraints
- **REQ-001**: UI must display session controls (start, end, pause, resume)
- **REQ-002**: Render mock client responses in real time
- **REQ-003**: Track session state, history, and context
- **REQ-004**: Integrate evaluation feedback panel
- **REQ-005**: Store session data and feedback in backend
- **REQ-006**: Support progress tracking and dashboard integration
- **REQ-007**: Ensure accessibility (WCAG 2.1)
- **REQ-008**: Allow configuration of session parameters
- **SEC-001**: Secure data storage (HIPAA compliance)
- **PER-001**: Fast feedback (<1s latency)
- **AUD-001**: Audit logging for all session actions
- **CON-001**: Responsive UI (desktop, tablet)
- **CON-002**: High availability and reliability
- **CON-003**: Data privacy and RBAC
- **PAT-001**: Use modular React components and hooks

## 2. Implementation Steps

### Implementation Phase 1
- GOAL-001: Scaffold UI and session loop components

| Task      | Description                                                        | Completed | Date       |
|-----------|--------------------------------------------------------------------|-----------|------------|
| TASK-001  | Create `TrainingSession.tsx` with session controls and layout      |     x     | 2025-09-10 |
| TASK-002  | Implement session state management with `useConversationMemory`    |     x     | 2025-09-10 |
| TASK-003  | Render mock client responses in UI                                 |     x     | 2025-09-10 |
| TASK-004  | Integrate evaluation feedback panel                                |     x     | 2025-09-10 |
| TASK-005  | Ensure accessibility compliance (WCAG 2.1)                         |     x     | 2025-09-10 |

### Implementation Phase 2
- GOAL-002: Backend integration and audit logging

| Task      | Description                                                        | Completed | Date       |
|-----------|--------------------------------------------------------------------|-----------|------------|
| TASK-006  | Implement `/api/session` for session state/history                 |     x     | 2025-09-10 |
| TASK-007  | Implement `/api/mock-client-response` for mock agent responses     |     x     | 2025-09-10 |
| TASK-008  | Implement `/api/evaluation` for feedback storage                   |     x     | 2025-09-10 |
| TASK-009  | Store session data and feedback in PostgreSQL                      |     x     | 2025-09-10 |
| TASK-010  | Implement audit logging for all session actions                    |     x     | 2025-09-10 |
| TASK-011  | Enforce HIPAA compliance and RBAC                                  |     x     | 2025-09-10 |

### Implementation Phase 3
- GOAL-003: Progress tracking, dashboard, and configuration

| Task      | Description                                                        | Completed | Date       |
|-----------|--------------------------------------------------------------------|-----------|------------|
| TASK-012  | Integrate session progress tracking and dashboard UI               |     x     | 2025-09-10 |
| TASK-013  | Add configuration options for session parameters                   |     x     | 2025-09-10 |
| TASK-014  | Finalize responsive UI for desktop/tablet                          |     x     | 2025-09-10 |
| TASK-015  | Validate high availability and reliability                         |     x     | 2025-09-10 |

## 3. Alternatives
- **ALT-001**: Use a monolithic UI component (rejected for maintainability)
- **ALT-002**: Store session data in-memory only (rejected for persistence/audit)

## 4. Dependencies
- **DEP-001**: React, Astro, TypeScript
- **DEP-002**: Node.js backend, Express/REST
- **DEP-003**: PostgreSQL database
- **DEP-004**: Accessibility libraries (e.g., react-aria)
- **DEP-005**: Audit logging module

## 5. Files
+ **FILE-001**: `src/components/TrainingSession.tsx` (UI component)
+ **FILE-002**: `src/hooks/useConversationMemory.ts` (state management)
+ **FILE-003**: `src/components/EvaluationFeedbackPanel.tsx` (feedback UI)
+ **FILE-004**: `src/pages/api/session.ts` (backend endpoint)
+ **FILE-005**: `src/pages/api/mock-client-response.ts` (backend endpoint)
+ **FILE-006**: `src/pages/api/evaluation.ts` (backend endpoint)
+ **FILE-007**: `db/session.sql` (PostgreSQL schema)
+ **FILE-008**: `audit/auditLogger.ts` (audit logging)
| File ID   | Path                                                        | Purpose                       |
|-----------|-------------------------------------------------------------|-------------------------------|
| FILE-001  | src/components/TrainingSession.tsx                          | UI component                  |
| FILE-002  | src/hooks/useConversationMemory.ts                          | State management              |
| FILE-003  | src/components/EvaluationFeedbackPanel.tsx                  | Feedback UI                   |
| FILE-004  | src/lib/api/session.ts                                      | Backend endpoint              |
| FILE-005  | src/lib/api/mock-client-response.ts                         | Backend endpoint              |
| FILE-006  | src/lib/api/evaluation.ts                                   | Backend endpoint              |
| FILE-007  | db/session.sql                                              | PostgreSQL schema             |
| FILE-008  | audit/auditLogger.ts                                        | Audit logging                 |
| TEST-001  | src/components/TrainingSession.test.tsx                     | UI component unit tests       |
| TEST-002  | src/lib/api/session.test.ts                                 | API endpoint tests            |
| TEST-003  | src/lib/api/mock-client-response.test.ts                    | API endpoint tests            |
| TEST-004  | src/lib/api/evaluation.test.ts                              | API endpoint tests            |
| TEST-005  | audit/auditLogger.test.ts                                   | Audit logging tests           |
| TEST-006  | src/pages/dev/accessibility-test.astro                      | Accessibility tests           |
| TEST-007  | src/pages/api/bias-detection/dashboard.test.ts              | Dashboard tests               |
## 6. Testing

**TEST-001**: Unit tests for UI components (`src/components/TrainingSession.test.tsx`)
**TEST-002**: API endpoint tests (`src/lib/api/session.test.ts`, `src/lib/api/mock-client-response.test.ts`, `src/lib/api/evaluation.test.ts`)
**TEST-003**: Audit logging tests (`audit/auditLogger.test.ts`)
**TEST-004**: Accessibility tests (`src/pages/dev/accessibility-test.astro`)
**TEST-005**: Dashboard tests (`src/pages/api/bias-detection/dashboard.test.ts`)

## 7. Risks & Assumptions
- **RISK-001**: Latency in mock client responses may impact UX
- **RISK-002**: Accessibility compliance may require iterative fixes
- **RISK-003**: Data privacy breaches if audit logging is incomplete
- **ASSUMPTION-001**: All trainees have desktop/tablet access
- **ASSUMPTION-002**: Mock agent is sufficient for MVP

## 8. Related Specifications / Further Reading
- [Beastmode Epic PRD](../docs/ways-of-work/plan/beastmode/epic.md)
- [Technical Architecture Spec](../docs/ways-of-work/plan/beastmode/tech-spec.md)
- [Training Session PRD](../docs/ways-of-work/plan/beastmode/TrainingSession/prd.md)
