# Add User Registration Endpoint Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a POST /register endpoint that validates input, creates a user record, and returns a JWT token.

**Architecture:**
- Introduce a new controller file to handle registration logic.
- Update the routing configuration to include the new endpoint.
- Add a service layer for business logic and database interaction.
- Implement JWT generation for authentication tokens.
- Write unit tests to verify validation, user creation, and token issuance.

**Tech Stack:**
- Node.js with Express
- TypeScript
- JWT (jsonwebtoken) for token creation
- Jest for testing
- Class-validator for input validation

---
### Task Breakdown

#### Task 1: Create Auth Controller File
- **Files:** `src/controllers/auth.controller.ts`
- **Action:** Implement `register` function that receives request data, validates it, calls the auth service, and returns a response.
- **Command:** Create the file with minimal skeleton.

#### Task 2: Add Validation Schema
- **Files:** `src/validation/register-schema.ts`
- **Action:** Define a class using class-validator decorators that enforces email format, password strength, and required fields.
- **Action:** Import and use this schema in the controller.

#### Task 3: Implement Auth Service Method
- **Files:** `src/services/auth.service.ts`
- **Action:** Write `register` method that receives validated data, creates a user in the database, and returns user data without password.
- **Action:** Add any necessary repository interaction (e.g., Prisma or TypeORM query).

#### Task 4: Create Route Binding
- **Files:** `src/routes/auth.routes.ts`
- **Action:** Import the express.Router, mount `/register`, and bind the controller method.
- **Action:** Ensure the route is exported for inclusion in the main app routes.

#### Task 5: Write Unit Tests
- **Files:** `src/tests/auth.test.ts`
- **Action:** Write tests that cover:
  - Successful registration with valid data.
  - Validation failures (invalid email, weak password, missing fields).
  - Duplicate email handling.
- **Action:** Mock the auth service and verify interactions.

#### Task 6: Update Configuration (if needed)
- **Files:** `tsconfig.json` (paths) or `.env` (JWT secret)
- **Action:** Add any necessary path mappings or environment variable entries.

#### Task 7: Add Documentation
- **Files:** `docs/api/registration.md`
- **Action:** Write a brief documentation page describing the endpoint, request/response structure, validation rules, and error codes.

#### Task 7.5: Commit Changes
- Stage all modified/added files.
- Commit with message: `feat: add POST /register endpoint with validation and JWT token`

---

**Next Steps:**
- Review the plan and confirm the approach.
- If approved, proceed with executing the tasks in order.

**Which approach do you prefer for executing the plan?**
- **1.** Use the Subagent-Driven approach (this session) – I will dispatch fresh subagents per task with code reviews.
- **2.** Open a Parallel Session – I will switch to a new session using executing-plans and run the plan there.

Please indicate which approach you’d like to use.