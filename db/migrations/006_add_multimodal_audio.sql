-- Multimodal audio persistence for Pixelated Empathy
-- Stores audio uploads, transcriptions, audio emotion analysis, and fused outputs

CREATE TABLE IF NOT EXISTS audio_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID,
    user_id UUID,
    duration_seconds NUMERIC(10, 3),
    sample_rate INTEGER,
    channel_count INTEGER DEFAULT 1,
    codec VARCHAR(50),
    mime_type VARCHAR(50),
    size_bytes BIGINT,
    storage_path TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transcriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audio_recording_id UUID REFERENCES audio_recordings(id) ON DELETE CASCADE,
    full_text TEXT,
    language VARCHAR(10),
    overall_confidence NUMERIC(5, 3),
    processing_time_ms NUMERIC(12, 3),
    provider VARCHAR(50) DEFAULT 'whisper',
    model_name VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audio_emotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audio_recording_id UUID REFERENCES audio_recordings(id) ON DELETE CASCADE,
    valence NUMERIC(6, 3),
    arousal NUMERIC(6, 3),
    dominance NUMERIC(6, 3),
    primary_emotion VARCHAR(50),
    confidence NUMERIC(6, 3),
    speech_rate_wpm NUMERIC(8, 3),
    intensity_score NUMERIC(6, 3),
    model_name VARCHAR(50) DEFAULT 'wav2vec2',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS multimodal_fusion_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID,
    audio_recording_id UUID REFERENCES audio_recordings(id) ON DELETE CASCADE,
    text_emotion JSONB,
    audio_emotion JSONB,
    fused_emotion JSONB,
    conflict_score NUMERIC(6, 3),
    text_contribution NUMERIC(6, 3),
    audio_contribution NUMERIC(6, 3),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Convenience indexes for retrieval
CREATE INDEX IF NOT EXISTS idx_audio_recordings_user_session ON audio_recordings(user_id, session_id);
CREATE INDEX IF NOT EXISTS idx_audio_recordings_created_at ON audio_recordings(created_at);
CREATE INDEX IF NOT EXISTS idx_transcriptions_confidence ON transcriptions(overall_confidence);
CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions(created_at);
CREATE INDEX IF NOT EXISTS idx_audio_emotions_primary_emotion ON audio_emotions(primary_emotion);
CREATE INDEX IF NOT EXISTS idx_audio_emotions_created_at ON audio_emotions(created_at);
CREATE INDEX IF NOT EXISTS idx_fusion_conflict_score ON multimodal_fusion_results(conflict_score);
CREATE INDEX IF NOT EXISTS idx_fusion_created_at ON multimodal_fusion_results(created_at);
