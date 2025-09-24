# Phase 02: MCP Server Domain Model

## Overview

This document defines the core domain entities, relationships, and data structures for the Management Control Panel (MCP) server, providing the foundation for the FastAPI application structure, agent registration system, and task delegation mechanism.

## Core Domain Entities

### 1. Agent Entity

```typescript
interface Agent {
  // Identity
  agent_id: string                    // Unique identifier (UUID v4)
  name: string                        // Human-readable name
  type: AgentType                     // Agent classification
  
  // Capabilities
  capabilities: Capability[]           // List of supported capabilities
  permissions: Permission[]            // Role-based permissions
  version: string                      // Agent version (semver)
  
  // Network Configuration
  endpoint_url: string                 // Base URL for agent communication
  health_check_url: string             // Health check endpoint
  websocket_url?: string               // Optional WebSocket endpoint
  
  // Status and Lifecycle
  status: AgentStatus                  // Current operational status
  last_heartbeat: Date                 // Last health check timestamp
  registered_at: Date                  // Registration timestamp
  updated_at: Date                     // Last update timestamp
  
  // Performance Metrics
  performance_metrics: AgentMetrics    // Runtime performance data
  current_tasks: number                // Active task count
  max_concurrent_tasks: number         // Task concurrency limit
  
  // Authentication
  auth_token_hash: string              // Hashed authentication token
  refresh_token_hash?: string          // Hashed refresh token
  
  // Metadata
  metadata: Record<string, unknown>    // Flexible metadata storage
  tags: string[]                       // Classification tags
}

enum AgentType {
  BIAS_DETECTOR = 'bias-detector',
  EMOTION_ANALYZER = 'emotion-analyzer',
  THERAPIST = 'therapist',
  TEXT_PROCESSOR = 'text-processor',
  REPORT_GENERATOR = 'report-generator'
}

enum AgentStatus {
  ACTIVE = 'active',           // Ready to accept tasks
  INACTIVE = 'inactive',       // Temporarily unavailable
  BUSY = 'busy',               // At maximum capacity
  ERROR = 'error',             // Experiencing issues
  OFFLINE = 'offline'          // Not responding to health checks
}

interface Capability {
  name: string                  // Capability identifier
  version: string               // Capability version
  description?: string          // Human-readable description
  parameters?: ParameterDef[]   // Expected parameters schema
  returns?: ReturnDef          // Return value schema
  performance_profile?: PerformanceProfile
}

interface AgentMetrics {
  tasks_completed: number       // Total completed tasks
  tasks_failed: number          // Total failed tasks
  average_response_time: number // Average response time (seconds)
  success_rate: number          // Success rate (0.0 - 1.0)
  last_24h: DailyMetrics        // Last 24 hours metrics
  lifetime: LifetimeMetrics     // All-time metrics
}

interface DailyMetrics {
  tasks_completed: number
  tasks_failed: number
  average_response_time: number
  peak_concurrent_tasks: number
}

interface LifetimeMetrics {
  total_uptime: number          // Total uptime (seconds)
  total_downtime: number        // Total downtime (seconds)
  first_registered: Date
  last_seen: Date
}
```

### 2. Task Entity

