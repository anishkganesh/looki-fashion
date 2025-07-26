-- Add image URL columns to tables if they don't exist

-- Add generated_image_url to trends table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trends' 
                   AND column_name = 'generated_image_url') THEN
        ALTER TABLE trends ADD COLUMN generated_image_url TEXT;
    END IF;
END $$;

-- Add generated_image_url to recommendations table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'recommendations' 
                   AND column_name = 'generated_image_url') THEN
        ALTER TABLE recommendations ADD COLUMN generated_image_url TEXT;
    END IF;
END $$;

-- Add hero_image_url to campaigns table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'campaigns' 
                   AND column_name = 'hero_image_url') THEN
        ALTER TABLE campaigns ADD COLUMN hero_image_url TEXT;
    END IF;
END $$;

-- Add catalog_source and last_catalog_sync to brands table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'brands' 
                   AND column_name = 'catalog_source') THEN
        ALTER TABLE brands ADD COLUMN catalog_source TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'brands' 
                   AND column_name = 'last_catalog_sync') THEN
        ALTER TABLE brands ADD COLUMN last_catalog_sync TIMESTAMPTZ;
    END IF;
END $$;

-- Add attributes column to products table if not exists (for storing additional data)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'products' 
                   AND column_name = 'attributes') THEN
        ALTER TABLE products ADD COLUMN attributes JSONB DEFAULT '{}';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trends_generated_image_url ON trends(generated_image_url) WHERE generated_image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recommendations_generated_image_url ON recommendations(generated_image_url) WHERE generated_image_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_campaigns_hero_image_url ON campaigns(hero_image_url) WHERE hero_image_url IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN trends.generated_image_url IS 'URL of AI-generated image for this trend';
COMMENT ON COLUMN recommendations.generated_image_url IS 'URL of AI-generated image for this recommendation';
COMMENT ON COLUMN campaigns.hero_image_url IS 'URL of hero image for this campaign';
COMMENT ON COLUMN brands.catalog_source IS 'Source of the product catalog (e.g., marisa_api, file_upload, manual)';
COMMENT ON COLUMN brands.last_catalog_sync IS 'Timestamp of the last catalog synchronization';