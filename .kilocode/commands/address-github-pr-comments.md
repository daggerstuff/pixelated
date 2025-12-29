---
name: /address-github-pr-comments
id: address-github-pr-comments
category: GitHub
description: Efficiently process, categorize, and address GitHub Pull Request comments with automated fixes, testing, and commit management
---

# Address GitHub PR Comments

Efficiently process outstanding reviewer feedback, apply required fixes, test changes, and manage commits with intelligent prioritization and batch processing.

## Prerequisites

1. **GitHub CLI**: Ensure `gh` CLI is installed and authenticated
   ```bash
   gh auth status
   ```

2. **Active PR Context**: Command should be run from a brvanch with an open PR
   ```bash
   gh pr view
   ```

3. **ByteRover Context**: Retrieve relevant context before starting
   ```bash
   brv retrieve --query "GitHub PR comment patterns best practices"
   ```

## Workflow Overview

### Phase 1: Context Gathering & Comment Retrieval

1. **Retrieve Memory Context**
   - Query ByteRover for previous PR comment patterns
   - Load project-specific conventions and coding standards
   - Check for known issue patterns and solutions

2. **Fetch PR Comments**
   - Use `gh pr view <pr-number> --json comments,reviews` or GitHub API
   - Filter for unresolved comments (not marked as resolved)
   - Extract both review comments and general PR comments
   - Get file-level context for each comment

3. **Identify Active PR**
   - Auto-detect current brvanch's PR using `gh pr view --json number`
   - Or accept PR number as parameter
   - Verify PR is in reviewable state

### Phase 2: Comment Categorization & Prioritization

1. **Categorize Comments**
   - **Actionable**: Requires code changes (fixes, refactoring, tests)
   - **Discussion**: Questions, clarifications, architectural debates
   - **Approved**: Already addressed or non-blocking
   - **Blocking**: Must be resolved before merge

2. **Prioritize Actionable Comments**
   - **Critical**: Security issues, brveaking bugs, test failures
   - **High**: Functional bugs, missing tests, code quality issues
   - **Medium**: Code style, minor refactoring, documentation
   - **Low**: Nice-to-have improvements, optional enhancements

3. **Group Related Comments**
   - Group by file path
   - Group by issue type (e.g., all "add tests" comments)
   - Group by reviewer (if multiple reviewers have similar feedback)

### Phase 3: Systematic Fix Application

