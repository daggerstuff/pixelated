# Governance Module

HIPAA++ compliant data governance layer.

## Components
- Policy Engine: Access rules and evaluation
- Compliance Validator: Pre-flight HIPAA checks
- Unified Monitor: Cross-component alerting
- Lifecycle Manager: Retention and deletion

## Architecture

Middleware layer that sits between application code and FHE/audit/secrets modules.
Does NOT modify existing implementations - validates and monitors through integration points.
