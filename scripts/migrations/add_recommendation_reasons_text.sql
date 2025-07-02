-- Add recommendation_reasons column to recommendations table
-- This stores the recommendation reasons as a text field (bulleted list)
ALTER TABLE recommendations 
ADD COLUMN IF NOT EXISTS recommendation_reasons TEXT;

-- Update the column comment
COMMENT ON COLUMN recommendations.recommendation_reasons IS 'Text-based recommendation reasons stored as a bulleted list'; 