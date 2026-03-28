# Governance Module

HIPAA++ compliant data governance layer.

## Components

- **Policy Engine**: Access rules and evaluation
- **Compliance Validator**: Pre-flight HIPAA checks
- **Unified Monitor**: Cross-component alerting
- **Lifecycle Manager**: Retention and deletion

## Architecture

The governance layer acts as middleware that doesn't modify existing FHE/audit/secrets code. It provides:

- Zero-trust policy evaluation (every request checked)
- Fail-closed error handling for HIPAA compliance
- MongoDB-backed policy storage with versioning
- Slack webhook notifications for alerts
- Retention policy enforcement (30-day, 90-day, 7-year)

## Usage

```typescript
import { PolicyEngine } from '@/lib/governance'

const engine = new PolicyEngine()
await engine.loadPolicy(policy)
const result = await engine.evaluate(context)
```

## Testing

All 49 tests passing across 10 test files:
- Policy Engine tests
- Compliance Validator tests
- Unified Monitor tests
- Lifecycle Manager tests
- Integration tests (FHE, audit, policy reload)
