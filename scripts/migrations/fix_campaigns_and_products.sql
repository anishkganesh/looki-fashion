-- Fix campaigns and products issues
-- Date: 2025-01-03

-- 1. Add display_order column to campaign_products table if it doesn't exist
ALTER TABLE campaign_products 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1;

-- 2. Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_products_display_order 
ON campaign_products(campaign_id, display_order);

-- 3. Ensure trend_id and social_reach columns exist in campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS trend_id INTEGER REFERENCES trends(trend_id),
ADD COLUMN IF NOT EXISTS social_reach INTEGER DEFAULT 0;

-- 4. Create index for trend_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_campaigns_trend_id ON campaigns(trend_id);

-- 5. Update any campaigns that have campaign_trends but no trend_id
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

-- 6. Update social_reach from the associated trend
UPDATE campaigns c
SET social_reach = t.social_reach
FROM trends t
WHERE c.trend_id = t.trend_id
AND c.social_reach = 0;

-- 7. Update display_order for existing campaign_products
UPDATE campaign_products cp
SET display_order = sub.row_number
FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY campaign_id ORDER BY id) as row_number
    FROM campaign_products
    WHERE display_order IS NULL OR display_order = 1
) sub
WHERE cp.id = sub.id;

-- Note: After verifying everything works, you can drop campaign_trends table with:
-- DROP TABLE IF EXISTS campaign_trends CASCADE; 