-- Consent Management Schema
-- Enables granular management of user consent for research and data processing
-- Supports consent versions, withdrawal workflows, and audit trails

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Research Consent Types - defines the available consent types
CREATE TABLE consent_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    scope VARCHAR(50) NOT NULL, -- e.g., 'research', 'data_processing', 'messaging'
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, scope)
);

-- Consent Document Versions - tracks versions of consent documents
CREATE TABLE consent_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consent_type_id UUID NOT NULL REFERENCES consent_types(id),
    version VARCHAR(20) NOT NULL, -- semantic versioning
    effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
    expiration_date TIMESTAMP WITH TIME ZONE,
    document_text TEXT NOT NULL, -- full text of consent document
    summary TEXT NOT NULL, -- plain language summary
    is_current BOOLEAN NOT NULL DEFAULT false, -- is this the current version?
    approval_date TIMESTAMP WITH TIME ZONE NOT NULL, -- when was this version approved
    approved_by UUID NOT NULL, -- who approved this version
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(consent_type_id, version)
);

-- User Consents - records individual user consent records
CREATE TABLE user_consents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_version_id UUID NOT NULL REFERENCES consent_versions(id),
    granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45), -- IPv6 compatible
    user_agent TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true, -- false if withdrawn
    withdrawal_date TIMESTAMP WITH TIME ZONE, -- when consent was withdrawn
    withdrawal_reason TEXT, -- optional reason for withdrawal
    granular_options JSONB, -- stores specific consent options if applicable
    proof_of_consent TEXT, -- verification data (e.g. cryptographic signature)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, consent_version_id)
);

-- Consent Audit Trail - comprehensive audit trail for all consent operations
CREATE TABLE consent_audit_trail (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_id UUID REFERENCES user_consents(id),
    action VARCHAR(50) NOT NULL, -- 'grant', 'withdraw', 'update', 'view'
    action_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    performed_by UUID NOT NULL, -- who performed this action (user or system)
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB NOT NULL, -- additional action details
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Granular Consent Options - defines available granular options for each consent type
CREATE TABLE consent_options (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consent_type_id UUID NOT NULL REFERENCES consent_types(id),
    option_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT false,
    default_value BOOLEAN NOT NULL DEFAULT false,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(consent_type_id, option_name)
);

-- Consent Reminders - scheduled reminders for consent renewal
CREATE TABLE consent_reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_id UUID NOT NULL REFERENCES user_consents(id),
    reminder_date TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Row-Level Security Policies
-- Ensure users can only access their own consent data

-- User Consents Policy
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;

-- Users can see their own consents
CREATE POLICY "Users can view their own consents"
  ON user_consents FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own consents
CREATE POLICY "Users can update their own consents"
  ON user_consents FOR UPDATE
  USING (auth.uid() = user_id);

-- Consent Audit Trail Policy
ALTER TABLE consent_audit_trail ENABLE ROW LEVEL SECURITY;

-- Users can view their own consent audit trail
CREATE POLICY "Users can view their own consent audit trail"
  ON consent_audit_trail FOR SELECT
  USING (auth.uid() = user_id);

-- Consent Reminders Policy
ALTER TABLE consent_reminders ENABLE ROW LEVEL SECURITY;

-- Users can view their own consent reminders
CREATE POLICY "Users can view their own consent reminders"
  ON consent_reminders FOR SELECT
  USING (auth.uid() = user_id);

-- Public access to consent types and versions
ALTER TABLE consent_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_options ENABLE ROW LEVEL SECURITY;

-- Anyone can view consent types
CREATE POLICY "Anyone can view consent types"
  ON consent_types FOR SELECT
  USING (true);

-- Anyone can view consent versions
CREATE POLICY "Anyone can view consent versions"
  ON consent_versions FOR SELECT
  USING (true);

-- Anyone can view consent options
CREATE POLICY "Anyone can view consent options"
  ON consent_options FOR SELECT
  USING (true);

-- Admin access for consent management
-- Note: These assume an 'admin' claim in the JWT token

-- Admin can manage consent types
CREATE POLICY "Admins can manage consent types"
  ON consent_types
  USING (auth.jwt() ? 'admin' AND auth.jwt()->'admin'::text = 'true'::jsonb);

-- Admin can manage consent versions
CREATE POLICY "Admins can manage consent versions"
  ON consent_versions
  USING (auth.jwt() ? 'admin' AND auth.jwt()->'admin'::text = 'true'::jsonb);

-- Admin can view all user consents
CREATE POLICY "Admins can view all user consents"
  ON user_consents FOR SELECT
  USING (auth.jwt() ? 'admin' AND auth.jwt()->'admin'::text = 'true'::jsonb);

-- Admin can view all consent audit trails
CREATE POLICY "Admins can view all consent audit trails"
  ON consent_audit_trail FOR SELECT
  USING (auth.jwt() ? 'admin' AND auth.jwt()->'admin'::text = 'true'::jsonb);

-- Admin can manage consent options
CREATE POLICY "Admins can manage consent options"
  ON consent_options
  USING (auth.jwt() ? 'admin' AND auth.jwt()->'admin'::text = 'true'::jsonb);

-- Helper functions

-- Function to check if a user has active consent of a specific type
CREATE OR REPLACE FUNCTION user_has_active_consent(
    user_uuid UUID,
    consent_type_name VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    has_consent BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM user_consents uc
        JOIN consent_versions cv ON uc.consent_version_id = cv.id
        JOIN consent_types ct ON cv.consent_type_id = ct.id
        WHERE uc.user_id = user_uuid
        AND ct.name = consent_type_name
        AND uc.is_active = true
    ) INTO has_consent;

    RETURN has_consent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to withdraw consent
CREATE OR REPLACE FUNCTION withdraw_consent(
    user_uuid UUID,
    consent_uuid UUID,
    reason TEXT
) RETURNS VOID AS $$
BEGIN
    -- Update the consent record
    UPDATE user_consents
    SET is_active = false,
        withdrawal_date = CURRENT_TIMESTAMP,
        withdrawal_reason = reason,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = consent_uuid
    AND user_id = user_uuid;

    -- Add audit trail entry
    INSERT INTO consent_audit_trail (
        user_id,
        consent_id,
        action,
        performed_by,
        details
    ) VALUES (
        user_uuid,
        consent_uuid,
        'withdraw',
        user_uuid,
        jsonb_build_object(
            'reason', reason,
            'timestamp', CURRENT_TIMESTAMP
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default consent types
INSERT INTO consent_types (name, description, scope)
VALUES
    ('Research Participation', 'Consent to participate in research studies and data collection for research purposes', 'research'),
    ('Data Processing', 'Consent to process personal data for service improvement', 'data_processing'),
    ('Anonymous Analytics', 'Consent to collect anonymous usage analytics', 'analytics'),
    ('Communications', 'Consent to receive communications and updates', 'communications')
ON CONFLICT (name, scope) DO NOTHING;
