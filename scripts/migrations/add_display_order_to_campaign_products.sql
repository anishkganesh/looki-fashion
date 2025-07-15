-- Add display_order column to campaign_products table
ALTER TABLE campaign_products 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_products_display_order 
ON campaign_products(campaign_id, display_order); 