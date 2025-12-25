# MVP Task List: Pixelated Empathy Therapist Training Simulator (Beastmode)

## Frontend
- [ ] Scaffold `TrainingSession.tsx` with basic UI and session loop
- [ ] Implement therapist dashboard and progress tracking
- [ ] Integrate `useConversationMemory` for session state
- [ ] Add evaluation feedback panel
- [ ] Ensure accessibility compliance

## Backend
- [ ] Create `/api/mock-client-response` endpoint
- [ ] Implement `/api/session` for context/history
- [ ] Add `/api/evaluation` for feedback
- [ ] Set up PostgreSQL schema for sessions and feedback
- [ ] Secure authentication and data storage

## AI & Evaluation
- [ ] Integrate mock agent for client responses
- [ ] Implement bias detection module
- [ ] Add basic evaluation logic (risk assessment)

## Hosting & Security
- [ ] Dockerize frontend and backend
- [ ] Set up CI/CD pipeline
- [ ] Implement audit logging
- [ ] Validate HIPAA compliance

## Documentation & Testing
- [ ] Document architecture and learnings
- [ ] Write test cases for edge scenarios
- [ ] Adversarially test for bias and security

## Out of Scope (MVP)
- Full LLM integration
- Patient-facing features
- External integrations (EHR, analytics)
- Advanced analytics/reporting
- Non-English language support
