-- Add columns for Marisa API sync
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS external_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_synced TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_source_external_id ON products(source, external_id);
CREATE INDEX IF NOT EXISTS idx_products_brand_source ON products(brand_id, source); 