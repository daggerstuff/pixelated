# Provenance Metadata Storage Plan

**Status**: Approved  
**Version**: 1.0  
**Date**: 2025-12-18  
**Related Issue**: KAN-9  
**Epic**: KAN-1 (Governance & Licensing)

---

## Overview

This document outlines the storage strategy for provenance metadata in the Dataset Expansion project. Provenance metadata must be stored in a way that ensures integrity, traceability, and efficient querying for audit purposes.

## Storage Architecture

### Multi-Layer Storage Approach

We use a **multi-layer storage approach** to ensure redundancy, performance, and compliance:

1. **Primary Storage**: PostgreSQL database (via Supabase)
2. **Secondary Storage**: JSON files in S3 (for audit trail and backup)
3. **Index Storage**: Elasticsearch/OpenSearch (for fast querying, optional)

---

## 1. Database Schema (Primary Storage)

### Table: `dataset_provenance`

**Location**: Supabase PostgreSQL database  
**Purpose**: Primary source of truth for provenance metadata

```sql
CREATE TABLE dataset_provenance (
    -- Core identifiers
    provenance_id VARCHAR(36) PRIMARY KEY,
    dataset_id VARCHAR(100) NOT NULL UNIQUE,
    dataset_name VARCHAR(255) NOT NULL,
    
    -- Source information (JSONB for flexibility)
    source_info JSONB NOT NULL,
    
    -- License information (JSONB)
    license_info JSONB NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acquired_at TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    validated_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Processing lineage (JSONB)
    processing_lineage JSONB NOT NULL,
    
    -- Storage information (JSONB)
    storage_info JSONB NOT NULL,
    
    -- Audit information (JSONB)
    audit_info JSONB DEFAULT '{}',
    
    -- Additional metadata (JSONB)
    metadata JSONB DEFAULT '{}',
    
    -- Full provenance document (JSONB, denormalized for convenience)
    provenance_document JSONB NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_provenance_json CHECK (provenance_document IS NOT NULL),
    CONSTRAINT valid_source_info CHECK (source_info->>'source_id' IS NOT NULL),
    CONSTRAINT valid_license_info CHECK (license_info->>'license_type' IS NOT NULL)
);

-- Indexes for efficient querying
CREATE INDEX idx_provenance_dataset_id ON dataset_provenance(dataset_id);
CREATE INDEX idx_provenance_source_id ON dataset_provenance((source_info->>'source_id'));
CREATE INDEX idx_provenance_license_type ON dataset_provenance((license_info->>'license_type'));
CREATE INDEX idx_provenance_created_at ON dataset_provenance(created_at);
CREATE INDEX idx_provenance_updated_at ON dataset_provenance(updated_at);
CREATE INDEX idx_provenance_quality_tier ON dataset_provenance((metadata->>'quality_tier'));

-- Full-text search index for dataset names
CREATE INDEX idx_provenance_dataset_name_fts ON dataset_provenance USING GIN(to_tsvector('english', dataset_name));

-- JSONB GIN indexes for complex queries
CREATE INDEX idx_provenance_source_info_gin ON dataset_provenance USING GIN(source_info);
CREATE INDEX idx_provenance_processing_lineage_gin ON dataset_provenance USING GIN(processing_lineage);
CREATE INDEX idx_provenance_storage_info_gin ON dataset_provenance USING GIN(storage_info);
```

### Table: `provenance_audit_log`

**Purpose**: Immutable audit log of all provenance changes

```sql
CREATE TABLE provenance_audit_log (
    audit_id VARCHAR(36) PRIMARY KEY,
    provenance_id VARCHAR(36) NOT NULL,
    dataset_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'audited'
    changed_by VARCHAR(100) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    old_value JSONB,
    new_value JSONB,
    change_reason TEXT,
    
    FOREIGN KEY (provenance_id) REFERENCES dataset_provenance(provenance_id) ON DELETE CASCADE
);

CREATE INDEX idx_audit_log_provenance_id ON provenance_audit_log(provenance_id);
CREATE INDEX idx_audit_log_dataset_id ON provenance_audit_log(dataset_id);
CREATE INDEX idx_audit_log_changed_at ON provenance_audit_log(changed_at);
CREATE INDEX idx_audit_log_action ON provenance_audit_log(action);
```

---

## 2. File Storage (Secondary Storage)

### S3 Structure

**Bucket**: `pixelated-datasets`  
**Region**: `us-east-1` (or configured region)  
**Path Pattern**: `provenance/{dataset_id}/{version}/provenance.json`

**Example**:
```
s3://pixelated-datasets/provenance/priority_1_FINAL/v1.0.0/provenance.json
s3://pixelated-datasets/provenance/priority_1_FINAL/v1.0.0/audit_report_2025-12-18.json
```

### File Naming Convention

- Provenance metadata: `provenance.json`
- Audit reports: `audit_report_{YYYY-MM-DD}.json`
- Historical versions: `provenance_v{version}.json`

### Versioning

S3 versioning enabled on the provenance bucket to maintain immutable history.

---

## 3. Index Storage (Optional - Performance Optimization)

### Elasticsearch/OpenSearch Index

**Index Name**: `dataset-provenance`  
**Purpose**: Fast full-text search and complex queries