```typescript
interface Task {
  // Identity
  task_id: string               // Unique identifier (UUID v4)
  pipeline_id: string           // Associated pipeline ID
  
  // Task Definition
  stage: number                 // Pipeline stage number (1-6)
  task_type: TaskType           // Task classification
  parameters: TaskParameters    // Task input parameters
  priority: number              // Priority level (1-10, higher is more urgent)
  
  // Assignment and Execution
  status: TaskStatus            // Current task status
  assigned_agent_id?: string    // Assigned agent ID (if assigned)
  dependencies: string[]        // Dependent task IDs
  max_retries: number           // Maximum retry attempts
  retry_count: number           // Current retry count
  
  // Timing
  created_at: Date              // Task creation timestamp
  updated_at: Date              // Last update timestamp
  started_at?: Date             // Task start timestamp
  completed_at?: Date           // Task completion timestamp
  deadline?: Date               // Task deadline (optional)
  estimated_duration: number    // Estimated duration (seconds)
  
  // Results
  result?: TaskResult           // Task execution result
  error?: TaskError             // Error information (if failed)
  
  // Metadata
  metadata: Record<string, unknown>
  tags: string[]
}

enum TaskType {
  TEXT_PREPROCESSING = 'text_preprocessing',
  BIAS_DETECTION = 'bias_detection',
  EMOTION_ANALYSIS = 'emotion_analysis',
  EMPATHY_SCORING = 'empathy_scoring',
  THERAPEUTIC_RECOMMENDATIONS = 'therapeutic_recommendations',
  REPORT_GENERATION = 'report_generation',
  DATA_VALIDATION = 'data_validation',
  QUALITY_ASSURANCE = 'quality_assurance'
}

enum TaskStatus {
  PENDING = 'pending',              // Waiting for assignment
  ASSIGNED = 'assigned',            // Assigned to agent
  RUNNING = 'running',              // Currently executing
  COMPLETED = 'completed',          // Successfully completed
  FAILED = 'failed',                // Failed execution
  CANCELLED = 'cancelled',          // Manually cancelled
  TIMEOUT = 'timeout',              // Exceeded time limit
  RETRY = 'retry'                   // Scheduled for retry
}

interface TaskParameters {
  // Common parameters
  text?: string                     // Input text for analysis
  context?: string                  // Context information
  patient_id?: string               // Patient identifier (PHI)
  session_id?: string               // Session identifier
  
  // Task-specific parameters
  analysis_depth?: AnalysisDepth    // Analysis thoroughness
  include_confidence?: boolean      // Include confidence scores
  language?: string                 // Text language code
  metadata?: Record<string, unknown>
}

enum AnalysisDepth {
  BASIC = 'basic',                  // Quick analysis
  STANDARD = 'standard',            // Normal analysis
  DEEP = 'deep',                    // Thorough analysis
  COMPREHENSIVE = 'comprehensive'   // Maximum analysis
}

interface TaskResult {
  // Result metadata
  success: boolean                  // Task success status
  processing_time: number           // Execution time (seconds)
  agent_id: string                  // Executing agent ID
  
  // Task-specific results
  data: Record<string, unknown>     // Task output data
  confidence_scores?: ConfidenceScore[]
  warnings?: string[]               // Non-critical warnings
  metadata?: Record<string, unknown>
}

interface ConfidenceScore {
  metric: string                    // Metric name
  score: number                     // Confidence score (0.0 - 1.0)
  explanation?: string              // Score explanation
}

interface TaskError {
  code: string                      // Error code
  message: string                   // Human-readable message
  details?: Record<string, unknown> // Technical details
  stack_trace?: string              // Error stack trace
  retryable: boolean                // Whether error is retryable
  suggested_action?: string         // Recommended action
}
```

### 3. Pipeline Entity

