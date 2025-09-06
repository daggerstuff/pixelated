# Dependency Injection Pattern for EmotionSynthesizer

## Overview

This implementation demonstrates best practices for dependency injection using the EmotionSynthesizer service with the PatientResponseService. The approach balances performance, testability, and maintainability.

## Pattern Implementation

### 1. Singleton Pattern with Factory Reset

```typescript
export class EmotionSynthesizer {
  private static instance: EmotionSynthesizer | null = null;
  
  public static getInstance(): EmotionSynthesizer {
    if (!EmotionSynthesizer.instance) {
      EmotionSynthesizer.instance = new EmotionSynthesizer();
    }
    return EmotionSynthesizer.instance;
  }
  
  public static createTestInstance(): EmotionSynthesizer {
    return new EmotionSynthesizer();
  }
  
  public static resetInstance(): void {
    EmotionSynthesizer.instance = null;
  }
}
```

### 2. Dependency Injection in Service Constructor

```typescript
export class PatientResponseService {
  constructor(
    profileService: PatientProfileService,
    consistencyService: BeliefConsistencyService,
    emotionSynthesizer?: EmotionSynthesizer, // Optional with fallback
  ) {
    this.emotionSynthesizer = emotionSynthesizer || EmotionSynthesizer.getInstance();
  }
}
```

### 3. Factory Functions for Configuration

```typescript
// Production factory
export function createPatientResponseService(options?: {
  emotionSynthesizer?: EmotionSynthesizer;
  // other dependencies...
}): PatientResponseService {
  return new PatientResponseService(
    profileService,
    consistencyService,
    options?.emotionSynthesizer || EmotionSynthesizer.getInstance()
  );
}

// Testing factory
export function createTestPatientResponseService(): PatientResponseService {
  return new PatientResponseService(
    mockProfileService,
    mockConsistencyService,
    EmotionSynthesizer.createTestInstance() // Isolated instance
  );
}
```

## Benefits

### 1. **Improved Testability**

- **Isolated Testing**: Each test gets its own EmotionSynthesizer instance
- **Easy Mocking**: Dependencies can be easily replaced with mocks
- **State Isolation**: Tests don't interfere with each other

```typescript
// Test example
describe('PatientResponseService', () => {
  beforeEach(() => {
    EmotionSynthesizer.resetInstance(); // Clean state
  });
  
  it('should synthesize emotions correctly', () => {
    const service = createTestPatientResponseService();
    // Test with isolated dependencies
  });
});
```

### 2. **Consistency Across Application**

- **Shared State**: Production code uses singleton for consistent emotional state
- **Memory Efficiency**: Single instance reduces memory footprint
- **State Persistence**: Emotional context maintained across interactions

### 3. **Flexible Configuration**

- **Custom Instances**: Different parts of the app can use custom configurations
- **Environment-Specific Setup**: Different configurations for dev/test/prod
- **Runtime Reconfiguration**: Dependencies can be swapped at runtime

### 4. **Maintainability**

- **Central Configuration**: Factory functions provide single point of dependency setup
- **Loose Coupling**: Services depend on interfaces, not concrete implementations
- **Easy Refactoring**: Dependency changes are localized to factory functions

## Usage Examples

### Production Code

```typescript
// Default configuration
const service = createPatientResponseService();

// Custom configuration
const customSynthesizer = EmotionSynthesizer.getInstance();
const service = createPatientResponseService({
  emotionSynthesizer: customSynthesizer
});
```

### Testing Code

```typescript
// Isolated testing
const service = createTestPatientResponseService();

// With mocks
const mockSynthesizer = createMockEmotionSynthesizer();
const service = createTestPatientResponseService({
  emotionSynthesizer: mockSynthesizer
});
```

### Integration with Emotional Context

```typescript
const service = createPatientResponseService();

// Use emotional synthesis in response generation
const emotionalContext = await service.synthesizeEmotionalContext(
  responseContext, 
  'sadness'
);

// Get current emotional state
const currentProfile = service.getCurrentEmotionalProfile();

// Reset for new session
service.resetEmotionalState();
```

## Performance Considerations

- **Singleton Benefits**: Reduced memory usage and instantiation overhead
- **Lazy Loading**: Instance created only when first needed
- **State Sharing**: Emotional context preserved across service calls
- **Clean Separation**: Testing isolation doesn't impact production performance

## Migration Path

If you have existing code creating EmotionSynthesizer directly:

```typescript
// Before
const synthesizer = new EmotionSynthesizer();
const service = new PatientResponseService(profileService, consistencyService);

// After
const service = createPatientResponseService();
// EmotionSynthesizer is automatically provided via dependency injection
```

This approach provides the flexibility of dependency injection while maintaining the performance benefits of the singleton pattern where appropriate.
