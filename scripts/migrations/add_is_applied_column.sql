-- Add is_applied column to recommendations table
-- This tracks whether a recommendation has been applied by the user
ALTER TABLE recommendations 
ADD COLUMN IF NOT EXISTS is_applied BOOLEAN DEFAULT FALSE;

-- Add index for faster queries on applied status
CREATE INDEX IF NOT EXISTS idx_recommendations_is_applied 
ON recommendations(brand_id, is_applied);

-- Update the column comment
COMMENT ON COLUMN recommendations.is_applied IS 'Tracks whether the recommendation has been applied by the user'; 