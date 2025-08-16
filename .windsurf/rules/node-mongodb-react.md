# Node.js + MongoDB + JWT + Express + React Copilot Instructions

## Tech Stack

- Backend: Node.js with Express.js
- Database: MongoDB with Mongoose ODM
- Frontend: React.js (admin panel, if required)
- Authentication: JSON Web Tokens (JWT)
- Version Control: Git
- Deployment: Docker (optional)

## User Requirements & Flow

- Strictly follow user flow and game rules.
- Users browse Pools, submit up to 3 Requests per Pool, complete payment, and await admin approval.
- Approved Requests become Entries (max 3 per Pool, numbered 1, 2, 3).
- Users make Picks for each Entry; Picks can be updated until the deadline.
- Scoring: Win = Entry advances, Loss = Entry eliminated. Each Entry ranked separately.
- Pool standings show all Entries; members can view all Picks after scoring.

## Implementation Strategy

- Begin each feature with detailed pseudocode (summarize pick submission, API endpoints, and business logic before
  coding).
- Ensure secure, efficient, RESTful code with proper error handling and input validation.
- Track Requests and Entries separately; limit 3 Requests per User per Pool.
- Implement payment status tracking in Request model.
- Create Entry only after admin approval and payment completion.
- Admin interface for managing/approving Requests.
- Implement state transitions: Request (pending → approved → Entry created).

Refer to project documentation for further details and best practices.