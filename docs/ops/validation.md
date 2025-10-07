# Validation Pipeline - Phase 02 Documentation

## Overview
Phase 02 of the dataset pipeline implements validation and standardization for ingested records. This ensures data quality, security, and consistency before downstream processing. Key components: canonical schemas, sanitization, format conversion, quality scoring, quarantine for failures, and monitoring/alerts.

The pipeline normalizes diverse sources (CSV, JSON, audio transcripts) into a canonical `ConversationRecord` model suitable for mental health dialogue analysis. Invalid records are quarantined in MongoDB for review, allowing non-blocking ingestion.

## Canonical Schemas
All ingested data is transformed to `ConversationRecord` (Pydantic BaseModel):

- **id**: Unique string ID (alphanumeric, hyphens/underscores/periods).
- **title**: Optional conversation title (max 200 chars).
- **turns**: List of `SpeakerTurn` objects (1-1000 items).
  - `SpeakerTurn`: 
    - `speaker_id`: Alphanumeric ID (e.g., 'therapist', 'client').
    - `content`: Sanitized text (max 5000 chars, no XSS/HTML).
    - `timestamp`: Optional datetime.
    - `metadata`: Turn-specific data.
- **source_type**: 'csv', 'json', 'audio_transcript', etc.
- **source_id**: Original source identifier.
- **metadata**: Includes quality score, provenance (ingestion_timestamp, source_type).

**SpeakerTurn Validation**:
- Alternating speakers (no consecutive same ID).
- At least 2 unique speakers.
- Content sanitized with bleach (allow safe tags: p, br, strong, em; strip others).

**ConversationRecord Validation**:
- At least 2 turns for dialogue.
- Source type restricted to known values.
- ID and speaker_id regex-validated for safety.

## Mapping Rules for Source Types
Validation/normalization happens in `validate_record(raw_record: IngestRecord) -> ConversationRecord`:

- **CSV**:
  - Expect payload: {'rows': list of dicts with 'speaker', 'content', 'timestamp'}.
  - Maps each row to `SpeakerTurn` (speaker from 'speaker', content from 'content').
  - Title from payload['title'], source_id from payload['source_id'].

- **JSON**:
  - Expect payload: {'turns': list of dicts with 'speaker_id', 'content', 'timestamp'}.
  - Direct mapping to `SpeakerTurn`.
  - Title and source_id from payload.

- **Audio Transcript**:
  - Expect payload: {'segments': list with 'speaker', 'text', 'start_time'}.
  - Maps segments to turns (speaker from 'speaker', content from 'text', timestamp from start_time).
  - Title defaults to 'Transcribed Conversation', source_id from 'audio_file_id'.

- **Default (unknown source)**:
  - Assumes payload has 'turns' list in canonical form.
  - Falls back to basic mapping; extend for new sources.

Raw `IngestRecord.payload` must be a dict with source_type key for mapping.

## Sanitization
- **Content Sanitization**: Uses `bleach.clean` to strip dangerous HTML (e.g., <script>).
  - Allowed tags: p, br, strong, em, ul, ol, li.
  - Regex removes remaining script tags.
  - If content changes length, raises ValueError (security check).
- **ID/Speaker Validation**: Regex ensures alphanumeric + _/-/..
- All user-input text (content) is sanitized to prevent XSS in downstream (e.g., UI display).

## Quality Scoring
Initial scoring in `QualityScore.compute_initial(record)` (Pydantic model):

- **completeness**: min(1.0, len(turns) / 20.0) - Favors 20+ turns.
- **coherence**: Average turn length / 100 (longer = more coherent).
- **relevance**: 0.7 if 'mental' or 'health' in any content, else 0.3.
- **raw_score**: Average * 10 / 3 (0-10 scale).

Scores normalized to 0-1. Stored in metadata['quality_score']. Expand with ML models later.

## Quarantine Workflow
Failed validations are handled in `ingestion_interface.py.fetch()`:

- Catches `ValidationError`, `IngestionError`.
- Stores raw record in MongoDB (`quarantine_records` collection) via `QuarantineStore.quarantine_record`.
- Logs error and continues processing (non-blocking).
- **QuarantineRecord**: Includes raw_payload, validation_errors, metadata, status (PENDING_REVIEW default).

**Operator Review**:
- `review_quarantined(limit=10)`: Yields pending records.
- `approve_record(qid, notes)`: Sets status APPROVED for reprocessing.
- `reject_record(qid, notes)`: Sets REJECTED, deletes record.
- `reprocess_record(qid)`: Re-runs `validate_record`; updates status to REPROCESSED on success (max 3 attempts).

**Integration**: Call `get_quarantine_store()` for store instance. Use in CLI: review/approve/reject.

## Monitoring and Alerts
In-memory `PipelineMetrics` tracks:

- `validation_success_total`, `validation_fail_total`: Incremented via `log_validation_success/fail()`.
- `quarantine_insert_total`, `quarantine_size_gauge`: Incremented via `log_quarantine_insert()`.
- `get_validation_rate()`: Fail rate (last hour).

**Alerts**:
- High fail rate (>10%): Log/raise via `check_alerts()`.
- High quarantine growth (>100/hour): Log/raise.
- In prod, replace with Sentry/Prometheus exporter.

Integrate `check_alerts()` in orchestrator after batches.

## Integration Notes
- **Ingestion**: `fetch()` now yields `ConversationRecord`; wraps raw fetch with validation/quarantine.
- **Orchestrator**: Wrap connector.fetch() with try/except for quarantine; call log functions post-validation.
- **Dependencies**: pydantic (schemas/validation), bleach (sanitization), pymongo (quarantine store).
- **Env**: MONGO_URI for quarantine; defaults to localhost:27017.
- **Extensibility**: Add source types to mapping dict; enhance scoring with ML.

## Security & Compliance
- **Library Audit**: All third-party libraries audited and verified as secure (see `security_audit.md`)
- **Input Sanitization**: All user-provided content sanitized with bleach library
- **ID Validation**: Strict regex validation prevents injection attacks
- **Connection Security**: Secure connection protocols for all external services

For full pipeline, see `ai/dataset_pipeline/README.md`.