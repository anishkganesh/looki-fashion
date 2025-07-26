-- Add product_count column to campaigns table
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS product_count INTEGER DEFAULT 0;

-- Update existing campaigns with product count from campaign_products
UPDATE campaigns c
SET product_count = (
  SELECT COUNT(*)
  FROM campaign_products cp
  WHERE cp.campaign_id = c.campaign_id
)
WHERE product_count = 0 OR product_count IS NULL; 