```typescript
interface Pipeline {
  // Identity
  pipeline_id: string               // Unique identifier (UUID v4)
  name: string                      // Human-readable name
  description?: string              // Detailed description
  
  // Pipeline Definition
  status: PipelineStatus            // Current pipeline status
  stages: PipelineStage[]           // Stage definitions
  input_data: PipelineInput         // Initial input data
  output_data?: PipelineOutput      // Final output data
  
  // Execution Tracking
  current_stage: number             // Currently executing stage
  progress: number                  // Overall progress (0.0 - 1.0)
  started_at?: Date                 // Pipeline start time
  completed_at?: Date               // Pipeline completion time
  
  // Configuration
  priority: number                  // Pipeline priority
  metadata: Record<string, unknown>
  tags: string[]
  
  // Audit
  created_at: Date
  created_by: string                // User/agent who created pipeline
  updated_at: Date
}

enum PipelineStatus {
  CREATED = 'created',              // Initial state
  RUNNING = 'running',              // Currently executing
  COMPLETED = 'completed',          // Successfully finished
  FAILED = 'failed',                // Failed execution
  CANCELLED = 'cancelled',          // Manually cancelled
  PAUSED = 'paused'                 // Temporarily paused
}

interface PipelineStage {
  stage: number                     // Stage number (1-6)
  name: string                      // Stage name
  description?: string              // Stage description
  status: StageStatus               // Current stage status
  task_type: TaskType               // Primary task type
  dependencies: number[]            // Dependent stage numbers
  tasks: string[]                   // Associated task IDs
  started_at?: Date                 // Stage start time
  completed_at?: Date               // Stage completion time
  progress: number                  // Stage progress (0.0 - 1.0)
}

enum StageStatus {
  PENDING = 'pending',              // Waiting for dependencies
  READY = 'ready',                  // Ready to execute
  RUNNING = 'running',              // Currently executing
  COMPLETED = 'completed',          // Successfully completed
  FAILED = 'failed',                // Failed execution
  SKIPPED = 'skipped'               // Skipped due to failure
}

interface PipelineInput {
  text: string                      // Primary input text
  context?: string                  // Context information
  patient_id?: string               // Patient identifier (PHI)
  session_id?: string               // Session identifier
  therapist_id?: string             // Therapist identifier
  metadata?: Record<string, unknown>
}

interface PipelineOutput {
  // Analysis Results
  bias_analysis?: BiasAnalysis
  emotion_analysis?: EmotionAnalysis
  empathy_score?: EmpathyScore
  therapeutic_recommendations?: Recommendation[]
  final_report?: Report
  
  // Execution Metadata
  total_processing_time: number     // Total time (seconds)
  stage_results: StageResult[]      // Individual stage results
  confidence_overall?: number       // Overall confidence score
}

interface BiasAnalysis {
  bias_detected: boolean
  bias_types: string[]
  confidence: number
  examples: BiasExample[]
  recommendations: string[]
}

interface EmotionAnalysis {
  primary_emotions: EmotionScore[]
  secondary_emotions: EmotionScore[]
  sentiment: SentimentScore
  intensity: number
  temporal_markers?: TemporalMarker[]
}

interface EmpathyScore {
  overall_score: number             // 0.0 - 1.0
  components: {
    cognitive: number               // Cognitive empathy
    emotional: number               // Emotional empathy
    compassionate: number           // Compassionate empathy
  }
  factors: string[]                 // Influencing factors
}

interface Recommendation {
  type: string                      // Recommendation type
  priority: 'high' | 'medium' | 'low'
  description: string               // Recommendation text
  rationale?: string                // Why this recommendation
  implementation?: string           // How to implement
}
```

### 4. Authentication and Authorization Entities

```typescript
interface AgentAuth {
  agent_id: string                  // Associated agent ID
  auth_method: AuthMethod           // Authentication method
  access_token: string              // JWT access token
  refresh_token?: string            // Refresh token (optional)
  token_expires_at: Date            // Token expiration
  refresh_expires_at?: Date         // Refresh token expiration
  permissions: Permission[]         // Granted permissions
  issued_at: Date                   // Token issue time
  last_used_at?: Date               // Last token usage
  is_active: boolean                // Token active status
}

enum AuthMethod {
  JWT = 'jwt',
  API_KEY = 'api_key',
  OAUTH2 = 'oauth2'
}

enum Permission {
  // Task permissions
  TASK_EXECUTE = 'task:execute',
  TASK_READ = 'task:read',
  TASK_CREATE = 'task:create',
  TASK_UPDATE = 'task:update',
  TASK_DELETE = 'task:delete',
  
  // Pipeline permissions
  PIPELINE_CREATE = 'pipeline:create',
  PIPELINE_READ = 'pipeline:read',
  PIPELINE_UPDATE = 'pipeline:update',
  PIPELINE_DELETE = 'pipeline:delete',
  PIPELINE_EXECUTE = 'pipeline:execute',
  
  // Agent permissions
  AGENT_REGISTER = 'agent:register',
  AGENT_READ = 'agent:read',
  AGENT_UPDATE = 'agent:update',
  AGENT_DELETE = 'agent:delete',
  AGENT_HEARTBEAT = 'agent:heartbeat',
  
  // System permissions
  SYSTEM_HEALTH = 'system:health',
  SYSTEM_METRICS = 'system:metrics',
  SYSTEM_CONFIG = 'system:config'
}

interface AuthToken {
  // JWT Payload
  sub: string                       // Subject (agent_id)
  iss: string                       // Issuer
  aud: string                       // Audience
  exp: number                       // Expiration time
  iat: number                       // Issued at
  jti: string                       // JWT ID
  
  // Custom claims
  permissions: Permission[]
  agent_type: AgentType
  capabilities: string[]
  metadata?: Record<string, unknown>
}
```

### 5. Event and Messaging Entities

