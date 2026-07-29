#!/usr/bin/env python
"""Programmatically enrich Jira ADHD tasks mapped in Linear with detailed technical specifications."""

import logging
import os
import sys

# Ensure local package imports work correctly
sys.path.insert(0, os.getcwd())

from scripts.task_sync.provider_bridge import apply_linear_action, export_linear_issues
from scripts.task_sync.tri_sync import SyncMetadata, merge_body_with_sync_metadata, parse_sync_metadata

# Curated premium technical specifications matching Astro 6 + React 19 + Python 3.13 + local Docker databases stack
TARGETS = {
    "ADHD-207": {
        "title": "Bulletproof Scaling: Phase 0 Foundation & Concurrency",
        "body": """### Core Objective
Establish the foundational microservice baseline with enterprise-grade distributed concurrency control, high-availability database connection pooling, and proactive connection health diagnostics.

### Technical Design Specs
- **Runtime Environment**: Node.js v24.16.0, pnpm v11.11.0, TypeScript v5.x.
- **Distributed Lock Manager (DLM)**:
  - Implement a Redis-backed distributed lock utilizing the standard Redlock algorithm pattern under `src/lib/redis/lock.ts`.
  - Enforce automated lock lease renewal (heartbeat) running in the background via a persistent timer loop.
  - Implement adaptive exponential backoff with randomized jitter for lock acquisition retries.
- **MongoDB Atlas Optimization**:
  - Configure robust connection pooling in `memory_adapter.py` with a minimum pool size of 10 and maximum pool size of 50.
  - Establish automated retry-on-write and retry-on-read mechanisms to survive transient network partitions.
  - Set a connection timeout threshold of 5000ms.
- **System Health Observability**:
  - Expose specialized `/healthz` (liveness) and `/readyz` (readiness) JSON endpoints in the Astro SSR nodes and core Express backend servers.
  - Integrate connection diagnostics showing live status for MongoDB, Redis, and upstream APIs.

### Atlassian & Code Linkages
- **Epic Link**: [ADHD-5: Bulletproof Scaling System Architecture](file:///home/vivi/pixelated/exports/pix-to-adhd-key-map.json)
- **Primary Source Code**:
  - Lock Manager: [lock.ts](file:///home/vivi/pixelated/src/lib/redis/lock.ts)
  - Memory Database Adapter: [memory_adapter.py](file:///home/vivi/pixelated/ai-services/memory_adapter.py)
  - Config Setup: [.env](file:///data/vivi/pixelated/.env)

### Verification & Testing Checklist
- [ ] **Unit Tests**: Add a suite under `tests/redis-lock.test.ts` to assert that:
  - Mutual exclusion is guaranteed under a spike load of 100 concurrent threads.
  - Expired locks are released automatically after their TTL.
  - Lock renewal heartbeats keep the lock held for long-running operations.
- [ ] **Integration Verification**: Boot local Docker containers (`mongo:latest` and `redis:latest`) and verify that connection logs report successful pool initialization.
- [ ] **Performance Audit**: Run a load test simulating 50 concurrent sessions and assert liveness check latency is `< 50ms` under CPU stress.
""",
    },
    "ADHD-212": {
        "title": "Bulletproof Scaling: Phase 2 Training Infrastructure",
        "body": """### Core Objective
Design and implement a highly scalable, serverless ML training infrastructure capable of orchestrating GPU execution contexts, managing distributed data loaders, and collecting real-time training telemetry.

### Technical Design Specs
- **Runtime Environment**: Python v3.13 (`uv` managed workspace), PyTorch, PyTorch Lightning.
- **Distributed Training Engine**:
  - Containerize model training tasks and deploy to **Modal serverless GPU execution context** (targeting NVIDIA A10G or H100 resources depending on workload).
  - Manage secure dataset caching via Modal shared volume mounts to avoid repetitive transfers.
- **Training Telemetry & Sync**:
  - Design a real-time event streaming collector pushing epoch-level training metrics (loss, val_loss, learning_rate, F1-score) from Python Lightning callbacks directly to our central MongoDB Atlas instance.
  - Setup automated training job recovery with weight checkpoint loading from cloud storage bucket mounts.
- **Data pipeline**:
  - Build robust, multi-worker PyTorch `DataLoader` instances with pinned memory and asynchronous pre-fetching.

### Atlassian & Code Linkages
- **Epic Link**: [ADHD-5: Bulletproof Scaling System Architecture](file:///home/vivi/pixelated/exports/pix-to-adhd-key-map.json)
- **Primary Source Code**:
  - Model Runner: `ai-services/training/modal_runner.py`
  - Telemetry Callbacks: `ai-services/training/callbacks.py`
  - Training Entrypoint: `ai-services/training/train.py`

### Verification & Testing Checklist
- [ ] **Automated Telemetry Tests**: Run `uv run pytest ai-services/tests/test_training_pipeline.py` and verify:
  - Telemetry endpoint receives epoch payloads matching the defined memory schema.
  - Database schema correctly indexes training run instances.
- [ ] **Distributed Load Checking**: Simulate a hardware interruption during training and confirm successful checkpoint recovery within `< 30s`.
- [ ] **Scale Audit**: Run a dry-run training pass on Modal to ensure GPU environments launch, execute, and spin down automatically.
""",
    },
    "ADHD-316": {
        "title": "Sprint 1: Memory Schema & Unification (May 12 - May 25)",
        "body": """### Core Objective
Unify the clinical data definitions across all application modules, establishing a shared, strictly-typed memory schema structure spanning the Astro frontend, package libraries, and Python ML/AI adapters.

### Technical Design Specs
- **Schema Single Source of Truth**:
  - Consolidate all schema configurations into the shared package `@pixelated/memory-schema` under `packages/memory-schema`.
  - Use Zod schemas in TypeScript and Pydantic models in Python to enforce exact format validation.
- **Memory Serialization/Deserialization**:
  - Validate that conversational transcripts, episodic memories, and compaction logs serialize/deserialize bidirectionally without loss of metadata or timestamp precision.
  - Maintain absolute compliance with local storage adapters and Mongo document formats.
- **Retroactive Migrations**:
  - Develop migration scripts to upgrade pre-existing database records to the unified structural format.

### Atlassian & Code Linkages
- **Epic Link**: [ADHD-19: Clinical Memory Subsystem Refactor](file:///home/vivi/pixelated/exports/pix-to-adhd-key-map.json)
- **Primary Source Code**:
  - Schema Defaults: [defaults.ts](file:///home/vivi/pixelated/packages/memory-schema/src/defaults.ts)
  - Memory Manager Client: [memory.ts](file:///home/vivi/pixelated/src/lib/memory.ts)
  - Package Configuration: [package.json](file:///home/vivi/pixelated/packages/memory-schema/package.json)
  - Python Adapter: [memory_adapter.py](file:///home/vivi/pixelated/ai-services/memory_adapter.py)

### Verification & Testing Checklist
- [ ] **TypeScript Typecheck**: Run `pnpm typecheck` and confirm zero compilation warnings or type mismatches.
- [ ] **Bidirectional Verification Tests**:
  - Run `pnpm vitest run -c config/vitest.config.ts packages/memory-schema` and verify all serialization test blocks succeed.
  - Execute python validations with `uv run pytest ai-services/tests/test_memory_adapter.py`.
- [ ] **Manual Sanity Check**: Populate a mock patient record using the unified schema and confirm that both Astro SSR and the Python service parse the patient's long-term recall blocks correctly.
""",
    },
    "ADHD-317": {
        "title": "Sprint 2: Gating & Ingestion (May 26 - June 8)",
        "body": """### Core Objective
Implement the real-time clinical safety and data ingestion gating layer to screen all conversational inputs, evaluate safety levels, detect high emotional arousal, and route messages dynamically.

### Technical Design Specs
- **Ingestion Pipeline**:
  - Build an async ingestion pipeline using Fast API in `ai-services` that intermediates between the React UI layer and the core memory storage adapter.
  - Integrate an LLM-based safety classifier that screens patient inputs against defined diagnostic criteria.
- **React UI Gating Integration**:
  - Design React components displaying real-time screening states (Ingesting, Gating, Safety Verified, Routed) using micro-animations.
  - Provide immediate feedback to the therapist if critical safety flags (e.g. self-harm, severe crisis) are detected.
- **Safety Routing Engine**:
  - Route standard messages to standard memory collections and flag high-arousal messages for immediate professional escalation.

### Atlassian & Code Linkages
- **Epic Link**: [ADHD-20: AI Ingestion and Safety Protocols](file:///home/vivi/pixelated/exports/pix-to-adhd-key-map.json)
- **Primary Source Code**:
  - Fast API Gate Controller: `ai-services/ingestion/gate.py`
  - React Chat Screen: `src/components/chat/TherapyGate.tsx`
  - Database collection schemas: `packages/memory-schema/src/gate-types.ts`

### Verification & Testing Checklist
- [ ] **End-to-End Specs**: Create a Playwright integration test at `e2e/chat-gating.spec.ts` asserting that safety blocks render instantly when flagged input is injected.
- [ ] **Performance Profiling**: Run load testing simulating 100 concurrent chat session ingestions and verify average response time remains `< 200ms`.
- [ ] **Safety Rule Verification**: Ensure all boundary inputs (empty messages, massive blocks of text, special markdown characters) are correctly handled without crashing.
""",
    },
    "ADHD-321": {
        "title": "Sprint 3: Dreaming & Consolidation (June 9 - June 22)",
        "body": """### Core Objective
Build the background memory consolidation and summarization engine ("Dreaming") that runs offline to analyze daily interaction logs, synthesize long-term semantic understandings, and execute database garbage collection.

### Technical Design Specs
- **Offline Dream Scheduler**:
  - Implement a cron-based scheduler using BullMQ (backed by local Redis container) to trigger dream consolidation cycles during off-peak hours.
- **Cognitive Summarization Model**:
  - Utilize pre-trained text transformers to extract core therapeutic themes, patient emotional progress markers, and key cognitive behavioral milestones.
  - Save unified, high-level summaries to the patient's long-term memory store in MongoDB.
- **Data Compaction & Garbage Collection**:
  - Prune obsolete, redundant chat logs and temporary caches to keep database storage footprint optimized.
  - Ensure correct primary key references are maintained across compacted collections.

### Atlassian & Code Linkages
- **Epic Link**: [ADHD-21: Cognitive Reflection and Offline Processing](file:///home/vivi/pixelated/exports/pix-to-adhd-key-map.json)
- **Primary Source Code**:
  - Dream Scheduler Service: `src/services/dream_scheduler.ts`
  - ML Summarization Task: `ai-services/dream/consolidation.py`
  - Worker Handler: `src/workers/dream_worker.ts`

### Verification & Testing Checklist
- [ ] **Integration Tests**: Write an integration suite verifying that a completed dream consolidation cycle successfully:
  - Produces a coherent long-term memory document.
  - Deletes raw session caches as configured.
  - Maintains strict referential integrity.
- [ ] **Memory Indexing Performance**: Audit read/write query latency before and after running a dream cycle, ensuring indexing speeds are improved by at least 15%.
- [ ] **Failure Recovery**: Interrupt a dream worker mid-processing and confirm that the system handles job retries via Redis seamlessly without duplicating summaries.
""",
    },
    "ADHD-330": {
        "title": "Write Unit Tests for the Gate",
        "body": """### Core Objective
Develop a comprehensive suite of unit tests for the AI safety gating layer, ensuring 100% test coverage of boundary-value inputs, threat classifiers, and safety routing decisions.

### Technical Design Specs
- **Testing Framework**: Vitest, mock server engines (`msw` or simple local stub servers).
- **Test Scenarios**:
  - Screen standard safe patient messages (should pass gate with zero flags).
  - Validate trigger safety flags for boundary inputs (empty strings, malicious injection attempts, high-arousal indicators).
  - Mock third-party AI endpoints to guarantee deterministic testing execution without network overhead.
- **Coverage Criteria**:
  - Enforce a minimum of **95% statement and branch coverage** on safety rules files.

### Atlassian & Code Linkages
- **Parent Task**: [ADHD-317: Sprint 2: Gating & Ingestion](file:///home/vivi/pixelated/exports/pix-to-adhd-key-map.json)
- **Primary Source Code**:
  - Test Suite: `packages/memory-schema/tests/gate-rules.test.ts`
  - Ingestion Gate Rules: `packages/memory-schema/src/gate-rules.ts`

### Verification & Testing Checklist
- [ ] **Coverage Verification**: Run `pnpm vitest run --coverage packages/memory-schema/tests/gate-rules.test.ts` and confirm coverage metrics are fully satisfied.
- [ ] **Boundary Verification**: Ensure the test suite executes successfully in less than 3000ms.
- [ ] **CI Pipeline Validation**: Integrate test execution directly into the advisory check pipeline to block broken gate regressions.
""",
    },
    "ADHD-342": {
        "title": "Workstream E: Implement performance-gap-to-backlog conversion rules",
        "body": """### Core Objective
Create the automated rules engine that translates real-time performance gap data (API latencies, high memory consumption, elevated error rates, token waste) into structured, actionable engineering backlog tickets.

### Technical Design Specs
- **Event listener Integration**:
  - Connect a persistent event listener to the central system telemetry collection in MongoDB.
- **Conversion Rule Engine**:
  - Implement heuristics to automatically classify performance drops (e.g. latency spikes > 2s, CPU throttling, elevated 5xx HTTP response rates).
  - Group and deduplicate identical or related events to prevent ticket duplication.
  - Automatically construct a structured backlog issue format mapping performance anomalies to technical tasks.
- **Jira Atlassian Integration**:
  - Integrate with the Atlassian REST SDK to automatically provision backlog tickets under the Jira project.

### Atlassian & Code Linkages
- **Epic Link**: [ADHD-9: Steering & Adaptive Development Loop](file:///home/vivi/pixelated/exports/pix-to-adhd-key-map.json)
- **Primary Source Code**:
  - Performance Monitor Listener: `src/services/performance_analyzer.ts`
  - Backlog Converter Rules: `src/services/backlog_converter.ts`
  - Atlassian Connector: `src/lib/atlassian/jira_connector.ts`

### Verification & Testing Checklist
- [ ] **Unit Tests**: Add tests under `tests/backlog-converter.test.ts` verifying that:
  - Telemetry alerts triggers are parsed correctly.
  - Threshold parameters correctly trigger a conversion event.
  - Duplicate events are successfully grouped under a single parent ticket.
- [ ] **Dry Run Validation**: Run the converter rules against mock performance logs and verify that JSON output payloads conform to the Jira ticket schema.
""",
    },
    "ADHD-343": {
        "title": "Workstream E: Build evidence-based reprioritization engine",
        "body": """### Core Objective
Design and implement the algorithmic reprioritization engine that scores and re-ranks outstanding backlog items based on real-time empirical performance evidence and user session data.

### Technical Design Specs
- **Evidence Collector**:
  - Extract performance gaps, clinical safety alerts, and therapist interaction frequencies from the database.
- **Multi-Criteria Scoring Engine**:
  - Implement a mathematical prioritization model using NumPy/SciPy in Python.
  - Calculate priority scores based on: Severity Weight, Frequency Score, System Performance Gap, and User-Facing Impact.
  - Establish a rank-order sorting routine to output a dynamically prioritized list of open tickets.
- **Priority Sync Bridge**:
  - Map prioritization outputs back to standard Atlassian/Linear priority levels (Highest, High, Medium, Low, Lowest).

### Atlassian & Code Linkages
- **Epic Link**: [ADHD-9: Steering & Adaptive Development Loop](file:///home/vivi/pixelated/exports/pix-to-adhd-key-map.json)
- **Primary Source Code**:
  - Prioritization Backend Service: `ai-services/prioritization/engine.py`
  - Math Model Utilities: `ai-services/prioritization/scoring.py`
  - Scoring Tests: `ai-services/tests/test_prioritizer.py`

### Verification & Testing Checklist
- [ ] **Mathematical Verification**: Run python tests verifying that:
  - Higher-impact performance anomalies consistently result in higher ranking shifts.
  - The sorting routine operates with $O(N \\log N)$ complexity, handling 5000 items in `< 100ms`.
  - Randomized perturbations in weights preserve rank ordering constraints.
- [ ] **Consistency Audit**: Verify that calculated priorities match available ticket fields on the target system.
""",
    },
    "ADHD-344": {
        "title": "Workstream E: Integrate steering with upstream workstreams",
        "body": """### Core Objective
Hook the automated backlog steering and prioritization pipeline directly into the active scrum sync cycle, pushing updates bidirectionally between our tracking boards and local databases.

### Technical Design Specs
- **Scrum Steering Integrator**:
  - Connect the scoring engine output directly to the task synchronization pipeline hooks.
  - Develop bidirectionally-enabled webhooks to automatically sync calculated priorities, backlog mappings, and sprint assignments.
- **Unified Messaging Notifications**:
  - Implement a messaging module that pushes interactive alerts (visualizing current steering adjustments, sprint progress, and resolved performance gaps) to designated notification integrations (Slack/Teams).
- **Steering Control Panel**:
  - Design a premium frontend dashboard for developers to visualize steering decisions and review conversion rules.

### Atlassian & Code Linkages
- **Epic Link**: [ADHD-9: Steering & Adaptive Development Loop](file:///home/vivi/pixelated/exports/pix-to-adhd-key-map.json)
- **Primary Source Code**:
  - Sync Coordinator Hook: `scripts/task_sync/tri_sync.py`
  - Slack Notification Helper: `src/lib/notifications/slack.ts`
  - Developer Control Screen: `src/components/dashboard/SteeringPanel.tsx`

### Verification & Testing Checklist
- [ ] **End-to-End Synchronization Run**: Trigger a local test sync using `tri_sync.py apply` and confirm that calculated priorities successfully override status mappings on Linear and Jira.
- [ ] **Callback Validation**: Validate that webhook payloads trigger proper notifications with zero formatting errors.
- [ ] **Telemetry Visual Audit**: Confirm that dashboard tables display data cleanly with fully functioning search and filter operations.
""",
    },
}


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    logging.info("Fetching issues from Linear...")
    try:
        issues = export_linear_issues()
    except Exception as e:
        logging.error("Error fetching Linear issues: %s", e)
        sys.exit(1)

    logging.info("Successfully loaded %d issues from Linear.", len(issues))

    enriched_count = 0

    for issue in issues:
        title = issue.get("title", "")
        desc = issue.get("description") or ""
        issue_id = issue.get("id")

        # Parse sync metadata
        clean_body, meta = parse_sync_metadata(desc)

        # Match using multiple heuristics
        matched_key = None

        # Heuristic 1: source-id in metadata
        source_id = meta.get("source-id")
        if source_id in TARGETS:
            matched_key = source_id

        # Heuristic 2: key in metadata (lowercased)
        elif meta.get("key") and meta["key"].upper() in TARGETS:
            matched_key = meta["key"].upper()

        # Heuristic 3: exact title match
        else:
            for k, target in TARGETS.items():
                if target["title"].strip().lower() == title.strip().lower():
                    matched_key = k
                    break

        if not matched_key:
            continue

        logging.info("--- Found matching issue: %s ('%s') ---", matched_key, title)
        target_spec = TARGETS[matched_key]

        # Check if the description already has the enriched body to avoid redundant operations
        if "### Core Objective" in clean_body and "### Verification & Testing Checklist" in clean_body:
            logging.info("Issue %s is already enriched. Skipping.", matched_key)
            continue

        # Reconstruct the SyncMetadata object to preserve sync keys and status
        sync_meta = SyncMetadata(
            key=meta.get("key", matched_key.lower()),
            status=meta.get("status", "open"),
            source_provider=meta.get("source-provider", "jira"),
            source_id=meta.get("source-id", matched_key),
            provider_ids={
                k: v
                for k, v in meta.items()
                if k not in {"key", "status", "source-provider", "source-id", "updated-at"}
            },
            updated_at=meta.get("updated-at"),
        )

        # Merge new enriched body with preserved sync block
        enriched_body = merge_body_with_sync_metadata(target_spec["body"].strip(), sync_meta)

        # Perform the update on Linear
        logging.info("Updating issue in Linear with enriched specs (ID: %s)...", issue_id)
        action = {"action": "update", "target_id": issue_id, "title": title, "body": enriched_body}

        try:
            apply_linear_action(action)
            logging.info("Successfully enriched %s in Linear!", matched_key)
            enriched_count += 1
        except Exception as e:
            logging.error("Error enriching %s: %s", matched_key, e)

    logging.info("Task enrichment process complete. Enriched %d issues.", enriched_count)


if __name__ == "__main__":
    main()
