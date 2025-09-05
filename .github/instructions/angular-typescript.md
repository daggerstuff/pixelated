---
inclusion: fileMatch
fileMatchPattern: ['**/*.ts', '**/*.tsx', '**/*.component.html', '**/*.component.scss']
---

# Angular + TypeScript Development Guidelines

## Core Principles

- **Angular 18** with TypeScript strict mode enabled
- **Jest** for unit testing with comprehensive coverage
- **Performance-first** approach with OnPush change detection
- **Type safety** with strict TypeScript configuration
- **Accessibility** compliance (WCAG AA standards)

## Code Style & Architecture

### TypeScript Standards
- Use strict typing with explicit return types
- Prefer `interface` over `type` for object definitions
- Implement proper error handling with typed exceptions
- Use `readonly` for immutable data structures
- Apply interface augmentation over `var` declarations for global types

### Angular Patterns
- **Components**: Single responsibility, max 200 lines
- **Services**: Injectable with `providedIn: 'root'` when appropriate
- **Modules**: Feature-based organization with lazy loading
- **Change Detection**: OnPush strategy for performance optimization
- **Lifecycle**: Implement OnDestroy for cleanup and memory management

### Function Guidelines
- Maximum 4 parameters per function/method
- Maximum 50 executable lines per function
- Use descriptive names following camelCase convention
- Prefer pure functions where possible

## Code Organization

### File Structure
```
src/
├── app/
│   ├── core/           # Singleton services, guards, interceptors
│   ├── shared/         # Reusable components, pipes, directives
│   ├── features/       # Feature modules with lazy loading
│   └── layouts/        # Application layout components
```

### Naming Conventions
- **Components**: `user-profile.component.ts`
- **Services**: `user-data.service.ts`
- **Interfaces**: `UserProfile`, `ApiResponse<T>`
- **Enums**: `UserRole`, `ApiStatus`
- **Constants**: `API_ENDPOINTS`, `DEFAULT_CONFIG`

## Performance Optimization

### Change Detection
- Use OnPush change detection strategy
- Implement trackBy functions for *ngFor loops
- Prefer async pipe over manual subscriptions
- Use `ChangeDetectorRef.detach()` for complex scenarios

### Memory Management
- Implement OnDestroy lifecycle hook
- Unsubscribe from observables using takeUntil pattern
- Use WeakMap/WeakSet for temporary references
- Avoid memory leaks in event listeners

## Testing Standards

### Unit Testing
- Minimum 80% code coverage for critical components
- Use TestBed for component testing
- Mock external dependencies with jasmine spies
- Test both positive and negative scenarios
- Follow AAA pattern (Arrange, Act, Assert)

### Integration Testing
- Test component-service interactions
- Validate routing and navigation
- Test form validation and submission
- Verify accessibility features

## Template Guidelines

### HTML Best Practices
- Use semantic HTML elements
- Implement proper ARIA attributes
- Follow .htmlhintrc configuration
- Minimize template complexity (max 3 levels of nesting)

### Angular Directives
- Prefer structural directives over complex template logic
- Use trackBy functions for performance
- Implement proper error handling in templates
- Use async pipe for observable data

## State Management

### Local State
- Use reactive forms for complex form handling
- Implement proper validation with custom validators
- Use BehaviorSubject for component communication

### Global State
- Consider NgRx for complex state management
- Use services with observables for simple shared state
- Implement proper error handling and loading states

## Security Practices

- Sanitize user inputs and outputs
- Use Angular's built-in XSS protection
- Implement proper authentication guards
- Validate data at component boundaries
- Use HTTPS for all API communications

## Accessibility Requirements

- Implement keyboard navigation support
- Use proper heading hierarchy (h1-h6)
- Provide alt text for images
- Ensure sufficient color contrast ratios
- Test with screen readers

## Error Handling

- Implement global error handler
- Use typed error responses from APIs
- Provide user-friendly error messages
- Log errors appropriately for debugging
- Implement retry mechanisms for network failures

## Code Quality Tools

- Follow .eslintrc.json rules strictly
- Use .prettierrc for consistent formatting
- Adhere to .htmlhintrc for template quality
- Respect .editorconfig settings
- Run static analysis before commits