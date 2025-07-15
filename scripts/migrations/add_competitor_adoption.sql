-- Add competitor_adoption column to trends table
ALTER TABLE trends 
ADD COLUMN IF NOT EXISTS competitor_adoption JSONB DEFAULT '{"brands": [], "percentage": 0}'::jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_trends_competitor_adoption ON trends USING GIN (competitor_adoption);

-- Update existing trends to have default competitor adoption data
UPDATE trends 
SET competitor_adoption = '{"brands": [], "percentage": 0}'::jsonb
WHERE competitor_adoption IS NULL; 