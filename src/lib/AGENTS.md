# AGENTS.md: src/lib/

## PURPOSE

Shared TypeScript utilities, services, and infrastructure: API clients, state management, encryption, domain libraries.

## STRUCTURE

```
src/lib/
├── ai/              # AI service integrations (bias, crisis, inference)
├── api/             # API client configuration
├── auth/            # Authentication & session management
├── db/              # Database access (Prisma/Kysely)
├── fhe/             # Fully homomorphic encryption
├── security/        # Security utilities
├── utils/           # General utilities
├── providers/       # React context providers
├── stores/          # Zustand global state
├── services/        # Business logic services
├── validation/      # Zod schemas
├── types/           # TypeScript definitions
├── monitoring/      # Metrics & logging
├── websocket/       # WebSocket management
└── *.ts             # Single-purpose utilities
```

## CONVENTIONS

- **Domain organization**: Group by feature (`ai/`, `auth/`, `db/`)
- **Services**: Encapsulate business logic; export singletons
- **Utils**: Pure functions, easily testable
- **Barrel exports**: `index.ts` for subdirectory public API
- **Imports**: `@/` → `src/lib/`; use: `import { aiService } from '@/lib'`

## KEY LIBRARIES

| Concern          | Location       | Entry Point          |
|------------------|----------------|----------------------|
| AI services      | ai/services/   | pixelated-empathy-api |
| Auth             | auth/          | session.ts           |
| Database         | db/            | prisma-client.ts     |
| Encryption       | fhe/           | encryptor.ts         |
| Logging          | logging/       | logger.ts            |
| State            | stores/        | use-store.ts         |
| Validation       | validation/    | schemas.ts           |
| WebSocket        | websocket/     | connection.ts        |

## SECURITY

- No PII logging
- FHE for therapeutic content
- Zod validation for external inputs
- Secure defaults
- Audit trails for mutations

## TESTING

- Unit tests in `__tests__/` (co-located or `src/lib/__tests__/`)
- Mock external dependencies
- Validate encryption round-trips
- Benchmark FHE (<50ms requirement)

## PATTERNS

### Service

```typescript
export class Service {
  async operation(input: Input): Promise<Output> { /* ... */ }
}
export const service = new Service()
```

### Hook

```typescript
export function useService() {
  const service = useMemo(() => new Service(), [])
  const op = useCallback(async (input) => { /* ... */ }, [service])
  return { op, loading: false }
}
```

## ANTI-PATTERNS

❌ Business logic in components → `services/`
❌ Hard-coded URLs → use config
❌ Silent failures → always log
❌ Global mutable vars → use stores

---

_Generated: 2025-03-15 | Domain: Frontend Shared Utilities_
