---
applyTo: 'none'
---

# Clean Code Guidelines

## Core Principles

- **Readability** over cleverness: Code is read 10x more than it's written
- **Simplicity** over complexity: Simple code is easier to understand, test, and maintain
- **Consistency** throughout the codebase: Follow established patterns and conventions
- **Purpose-driven** naming and organization: Let code be self-documenting

## Naming Conventions

```typescript
// ❌ Poor naming
const d = 86400000; // milliseconds in a day
function f(a, b) {
	return a + b;
}

// ✅ Clear naming
const MILLISECONDS_PER_DAY = 86400000;

function calculateSum(firstNumber, secondNumber) {
	return firstNumber + secondNumber;
}
```

## Function Design

- Keep functions **small** (under 20 lines)
- Ensure functions do **only one thing**
- Use **descriptive verbs** for function names
- Place related functions together

```typescript
// ❌ Too many responsibilities
function processUserData(userData) {
	// validate, transform, save, and notify - too much!
}

// ✅ Single responsibility
function validateUserData(userData) { /* validation logic */
}

function transformUserData(validData) { /* transformation logic */
}

function saveUserData(transformedData) { /* storage logic */
}

function notifyUserProcessed(userId) { /* notification logic */
}
```

## Variables and State

- Minimize **mutable state**
- Keep **variable scope** as limited as possible
- Use **const** by default, **let** when necessary, avoid **var**
- Define variables **close to their usage**

## Control Flow

- Avoid **deep nesting** (more than 2-3 levels)
- Use **early returns** to reduce nesting
- Prefer **guard clauses** over complex if/else chains

```typescript
// ❌ Deeply nested conditions
function getInsuranceAmount(person) {
	if (person) {
		if (person.insurance) {
			if (person.insurance.coverage) {
				return person.insurance.coverage.amount;
			}
		}
	}
	return 0;
}

// ✅ Early returns and optional chaining
function getInsuranceAmount(person) {
	if (!person) return 0;
	return person.insurance?.coverage?.amount || 0;
}
```

## Code Organization

- Group **related functionality** together
- Follow a **consistent file structure**
- Place **interfaces/types** at the beginning or in separate files
- Organize **imports** by category (built-in, external, internal)

## Comments and Documentation

- Write **self-documenting code** first
- Use comments to explain **why**, not what
- Document **public APIs** and complex logic
- Keep JSDoc/TSDoc **up-to-date** with implementation

```typescript
// ❌ Redundant comment
// Calculate the sum of two numbers
function add(a, b) {
	return a + b;
}

// ✅ Necessary explanation
function calculateAdjustedPrice(basePrice: number): number {
	// Apply 15% markup for wholesale orders as per company policy #127
	return basePrice * 1.15;
}
```

## Error Handling

- Handle errors at the **appropriate level**
- Use **specific error types** over generic ones
- Provide **meaningful error messages**
- Avoid **swallowing errors** without proper handling

## Refactoring Patterns

- **Extract Method**: Long functions into smaller ones
- **Extract Class**: Groups of related functions into classes
- **Replace Conditionals**: Complex logic with polymorphism or strategy pattern
- **Remove Duplication**: Apply DRY principle with shared functions

## Language-Specific Best Practices

### TypeScript/JavaScript
- Use **strict type checking** with proper interfaces
- Leverage **functional programming** concepts (map, filter, reduce)
- Prefer **async/await** over raw promises
- Use **destructuring** for cleaner parameter handling
- Apply **optional chaining** (?.) and **nullish coalescing** (??)

### Python
- Follow **PEP 8** style guide
- Use **list/dict comprehensions** for cleaner transformations
- Leverage **context managers** (with statements)
- Prefer **explicit** over implicit
- Use **type hints** for better code documentation

## Performance Considerations

- Optimize for **readability first**, performance second
- Use **profiling tools** to identify real bottlenecks
- Apply **algorithmic improvements** over micro-optimizations
- Consider **memory usage** patterns
- Avoid premature optimization - measure before optimizing

## Code Review Guidelines

### Review Process
- **Focused Reviews**: Limit scope to 200-400 lines per session
- **Purpose Over Style**: Review logic and correctness (use linters for style)
- **Constructive Feedback**: Frame as questions or suggestions
- **Security Focus**: Check for vulnerabilities and data exposure
- **Test Coverage**: Verify appropriate test coverage

### Review Checklist
1. Does code fulfill requirements?
2. Is logic correct and edge cases handled?
3. Is error handling appropriate?
4. Are security considerations addressed?
5. Is performance acceptable?
6. Is code maintainable and well-documented?

## Technical Debt Management

- **Categorize Technical Debt**:
    - **Deliberate**: Strategic decisions to ship faster with known tradeoffs
    - **Inadvertent**: Suboptimal design discovered only in hindsight
    - **Bit Rot**: Gradual degradation as environment changes

- **Track in Codebase**: Mark technical debt with consistent comments:

  ```typescript
  // TECHDEBT(priority:high, issue:123): This implementation doesn't scale beyond 1000 users
  ```

- **Establish Repayment Strategy**:
    - Allocate 10-20% of development time to debt reduction
    - Fix debt opportunistically when touching related code
    - Schedule dedicated "cleanup sprints" periodically

- **Measure and Monitor**: Track technical debt metrics with static analysis tools
- **Prevent New Debt**: Enforce standards through code reviews and automation

## Testing Strategy

### Test Pyramid Structure
- **Unit Tests** (~70%): Fast, isolated tests for functions/methods
- **Integration Tests** (~20%): Component interaction testing
- **E2E Tests** (~10%): Complete user flow validation

### Test Guidelines
- Follow **Arrange-Act-Assert** pattern
- Ensure **test isolation** - each test runs independently
- Use **descriptive test names** that explain the scenario
- Mock external dependencies in unit tests
- Use test data factories for consistent test setup

### Coverage Targets
- Critical business logic: 90%+
- General codebase: 70%+
- Focus on testing behavior, not implementation details

## Legacy Code Refactoring

### Safety-First Approach
- Add characterization tests before refactoring
- Make small, verifiable changes
- Follow "Boy Scout Rule": leave code better than found
- Use "Strangler Pattern" for large-scale refactoring

### Refactoring Techniques
1. **Extract Method**: Break down large functions
2. **Extract Class**: Group related functionality
3. **Rename**: Improve clarity of variables/methods
4. **Encapsulate**: Reduce global state and dependencies

### Risk Management
- Schedule refactoring based on risk/reward analysis
- Update documentation as understanding improves
- Monitor production impact of changes

## Project-Specific Guidelines

### Pixelated Empathy Codebase
- Prioritize **security** and **privacy** in all implementations
- Ensure **HIPAA compliance** in data handling
- Maintain **sub-50ms response times** for AI interactions
- Implement comprehensive **bias detection** monitoring
- Follow **zero-knowledge architecture** principles

Remember: Code is written for humans first, computers second.
