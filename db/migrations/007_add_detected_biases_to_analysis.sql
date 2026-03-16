-- Add detected_biases column to bias_analyses table
ALTER TABLE bias_analyses ADD COLUMN IF NOT EXISTS detected_biases TEXT[] DEFAULT '{}';