```typescript
interface Event {
  event_id: string                  // Unique event identifier
  event_type: EventType             // Event classification
  timestamp: Date                   // Event occurrence time
  source: EventSource               // Event source information
  
  // Event payload
  payload: EventPayload             // Event-specific data
  metadata?: Record<string, unknown>
  
  // Delivery tracking
  correlation_id?: string           // Correlation identifier
  causation_id?: string             // Causation identifier
  delivery_attempts: number         // Delivery retry count
  delivered_at?: Date               // Successful delivery time
}

enum EventType {
  // Agent events
  AGENT_REGISTERED = 'agent:registered',
  AGENT_UPDATED = 'agent:updated',
  AGENT_UNREGISTERED = 'agent:unregistered',
  AGENT_HEARTBEAT = 'agent:heartbeat',
  AGENT_STATUS_CHANGED = 'agent:status_changed',
  
  // Task events
  TASK_CREATED = 'task:created',
  TASK_ASSIGNED = 'task:assigned',
  TASK_STARTED = 'task:started',
  TASK_COMPLETED = 'task:completed',
  TASK_FAILED = 'task:failed',
  TASK_RETRY = 'task:retry',
  
  // Pipeline events
  PIPELINE_CREATED = 'pipeline:created',
  PIPELINE_STARTED = 'pipeline:started',
  PIPELINE_STAGE_STARTED = 'pipeline:stage_started',
  PIPELINE_STAGE_COMPLETED = 'pipeline:stage_completed',
  PIPELINE_COMPLETED = 'pipeline:completed',
  PIPELINE_FAILED = 'pipeline:failed',
  
  // System events
  SYSTEM_HEALTH_CHECK = 'system:health_check',
  SYSTEM_ERROR = 'system:error',
  SYSTEM_WARNING = 'system:warning'
}

interface EventSource {
  source_type: 'agent' | 'pipeline' | 'task' | 'system'
  source_id: string                 // Source entity ID
  source_name?: string              // Source entity name
  ip_address?: string               // Source IP address
  user_agent?: string               // Source user agent
}

interface EventPayload {
  // Base payload structure
  entity_id: string                 // Affected entity ID
  entity_type: string               // Affected entity type
  changes?: Record<string, {
    old: unknown
    new: unknown
  }>
  
  // Event-specific extensions
  data: Record<string, unknown>     // Event-specific data
}

// WebSocket-specific events
interface WebSocketEvent extends Event {
  connection_id: string             // WebSocket connection ID
  session_id: string                // WebSocket session ID
  client_agent_id?: string          // Client agent ID (if applicable)
}

interface TaskDelegateEvent extends WebSocketEvent {
  event_type: EventType.TASK_ASSIGNED
  payload: {
    entity_id: string               // Task ID
    entity_type: 'task'
    data: {
      task: Task                    // Full task details
      agent: Agent                  // Assigned agent details
      deadline?: Date               // Task deadline
      priority: number              // Task priority
    }
  }
}

interface TaskResultEvent extends WebSocketEvent {
  event_type: EventType.TASK_COMPLETED
  payload: {
    entity_id: string               // Task ID
    entity_type: 'task'
    data: {
      task: Task                    // Task with result
      processing_time: number       // Execution time
      next_tasks?: string[]         // Next tasks to execute
    }
  }
}
```

### 6. Queue and Scheduling Entities

