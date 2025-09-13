# Phase 02: Modular Pseudocode for Secure Multi-Agent Context Sharing via Cipher

**Scope:**  
- Modular, language-agnostic pseudocode for agent context sharing using campfirein/cipher  
- Explicit support for both Node.js (TypeScript) and Python agents  
- TDD anchors for all critical flows  
- No hard-coded secrets/configs; all sensitive data via environment/config  
- <500 lines, split by logical module/phase

---

## 1. Agent Initialization (Common)

```pseudocode
function initialize_agent(config):
    // Validate config: must include cipher_url, agent_id, env secrets
    // TEST: Initialization fails if config missing required fields
    if not config.is_valid():
        raise InitializationError("Missing required config fields")
    // TEST: Agent loads secrets from environment, not hard-coded
    secrets = load_env_secrets()
    // TEST: Agent can connect to Cipher endpoint
    connection = connect_to_cipher(config.cipher_url, secrets)
    if not connection.success:
        raise ConnectionError("Cipher connection failed")
    return AgentInstance(config, connection)
```

---

## 2. Agent Registration & Capability Handshake

```pseudocode
function register_agent(agent_instance):
    // TEST: Agent sends registration payload with agent_id, capabilities, language
    payload = {
        "agent_id": agent_instance.id,
        "capabilities": agent_instance.capabilities,
        "language": agent_instance.language, // "python" or "typescript"
    }
    response = agent_instance.connection.send("register", payload)
    // TEST: Registration fails with invalid agent_id or duplicate
    if response.status != "ok":
        raise RegistrationError(response.error)
    // TEST: Registration success returns agent token/session
    agent_instance.session_token = response.token
    return agent_instance
```

---

## 3. Context Serialization & Encryption

### Node.js (TypeScript) Agent

```pseudocode
function serialize_context_ts(context_obj):
    // TEST: Serializes context to JSON, validates schema
    json_str = JSON.stringify(context_obj)
    if not validate_schema(json_str):
        raise ValidationError("Context schema invalid")
    // TEST: Encrypts context using Cipher-provided public key
    encrypted = cipher_encrypt(json_str, get_cipher_pubkey())
    return encrypted
```

### Python Agent

```pseudocode
def serialize_context_py(context_obj):
    # TEST: Serializes context to JSON, validates schema
    json_str = json.dumps(context_obj)
    if not validate_schema(json_str):
        raise ValidationError("Context schema invalid")
    # TEST: Encrypts context using Cipher-provided public key
    encrypted = cipher_encrypt(json_str, get_cipher_pubkey())
    return encrypted
```

---

## 4. Context Push (Sync) Flow

```pseudocode
function push_context(agent_instance, encrypted_context):
    // TEST: Agent sends encrypted context to Cipher
    payload = {
        "agent_id": agent_instance.id,
        "context": encrypted_context,
        "timestamp": now()
    }
    response = agent_instance.connection.send("push_context", payload)
    // TEST: Push fails if context is malformed or not encrypted
    if response.status != "ok":
        raise ContextSyncError(response.error)
    // TEST: Audit log entry created for context push
    log_audit("context_push", agent_instance.id, response.status)
    return response
```

---

## 5. Context Fetch (Pull) Flow

```pseudocode
function fetch_context(agent_instance):
    // TEST: Agent requests latest context from Cipher
    payload = { "agent_id": agent_instance.id }
    response = agent_instance.connection.send("fetch_context", payload)
    // TEST: Fetch fails if agent is not registered or token invalid
    if response.status != "ok":
        raise ContextFetchError(response.error)
    // TEST: Decrypts context using agent's private key
    decrypted = cipher_decrypt(response.encrypted_context, get_agent_privkey())
    // TEST: Validates context schema after decryption
    if not validate_schema(decrypted):
        raise ValidationError("Fetched context schema invalid")
    return parse_context(decrypted)
```

---

## 6. Multi-Agent Context Sync

