-- ===========================================
-- PROVENANCE METADATA SCHEMA
-- ===========================================
-- Dataset Expansion Project - Provenance Tracking
-- Related: KAN-9, Epic: KAN-1 (Governance & Licensing)
-- Schema Version: 1.0
-- Date: 2025-12-18
--
-- This schema implements provenance metadata tracking as defined in:
-- - governance/provenance_schema.json (schema definition)
-- - governance/provenance_storage_plan.md (storage plan)

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- For JSONB indexes

-- ===========================================
-- Table: dataset_provenance
-- ===========================================
-- Primary table for storing provenance metadata
CREATE TABLE IF NOT EXISTS dataset_provenance (
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
    audit_info JSONB DEFAULT '{}'::jsonb,
    
    -- Additional metadata (JSONB)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Full provenance document (JSONB, denormalized for convenience)
    provenance_document JSONB NOT NULL,
    
    -- Constraints
    CONSTRAINT valid_provenance_json CHECK (provenance_document IS NOT NULL),
    CONSTRAINT valid_source_info CHECK (source_info->>'source_id' IS NOT NULL),
    CONSTRAINT valid_license_info CHECK (license_info->>'license_type' IS NOT NULL)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_provenance_dataset_id 
    ON dataset_provenance(dataset_id);

CREATE INDEX IF NOT EXISTS idx_provenance_source_id 
    ON dataset_provenance((source_info->>'source_id'));

CREATE INDEX IF NOT EXISTS idx_provenance_license_type 
    ON dataset_provenance((license_info->>'license_type'));

CREATE INDEX IF NOT EXISTS idx_provenance_created_at 
    ON dataset_provenance(created_at);

CREATE INDEX IF NOT EXISTS idx_provenance_updated_at 
    ON dataset_provenance(updated_at);

CREATE INDEX IF NOT EXISTS idx_provenance_quality_tier 
    ON dataset_provenance((metadata->>'quality_tier'));

-- Full-text search index for dataset names
CREATE INDEX IF NOT EXISTS idx_provenance_dataset_name_fts 
    ON dataset_provenance 
    USING GIN(to_tsvector('english', dataset_name));

-- JSONB GIN indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_provenance_source_info_gin 
    ON dataset_provenance USING GIN(source_info);

CREATE INDEX IF NOT EXISTS idx_provenance_processing_lineage_gin 
    ON dataset_provenance USING GIN(processing_lineage);

CREATE INDEX IF NOT EXISTS idx_provenance_storage_info_gin 
    ON dataset_provenance USING GIN(storage_info);

-- ===========================================
-- Table: provenance_audit_log
-- ===========================================
-- Immutable audit log of all provenance changes
CREATE TABLE IF NOT EXISTS provenance_audit_log (
    audit_id VARCHAR(36) PRIMARY KEY,
    provenance_id VARCHAR(36) NOT NULL,
    dataset_id VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'audited'
    changed_by VARCHAR(100) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    old_value JSONB,
    new_value JSONB,
    change_reason TEXT,
    
    FOREIGN KEY (provenance_id) 
        REFERENCES dataset_provenance(provenance_id) 
        ON DELETE CASCADE
);

-- Indexes for audit log
CREATE INDEX IF NOT EXISTS idx_audit_log_provenance_id 
    ON provenance_audit_log(provenance_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_dataset_id 
    ON provenance_audit_log(dataset_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at 
    ON provenance_audit_log(changed_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_action 
    ON provenance_audit_log(action);

CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by 
    ON provenance_audit_log(changed_by);

-- ===========================================
-- Function: update_updated_at_timestamp
-- ===========================================
-- Automatically update updated_at timestamp on row update
CREATE OR REPLACE FUNCTION update_provenance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_provenance_updated_at ON dataset_provenance;
CREATE TRIGGER trigger_update_provenance_updated_at
    BEFORE UPDATE ON dataset_provenance
    FOR EACH ROW
    EXECUTE FUNCTION update_provenance_updated_at();

-- ===========================================
-- Function: create_audit_log_entry
-- ===========================================
-- Helper function to create audit log entries
CREATE OR REPLACE FUNCTION create_provenance_audit_entry(
    p_provenance_id VARCHAR(36),
    p_dataset_id VARCHAR(100),
    p_action VARCHAR(50),
    p_changed_by VARCHAR(100),
    p_old_value JSONB DEFAULT NULL,
    p_new_value JSONB DEFAULT NULL,
    p_change_reason TEXT DEFAULT NULL
) RETURNS VARCHAR(36) AS $$
DECLARE
    v_audit_id VARCHAR(36);
BEGIN
    -- Generate audit_id using uuid-ossp
    v_audit_id := gen_random_uuid()::VARCHAR;
    
    -- Insert audit log entry
    INSERT INTO provenance_audit_log (
        audit_id,
        provenance_id,
        dataset_id,
        action,
        changed_by,
        old_value,
        new_value,
        change_reason
    ) VALUES (
        v_audit_id,
        p_provenance_id,
        p_dataset_id,
        p_action,
        p_changed_by,
        p_old_value,
        p_new_value,
        p_change_reason
    );
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- View: provenance_summary
-- ===========================================
-- Convenience view for quick provenance overview
CREATE OR REPLACE VIEW provenance_summary AS
SELECT 
    provenance_id,
    dataset_id,
    dataset_name,
    source_info->>'source_name' as source_name,
    source_info->>'source_type' as source_type,
    license_info->>'license_type' as license_type,
    license_info->>'license_verification_status' as license_status,
    metadata->>'quality_tier' as quality_tier,
    metadata->>'record_count' as record_count,
    created_at,
    updated_at,
    audit_info->>'compliance_status' as compliance_status
FROM dataset_provenance;

-- ===========================================
-- Comments for documentation
-- ===========================================
COMMENT ON TABLE dataset_provenance IS 
    'Primary table for dataset provenance metadata tracking. Stores complete provenance information including source, license, processing lineage, and audit trail.';

COMMENT ON TABLE provenance_audit_log IS 
    'Immutable audit log tracking all changes to provenance records for compliance and traceability.';

COMMENT ON COLUMN dataset_provenance.provenance_document IS 
    'Complete provenance document in JSON format. Denormalized for convenience but also stored in separate fields for querying.';

COMMENT ON COLUMN dataset_provenance.processing_lineage IS 
    'Complete processing lineage showing all transformations applied to the dataset with timestamps, quality metrics, and stage details.';

COMMENT ON VIEW provenance_summary IS 
    'Convenience view providing quick access to key provenance fields for reporting and dashboards.';