**Mapping**:
```json
{
  "mappings": {
    "properties": {
      "provenance_id": {"type": "keyword"},
      "dataset_id": {"type": "keyword"},
      "dataset_name": {"type": "text", "fields": {"keyword": {"type": "keyword"}}},
      "source.source_name": {"type": "text"},
      "source.source_type": {"type": "keyword"},
      "license.license_type": {"type": "keyword"},
      "timestamps.created_at": {"type": "date"},
      "metadata.quality_tier": {"type": "keyword"},
      "processing_lineage.processing_stages": {"type": "nested"},
      "storage.storage_path": {"type": "keyword"}
    }
  }
}
```

**Sync Strategy**: 
- Real-time sync via database triggers OR
- Periodic batch sync (every 5 minutes)

---

## Data Flow

### Creation Flow

1. **Dataset Processing Pipeline** generates provenance metadata
2. **Provenance Service** validates against schema
3. **Database Write**: Insert into `dataset_provenance` table
4. **Audit Log**: Insert into `provenance_audit_log` (action: 'created')
5. **S3 Write**: Upload provenance JSON to S3
6. **Index Update**: Sync to Elasticsearch (if enabled)

### Update Flow

1. **Update Request** received with new provenance data
2. **Fetch Current**: Retrieve existing provenance from database
3. **Merge/Update**: Update provenance document
4. **Database Write**: Update `dataset_provenance` table
5. **Audit Log**: Insert into `provenance_audit_log` (action: 'updated', includes old_value and new_value)
6. **S3 Write**: Upload updated provenance JSON (new version)
7. **Index Update**: Update Elasticsearch document

### Query Flow

1. **Query Request** received (e.g., "Find all datasets from PubMed")
2. **Primary Query**: Query PostgreSQL database
3. **Optional**: Use Elasticsearch for complex full-text searches
4. **Return**: Combined results with provenance documents

---

## Storage Considerations

### Retention Policy

- **Database**: Retain all provenance records indefinitely (no automatic deletion)
- **S3**: Retain all versions indefinitely (with lifecycle policies for cost optimization)
- **Audit Log**: Retain for minimum 7 years (compliance requirement)

### Backup Strategy

1. **Database Backups**: Daily automated backups via Supabase
2. **S3 Replication**: Cross-region replication for disaster recovery
3. **Point-in-Time Recovery**: Enabled for database

### Access Control

- **Database**: Role-based access control (RBAC) via Supabase
- **S3**: IAM policies restricting access to data governance team
- **Audit Log**: Read-only access for auditors, write-only for system

### Performance Optimization

1. **Partitioning**: Consider partitioning `provenance_audit_log` by date for large tables
2. **Archiving**: Archive old audit logs (>2 years) to cold storage
3. **Caching**: Cache frequently accessed provenance data in Redis

---

## Implementation Phases

### Phase 1: Core Database Schema (Week 1)
- Create `dataset_provenance` table
- Create `provenance_audit_log` table
- Implement basic CRUD operations
- **Deliverable**: Working database schema

### Phase 2: File Storage Integration (Week 1-2)
- Set up S3 bucket structure
- Implement S3 upload/download functions
- Implement versioning
- **Deliverable**: Provenance files stored in S3

### Phase 3: Service Layer (Week 2)
- Build Provenance Service API
- Implement validation against schema
- Implement audit logging
- **Deliverable**: Complete provenance service

### Phase 4: Integration (Week 2-3)
- Integrate with dataset processing pipeline
- Add provenance generation to ingestion workflows
- Add provenance updates to processing stages
- **Deliverable**: End-to-end provenance tracking

### Phase 5: Query & Reporting (Week 3)
- Build query API
- Implement audit report generation
- Add Elasticsearch integration (optional)
- **Deliverable**: Query interface and audit reports

---

## Migration Strategy

### Existing Datasets

For existing datasets without provenance metadata:

1. **Backfill Script**: Generate provenance metadata from available information
2. **Validation**: Review and validate backfilled provenance
3. **Marking**: Tag backfilled records with `source: "backfilled"` flag
4. **Documentation**: Document any missing or inferred information

---

## Compliance & Security

### HIPAA Considerations

- Provenance metadata may contain PHI/PII references
- Ensure encryption at rest and in transit
- Access logging required
- Audit trail must be tamper-proof

### GDPR Considerations

- Right to deletion: Provenance can be anonymized but not fully deleted (audit requirement)
- Data portability: Provenance must be exportable
- Processing records: Provenance serves as processing record

---

## Monitoring & Alerting

### Key Metrics

- Provenance creation rate
- Provenance update rate
- Query latency (p95, p99)
- Storage growth rate
- Audit log size

### Alerts

- Failed provenance creation/updates
- Missing provenance for new datasets
- Slow queries (>1s)
- Storage threshold breaches (>80% capacity)

---

## Future Enhancements

1. **Distributed Tracing**: Link provenance to distributed processing traces
2. **Blockchain Integration**: Immutable provenance records (future consideration)
3. **Automated Compliance Checking**: Automated checks against license and compliance requirements
4. **Provenance Visualization**: Visual lineage graphs for datasets

---

**Last Updated**: 2025-12-18  
**Owner**: Data Governance Team  
**Review Schedule**: Quarterly

