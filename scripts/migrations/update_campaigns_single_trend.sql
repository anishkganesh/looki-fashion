-- Add trend_id and social_reach to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS trend_id INTEGER REFERENCES trends(trend_id),
ADD COLUMN IF NOT EXISTS social_reach INTEGER DEFAULT 0;

-- Create index for trend_id
CREATE INDEX IF NOT EXISTS idx_campaigns_trend_id ON campaigns(trend_id);

-- Migrate existing campaign_trends data (take the first trend for each campaign)
UPDATE campaigns c
SET trend_id = (
    SELECT ct.trend_id 
    FROM campaign_trends ct 
    WHERE ct.campaign_id = c.campaign_id 
    ORDER BY ct.trend_id 
    LIMIT 1
)
WHERE c.trend_id IS NULL 
AND EXISTS (
    SELECT 1 FROM campaign_trends ct WHERE ct.campaign_id = c.campaign_id
);

-- Update social_reach from the associated trend
UPDATE campaigns c
SET social_reach = t.social_reach
FROM trends t
WHERE c.trend_id = t.trend_id
AND c.social_reach = 0;

-- Note: The campaign_trends table can be dropped later after verifying the migration
-- DROP TABLE IF EXISTS campaign_trends; 