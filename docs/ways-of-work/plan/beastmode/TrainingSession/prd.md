# Training Session UI & Loop PRD

## 1. Feature Name
Training Session UI & Session Loop

## 2. Epic
- [Beastmode Epic PRD](../epic.md)
- [Technical Architecture Spec](../tech-spec.md)

## 3. Goal
**Problem:**
Therapist trainees need a realistic, interactive environment to practice and refine their skills. Existing training tools lack dynamic feedback, session context, and the ability to simulate real client interactions, resulting in limited skill transfer and engagement.

**Solution:**
This feature delivers a robust training session UI and session loop, enabling therapists to engage in simulated therapy sessions with mock clients, receive contextual feedback, and track their progress. The session loop manages state, history, and evaluation, ensuring a seamless and immersive experience.

**Impact:**
- Increased trainee engagement and skill acquisition
- Improved feedback quality and session realism
- Metrics: session completion rate, feedback utilization, trainee satisfaction

## 4. User Personas
- Therapist Trainee
- Clinical Supervisor
- Product/Training Admin

## 5. User Stories
- As a **therapist trainee**, I want to start a training session so that I can practice therapy skills in a simulated environment.
- As a **therapist trainee**, I want to interact with a mock client and receive real-time feedback so that I can improve my approach.
- As a **clinical supervisor**, I want to review session history and feedback so that I can assess trainee progress.
- As a **product admin**, I want to configure session parameters so that training aligns with curriculum goals.

## 6. Requirements
**Functional Requirements:**
- Display a training session UI with session controls (start, end, pause, resume)
- Render mock client responses in real time
- Track session state, history, and context
- Integrate evaluation feedback panel
- Store session data and feedback in the backend
- Support session progress tracking and dashboard integration
- Ensure accessibility (WCAG 2.1)
- Allow configuration of session parameters (duration, scenario, feedback type)

**Non-Functional Requirements:**
- Responsive UI (desktop, tablet)
- Secure data storage (HIPAA compliance)
- Fast feedback (<1s latency for mock responses)
- Audit logging for all session actions
- High availability and reliability
- Data privacy and role-based access control

## 7. Acceptance Criteria
- [ ] Given a trainee, when they start a session, the UI displays session controls and mock client
- [ ] When the trainee interacts, mock client responses are rendered in real time
- [ ] When feedback is available, it is shown in the evaluation panel
- [ ] Session state and history are persisted in the backend
- [ ] Supervisor can view session history and feedback
- [ ] Admin can configure session parameters
- [ ] UI meets accessibility standards
- [ ] All actions are logged for audit

## 8. Out of Scope
- Full LLM integration for client responses
- Patient-facing features
- External EHR/analytics integrations
- Advanced analytics/reporting
- Non-English language support