```typescript
interface TaskQueue {
  queue_id: string                  // Unique queue identifier
  queue_type: QueueType             // Queue classification
  priority: number                  // Queue priority level
  tasks: QueuedTask[]               // Queued tasks
  metrics: QueueMetrics             // Queue performance metrics
  config: QueueConfig               // Queue configuration
}

enum QueueType {
  PRIORITY = 'priority',            // Priority-based queue
  FIFO = 'fifo',                    // First-in-first-out queue
  LIFO = 'lifo',                    // Last-in-first-out queue
  DELAYED = 'delayed'               // Delayed execution queue
}

interface QueuedTask {
  task_id: string                   // Task identifier
  priority: number                  // Task priority
  queued_at: Date                   // Queue entry time
  scheduled_at?: Date               // Scheduled execution time
  attempts: number                  // Assignment attempts
  last_attempt?: Date               // Last assignment attempt
  timeout_at?: Date                 // Task timeout time
}

interface QueueMetrics {
  total_tasks: number               // Total tasks in queue
  pending_tasks: number             // Pending tasks count
  processing_rate: number           // Tasks per second
  average_wait_time: number         // Average wait time (seconds)
  peak_size: number                 // Maximum queue size
  failed_assignments: number        // Failed assignment count
}

interface QueueConfig {
  max_size: number                  // Maximum queue size
  timeout_seconds: number           // Task timeout duration
  retry_attempts: number            // Maximum retry attempts
  retry_delay_seconds: number       // Delay between retries
  priority_weights: Record<number, number> // Priority weighting
}

interface TaskAssignment {
  assignment_id: string             // Unique assignment identifier
  task_id: string                   // Assigned task ID
  agent_id: string                  // Assigned agent ID
  assigned_at: Date                 // Assignment time
  started_at?: Date                 // Task start time
  completed_at?: Date               // Task completion time
  status: AssignmentStatus          // Assignment status
  result?: TaskResult               // Assignment result
  error?: TaskError                 // Assignment error
}

enum AssignmentStatus {
  PENDING = 'pending',              // Waiting for agent acceptance
  ACCEPTED = 'accepted',            // Agent accepted task
  REJECTED = 'rejected',            // Agent rejected task
  STARTED = 'started',              // Task execution started
  COMPLETED = 'completed',          // Task execution completed
  FAILED = 'failed',                // Task execution failed
  TIMEOUT = 'timeout'               // Assignment timed out
}
```

### 7. Health and Monitoring Entities

```typescript
interface HealthCheck {
  check_id: string                    // Unique check identifier
  entity_type: 'agent' | 'pipeline' | 'system'
  entity_id: string                   // Entity being checked
  check_type: HealthCheckType         // Type of health check
  timestamp: Date                     // Check timestamp
  status: HealthStatus                // Overall health status
  checks: ComponentHealth[]           // Individual component checks
  response_time: number               // Total check time (ms)
}

enum HealthCheckType {
  BASIC = 'basic',                    // Basic connectivity check
  COMPREHENSIVE = 'comprehensive',    // Full system check
  PERFORMANCE = 'performance',        // Performance-focused check
  SECURITY = 'security'               // Security-focused check
}

enum HealthStatus {
  HEALTHY = 'healthy',                // All systems operational
  DEGRADED = 'degraded',              // Partial degradation
  UNHEALTHY = 'unhealthy',            // Critical issues detected
  UNKNOWN = 'unknown'                 // Unable to determine status
}

interface ComponentHealth {
  component: string                   // Component name
  status: HealthStatus                // Component health status
  response_time?: number              // Component response time (ms)
  error?: string                      // Error details (if unhealthy)
  metadata?: Record<string, unknown>  // Additional health data
}

interface SystemMetrics {
  // System-level metrics
  timestamp: Date
  uptime: number                      // System uptime (seconds)
  cpu_usage: number                   // CPU usage percentage
  memory_usage: number                // Memory usage percentage
  disk_usage: number                  // Disk usage percentage
  
  // Application metrics
  active_connections: number          // Active connections count
  request_rate: number                // Requests per second
  error_rate: number                  // Error percentage
  average_response_time: number       // Average response time (ms)
  
  // Business metrics
  active_agents: number               // Active agents count
  pending_tasks: number               // Pending tasks count
  processing_tasks: number            // Processing tasks count
  completed_tasks_rate: number        // Tasks completed per second
}

interface AgentHealth extends HealthCheck {
  entity_type: 'agent'
  agent_metrics: {
    tasks_in_progress: number
    queue_size: number
    last_task_completed?: Date
    error_rate_24h: number
    performance_score: number
  }
}

interface PipelineHealth extends HealthCheck {
  entity_type: 'pipeline'
  pipeline_metrics: {
    current_stage: number
    stages_completed: number
    total_stages: number
    estimated_completion?: Date
    bottleneck_stage?: number
  }
}
```

## Entity Relationships

### 1. Agent-Task Relationship
- **One-to-Many**: One agent can be assigned multiple tasks
- **Many-to-One**: Each task is assigned to at most one agent
- **Constraint**: Agent concurrent task limit enforcement
- **Lifecycle**: Tasks transition through assignment → execution → completion