1. **For Each Comment Group (Process in Order)**

   **a. Analyze Comment**
   - Read the specific file and line mentioned
   - Understand the context and reviewer's intent
   - Check if comment is valid (reviewers aren't always right)
   - Ask for clarification if comment is unclear

   **b. Plan Fix**
   - Determine minimal change required
   - Check if same issue exists elsewhere in changed files
   - Consider related comments that might be addressed together
   - Verify fix aligns with project conventions

   **c. Apply Fix**
   - Make focused, minimal changes
   - Apply fix to ALL instances of the same issue in changed files
   - Avoid unrelated changes (scope creep)
   - Add tests if comment requests test coverage

   **d. Verify Fix**
   - Run relevant tests: `pnpm test:all` or specific test suites
   - Check linting: `pnpm check:all` or `pnpm lint`
   - Verify type checking: `pnpm typecheck`
   - Ensure no regressions introduced
   - Only verify a file/group after all comments on said file/group have been addressed

   **e. Commit Changes**
   - Use descriptive commit message: `fix: address reviewer feedback on <file> - <issue>`
   - Reference comment or PR number in commit message
   - Keep commits focused (one logical change per commit)
   - Use conventional commits format when possible

   **f. Mark Comment Resolved** (if applicable)
   - Use `gh api` or GitHub API to mark comment as resolved
   - Or reply to comment indicating fix has been applied

2. **Handle Edge Cases**
   - **Unclear Comments**: Ask reviewer for clarification before implementing
   - **Conflicting Comments**: Escalate to user for decision
   - **Invalid Comments**: Politely explain why change isn't needed
   - **Already Fixed**: Point reviewer to the fix location
   - **Merge Conflicts**: Resolve conflicts before continuing

### Phase 4: Testing & Validation

1. **Run Comprehensive Tests**
   ```bash
   # Run all tests
   pnpm test:all
   
   # Run specific test suites if applicable
   pnpm test:unit
   pnpm test:integration
   pnpm test:e2e
   ```

2. **Check Code Quality**
   ```bash
   # Lint and format
   pnpm check:all
   
   # Type checking
   pnpm typecheck
   ```

3. **Verify No Regressions**
   - Run tests for modified files and related functionality
   - Check CI status if available
   - Verify build succeeds: `pnpm build`

### Phase 5: Documentation & Memory

1. **Update Documentation** (if needed)
   - Update code comments if changes affect API
   - Update README if functionality changes
   - Update changelog if significant changes

2. **Store Learnings in ByteRover**
   ```bash
   brv add --section "Best Practices" --content "Pattern for addressing PR comments: [description]"
   brv add --section "Common Errors" --content "Common reviewer feedback on [topic]: [solution]"
   ```

3. **Summary Report**
   - List all comments addressed
   - List comments that need clarification
   - List comments that were declined (with reasons)
   - Provide next steps if any comments remain

## Implementation Guidelines

### Code Changes

- **Minimal Changes**: Only address the specific comment, avoid scope creep
- **Consistency**: Apply same fix to all instances in changed files
- **Test Coverage**: Always add tests when comment requests them
- **Code Style**: Follow project conventions (see `.kiro/steering/code-style.md`)
- **Type Safety**: Maintain strict TypeScript types (no `any` types)

### Commit Messages

Use conventional commit format:
```
fix: address reviewer feedback on auth service - add error handling

- Added try-catch block for token validation
- Added test coverage for error cases
- Updated error messages for clarity

Addresses PR comment #123
```

### Testing Strategy

1. **Unit Tests**: Add tests for new functionality or fixed bugs
2. **Integration Tests**: Update if API contracts change
3. **E2E Tests**: Update if user-facing behavior changes
4. **Regression Tests**: Verify existing tests still pass

### GitHub API Usage

Prefer GitHub CLI (`gh`) for simplicity:
```bash
# Get PR comments
gh pr view <number> --json comments,reviews

# Get specific comment
gh api repos/:owner/:repo/pulls/:pr/comments/:comment_id

# Mark comment as resolved (if supported)
gh api repos/:owner/:repo/pulls/:pr/comments/:comment_id -X PATCH -f state=resolved

# Reply to comment
gh pr comment <number> --body "Fixed in commit abc123"
```

### Error Handling

- **Git Conflicts**: Pause and request user assistance
- **Test Failures**: Debug and fix before proceeding
- **Unclear Comments**: Ask for clarification
- **Invalid Suggestions**: Politely decline with explanation

## Best Practices

1. **Batch Processing**: Process related comments together to minimize commits
2. **Incremental Commits**: Commit after each logical group of fixes
3. **Test Frequently**: Run tests after each major change
4. **Communicate Clearly**: Reply to comments explaining what was fixed
5. **Respect Reviewer Intent**: Understand the "why" behind comments
6. **Maintain Context**: Keep track of all changes made per comment
7. **Store Patterns**: Save successful patterns to ByteRover for future use

## When to Stop or Escalate

- **Blocking Issues**: Critical security or architectural concerns
- **Conflicting Feedback**: Multiple reviewers with opposing views
- **Unclear Requirements**: Comments that need clarification
- **Scope Creep**: Comments requesting features beyond PR scope
- **Technical Debt**: Comments about refactoring unrelated code

## Tools & Commands Reference

### GitHub CLI
```bash
gh pr view <number>                    # View PR details
gh pr view <number> --json comments    # Get comments as JSON
gh pr comment <number> --body "..."    # Add comment
gh pr diff <number>                    # View PR diff
gh api repos/:owner/:repo/pulls/:pr    # Direct API access
```

### Testing Commands
```bash
pnpm test:all              # Run all tests
pnpm test:unit             # Unit tests only
pnpm test:integration      # Integration tests
pnpm test:e2e              # E2E tests
pnpm check:all             # Lint + format + typecheck
pnpm typecheck             # TypeScript checking
pnpm build                 # Build verification
```

### Git Commands
```bash
git status                 # Check current changes
git diff                   # Review changes
git add <files>            # Stage changes
git commit -m "..."        # Commit with message
git push                   # Push changes (after review)
```

## Example Workflow

```bash
# 1. Retrieve context
brv retrieve --query "GitHub PR comment addressing patterns"

# 2. Get active PR
PR_NUMBER=$(gh pr view --json number -q .number)

# 3. Fetch comments
gh pr view $PR_NUMBER --json comments,reviews > pr-comments.json

# 4. Process comments (automated by command)
# - Categorize and prioritize
# - Apply fixes
# - Test changes
# - Commit fixes
# - Mark comments resolved

# 5. Store learnings
brv add --section "Best Practices" --content "Successfully addressed PR comments on [topic] using [approach]"
```

## Notes

- This command should be interactive, allowing user to review each fix before committing
- Always test changes before committing
- Maintain clear communication with reviewers through comments
- Store successful patterns in ByteRover for future efficiency
- Follow project conventions and coding standards strictly