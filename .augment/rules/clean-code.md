# Clean Code: Optimized Guidelines for Augment

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
// ❌ Redundant commen
// Calculate the sum of two numbers
function add(a, b) {
	return a + b;
}

// ✅ Necessary explanation
function calculateAdjustedPrice(basePrice) {
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

### JavaScript/TypeScript

- Use **strict type checking**
- Leverage **functional programming** concepts
- Prefer **async/await** over raw promises
- Use **destructuring** for cleaner parameter handling

### Python

- Follow **PEP 8** style guide
- Use **list/dict comprehensions** for cleaner transformations
- Leverage **context managers** (with statements)
- Prefer **explicit** over implici

### Java/Kotlin

- Follow standard **naming conventions**
- Use **streams** for collection processing
- Leverage **immutable objects** where appropriate
- Apply **dependency injection** for testable code

## Performance Considerations

- Optimize for **readability first**, performance second
- Use **profiling tools** to identify real bottlenecks
- Apply **algorithmic improvements** over micro-optimizations
- Consider **memory usage** patterns

## Code Review Best Practices

- **Focused Reviews**: Limit review scope to 200-400 lines of code per session
- **Purpose, Not Style**: Review for logic and correctness, not just style (use linters for style)
- **Constructive Feedback**: Frame comments as questions or suggestions, not commands
- **Verify Test Coverage**: Ensure new code has appropriate tests
- **Look for Security Issues**: Check for OWASP Top 10 vulnerabilities
- **Document Decisions**: Use PR comments to document why certain approaches were chosen

- **Review Checklist**:
    1. Does the code fulfill requirements?
    2. Is the logic correct?
    3. Are edge cases handled?
    4. Is there proper error handling?
    5. Is there appropriate logging?
    6. Is performance considered?
    7. Is the code maintainable?

## Technical Debt Management

- **Categorize Technical Debt**:
    - **Deliberate**: Strategic decisions to ship faster with known tradeoffs
    - **Inadvertent**: Suboptimal design discovered only in hindsight
    - **Bit Rot**: Gradual degradation as environment changes

- **Track in Codebase**: Mark technical debt with consistent comments:'

  ```typescript
  // TECHDEBT(priority:high, issue:123): This implementation doesn't scale beyond 1000 users
  ```

- **Establish Repayment Strategy**:
    - Allocate 10-20% of development time to debt reduction
    - Fix debt opportunistically when touching related code
    - Schedule dedicated "cleanup sprints" periodically

- **Measure and Monitor**: Track technical debt metrics with static analysis tools
- **Prevent New Debt**: Enforce standards through code reviews and automation

## Testing Pyramid

- **Unit Tests** (base layer, ~70%):
    - Test small units in isolation (functions, methods, classes)
    - Should be fast, numerous, and reliable
    - Mock external dependencies

  ```typescript
  test('calculateTotal adds tax correctly', () => {
    expect(calculateTotal(100, 0.1)).toBe(110);
  });
  ```

- **Integration Tests** (middle layer, ~20%):
    - Test interactions between components
    - Verify subsystems work together correctly
    - May include database access, file I/O

  ```typescript
  test('user registration stores data in database', async () => {
    const user = await registerUser({name: 'Test', email: 'test@example.com'});
    const fromDb = await getUserByEmail('test@example.com');
    expect(fromDb).toMatchObject({name: 'Test'});
  });
  ```

- **End-to-End Tests** (top layer, ~10%):
    - Test complete user flows
    - Run against fully integrated system
    - Simulate real user behavior

  ```typescript
  test('user can log in and view dashboard', async () => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForSelector('.dashboard');
    expect(await page.isVisible('.username')).toBe(true);
  });
  ```

- **Test Structure**: Follow Arrange-Act-Assert pattern
- **Test Isolation**: Each test should run independently
- **Test Data**: Use factories or builders for test data

- **Coverage Goals**:
    - Critical paths: 90%+
    - Business logic: 80%+
    - Overall code: 70%+

## Refactoring Legacy Code

- **Establish Safety Net**:
    - Add characterization tests that document current behavior
    - Use approval tests for complex outputs
    - Set up monitoring for production impacts
- **Incremental Approach**:
    - Follow "Boy Scout Rule": Leave code better than you found it
    - Use "Strangler Pattern" for large refactorings
    - Make small, verifiable changes

- **Techniques for Untested Code**:
    1. **Sprout Method**: Add new functionality in new methods
    2. **Sprout Class**: Add new functionality in new classes
    3. **Wrap Method**: Wrap existing method with pre/post behavior
    4. **Extract Interface**: Create abstraction to enable testing

- **Addressing Common Legacy Issues**:
    - Break down monolithic functions using Extract Method
    - Improve naming with Rename Variable/Method
    - Reduce global state by encapsulating variables
    - Add missing abstractions with Extract Class/Interface

- **Documentation**: Update documentation as code understanding improves
- **Risk Management**: Schedule refactorings based on risk/reward profile

Remember: Code is for humans first, computers second.