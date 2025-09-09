---
description: 'Instructions for implementing tasks based on planning files'
---

# Task Implementation Instructions

## Core Principles

Follow these instructions systematically when implementing tasks. You WILL use the generated planning files as your guide. Ensure all changes align with project standards, and document updates in the changes tracking file.

**CRITICAL**: Implement phase-by-phase, verifying each step before proceeding. Use tools like #editFiles, #runTests, and #search to make and validate changes.

## Implementation Workflow

### Step 1: Preparation
- Review the plan file: `./.copilot-tracking/plans/YYYYMMDD-task-description-plan.instructions.md`
- Review details: `./.copilot-tracking/details/YYYYMMDD-task-description-details.md`
- Create or update changes tracking: `./.copilot-tracking/changes/YYYYMMDD-task-description-changes.md`
- Ensure all dependencies are met (tools, environments, prerequisites).

### Step 2: Phase-by-Phase Execution
For each phase in the plan:
1. Read the checklist items and corresponding details.
2. Implement specific actions:
   - Create/modify files as specified.
   - Use exact code snippets or patterns from research.
   - Handle dependencies and edge cases.
3. Test incrementally: Run unit tests, integration checks, or manual verification.
4. Document changes: Update the changes file with summaries and file links.
5. Mark as complete in the plan checklist if verified.

**Pause Points**: If configured (e.g., phaseStop or taskStop), stop for review after each phase/task.

### Step 3: Validation and Cleanup
- Verify success criteria for the entire task.
- Run full tests: #runTests, #problems check.
- Update any related documentation.
- If complete, summarize changes and provide links to planning files.
- Recommend cleanup: Delete or archive planning files if no longer needed.

## Best Practices
- **Code Quality**: Adhere to clean code principles, add tests, handle errors.
- **Version Control**: Commit changes with descriptive messages referencing the plan.
- **Research Alignment**: Ensure implementation matches validated research findings.
- **Error Handling**: If issues arise, reference research or update planning files.

## Success Indicators
- All checklist items marked [x].
- No errors in tests or builds.
- Changes documented and verifiable.
- Project functionality enhanced as per objectives.