```pseudocode
function sync_all_agents(agent_list):
    // TEST: All agents can push and fetch context in parallel
    for agent in agent_list:
        encrypted = agent.serialize_context(agent.context)
        push_context(agent, encrypted)
    // TEST: Agents can fetch each other's context if authorized
    for agent in agent_list:
        context = fetch_context(agent)
        // TEST: Unauthorized fetch attempts are denied and logged
        if not agent.is_authorized(context):
            log_audit("unauthorized_fetch", agent.id, "denied")
```

---

## 7. Error Handling, Validation, and Audit Logging (Detailed)

### Error Handling Strategies

```pseudocode
function handle_error(error, agent_instance):
    // TEST: All errors are logged with context and agent_id
    log_error(error, agent_instance.id)
    // TEST: Critical errors trigger alert/notification
    if error.is_critical():
        notify_admin(error, agent_instance.id)
    // TEST: Validation errors are specific and actionable
    if isinstance(error, ValidationError):
        return "Validation failed: " + error.details
    // TEST: Security errors are redacted in logs
    if isinstance(error, SecurityError):
        log_error("SECURITY ERROR", agent_instance.id, redact=True)
    // TEST: Error propagation follows language conventions (Promise.reject/throw in TS, raise in Python)
    propagate_error(error)
```

### Validation Requirements

```pseudocode
function validate_schema(context_json):
    // TEST: Schema validation uses strict, versioned schema definitions
    schema = load_schema(version=context_json.version)
    return schema.validate(context_json)

function validate_cryptography(payload):
    // TEST: All cryptographic operations use environment/config keys
    if not keys_loaded_from_env():
        raise SecurityError("Keys not loaded from environment")
    // TEST: Encrypted payloads are checked for integrity and freshness
    if not verify_signature(payload):
        raise ValidationError("Signature invalid")
    if is_stale(payload.timestamp):
        raise ValidationError("Payload is stale")
```

### Audit Logging Requirements

```pseudocode
function log_audit(event_type, agent_id, status, details=None):
    // TEST: Audit log includes timestamp, agent_id, event_type, status, and optional details
    entry = {
        "timestamp": now(),
        "agent_id": agent_id,
        "event_type": event_type,
        "status": status,
        "details": details
    }
    write_audit_log(entry)
    // TEST: Audit logs are immutable and HIPAA++ compliant
    assert_audit_log_immutable()
    assert_audit_log_compliance()
    // TEST: Audit log retention policy is enforced (e.g., 7 years)
    enforce_audit_log_retention()
    // TEST: All access, mutation, and error events are logged
```

---

## 8. Test Hooks & TDD Anchors

```pseudocode
// TEST: Initialization, registration, context sync, fetch, error, and audit flows
// TEST: Node.js and Python agents can interoperate via Cipher
// TEST: All user inputs and context objects are validated before serialization
// TEST: All cryptographic operations use environment/config keys, never hard-coded
// TEST: All failures are logged and trigger compliance checks
// TEST: Performance - context sync/fetch <50ms per agent
// TEST: Audit logs are immutable, complete, and compliant
// TEST: Error propagation and redaction meet language and compliance requirements
```

---

## 9. Language-Specific Integration Notes

- **Node.js (TypeScript):**
  - Use strict types/interfaces for context objects
  - Use environment variables for secrets/config
  - Use async/await for all network/crypto operations
  - Integrate with Cipher via HTTP/WebSocket as required
  - Use Promise-based error propagation and try/catch for error handling

- **Python:**
  - Use dataclasses or Pydantic for context schema validation
  - Use os.environ for secrets/config
  - Use asyncio for async operations if needed
  - Integrate with Cipher via HTTP/WebSocket as required
  - Use try/except for error handling and raise for propagation

---

## 10. Extensibility & Modularity

- All modules must be independently testable and replaceable
- No direct dependencies on implementation details of Cipher—use only documented API
- All flows must be covered by TDD anchors for both happy path and edge/error cases

---

# End of Phase 02 Pseudocode
