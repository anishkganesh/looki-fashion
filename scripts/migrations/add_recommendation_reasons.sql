-- Add reasons column to recommendations table
ALTER TABLE recommendations 
ADD COLUMN IF NOT EXISTS reasons JSONB;

-- Add comment
COMMENT ON COLUMN recommendations.reasons IS 'Array of recommendation reasons with type, code, description, impact score and supporting data';

-- Example structure:
-- [
--   {
--     "reason_type": "trend_alignment",
--     "reason_code": "strong_match",
--     "reason_description": "Product shows strong alignment with sustainable fashion trend",
--     "impact_score": 0.85,
--     "supporting_data": {
--       "match_score": 85,
--       "trend_stage": "growing"
--     }
--   }
-- ] 