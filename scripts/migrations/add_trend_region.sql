-- Add trend_region column to trends table
ALTER TABLE trends 
ADD COLUMN IF NOT EXISTS trend_region TEXT DEFAULT 'global';

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_trends_region ON trends(trend_region);

-- Add comment for documentation
COMMENT ON COLUMN trends.trend_region IS 'Region of the trend: global or specific region like india, brazil, usa'; 