### 2. Pipeline-Task Relationship
- **One-to-Many**: One pipeline contains multiple tasks
- **Composition**: Tasks are integral parts of pipeline execution
- **Ordering**: Tasks execute based on stage dependencies
- **Aggregation**: Pipeline progress calculated from task completion

### 3. Agent-Authentication Relationship
- **One-to-One**: Each agent has one active authentication session
- **Temporal**: Authentication tokens have expiration times
- **Permission-based**: Authentication grants specific permissions
- **Audit**: All authentication events are logged

### 4. Event-Entity Relationship
- **Many-to-Many**: Events can affect multiple entities
- **Temporal**: Events are timestamped and ordered
- **Causal**: Events can trigger other events
- **Audit**: All events are stored for compliance

## Domain Invariants

### 1. Agent Invariants
- Agent ID must be unique across the system
- Agent status must be valid for current operations
- Agent capabilities must match task requirements
- Agent authentication must be valid for operations

### 2. Task Invariants
- Task ID must be unique within the pipeline
- Task status transitions must follow valid state machine
- Task dependencies must be resolved before assignment
- Task assignment must respect agent capabilities

### 3. Pipeline Invariants
- Pipeline stages must be sequentially numbered (1-6)
- Stage dependencies must form a valid directed acyclic graph
- Pipeline progress must be calculated consistently
- Pipeline completion requires all stages to complete

### 4. Authentication Invariants
- Authentication tokens must be cryptographically secure
- Token expiration must be enforced
- Permissions must be validated for all operations
- Authentication events must be auditable

## Business Rules

### 1. Agent Registration Rules
- Agent ID format must follow UUID v4 specification
- Agent type must be from predefined enumeration
- Capabilities must be validated against known capability definitions
- Endpoint URLs must be valid and reachable
- Authentication tokens must be securely generated and stored

### 2. Task Assignment Rules
- Tasks can only be assigned to agents with matching capabilities
- Agent concurrent task limits must be respected
- Task priorities must be considered in assignment algorithms
- Task dependencies must be satisfied before assignment
- Failed assignments must be retried with exponential backoff

### 3. Pipeline Execution Rules
- Stages must execute in dependency order
- Failed stages can trigger pipeline failure or retry
- Pipeline progress must be calculated based on stage completion
- Pipeline cancellation must propagate to all active tasks
- Pipeline results must be validated before completion

### 4. Security Rules
- All API endpoints must require authentication
- Sensitive data must be encrypted using FHE
- Audit logs must capture all data access events
- Rate limiting must be enforced per agent
- Input validation must prevent injection attacks

## Validation Rules

### 1. Input Validation
- String lengths must be within defined limits
- UUID formats must be validated
- URLs must be properly formatted and reachable
- Dates must be valid and in correct format
- Enumerations must contain valid values

### 2. Business Validation
- Agent capabilities must match task requirements
- Task dependencies must not create circular references
- Pipeline stages must have valid dependencies
- Authentication tokens must not be expired
- Permissions must be sufficient for requested operations

### 3. Data Integrity Validation
- References between entities must be valid
- Status transitions must follow defined state machines
- Timing constraints must be respected
- Numeric values must be within acceptable ranges
- Required fields must be present and valid

## Domain Events

### 1. Agent Lifecycle Events
- AgentRegistered: New agent registration
- AgentStatusChanged: Agent status transition
- AgentHeartbeat: Agent health update
- AgentUnregistered: Agent removal

### 2. Task Lifecycle Events
- TaskCreated: New task creation
- TaskAssigned: Task assignment to agent
- TaskStarted: Task execution start
- TaskCompleted: Task successful completion
- TaskFailed: Task execution failure

### 3. Pipeline Lifecycle Events
- PipelineCreated: New pipeline creation
- PipelineStarted: Pipeline execution start
- PipelineStageStarted: Stage execution start
- PipelineStageCompleted: Stage completion
- PipelineCompleted: Pipeline successful completion

### 4. System Events
- SystemHealthCheck: System health status
- SystemError: System error occurrence
- SystemWarning: System warning occurrence
- AuthenticationEvent: Authentication-related events

This domain model provides the foundation for implementing the MCP server core components with clear entity definitions, relationships, business rules, and validation constraints. The model ensures consistency, maintainability, and alignment with the established architecture patterns while supporting the complex requirements of AI agent management and task orchestration.