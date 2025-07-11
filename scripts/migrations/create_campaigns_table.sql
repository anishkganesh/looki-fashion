-- Create campaigns table for bundled product marketing campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    campaign_id SERIAL PRIMARY KEY,
    brand_id INTEGER NOT NULL REFERENCES brands(brand_id),
    campaign_name TEXT NOT NULL,
    campaign_description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'paused')),
    
    -- Bundling information
    bundle_criteria JSONB NOT NULL, -- What metrics were used to bundle products
    bundle_reasons TEXT[], -- Human-readable reasons for bundling
    
    -- Target audience
    target_audience JSONB NOT NULL, -- Demographics, interests, etc.
    target_audience_description TEXT,
    
    -- Budget
    budget_min DECIMAL(10,2),
    budget_max DECIMAL(10,2),
    budget_currency VARCHAR(3) DEFAULT 'USD',
    budget_reasoning TEXT,
    
    -- AI-generated content
    marketing_copy TEXT,
    hashtags TEXT[],
    content_suggestions JSONB,
    
    -- Performance metrics (will be updated over time)
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue DECIMAL(10,2) DEFAULT 0,
    roi DECIMAL(5,2), -- Return on investment percentage
    
    -- Metadata
    confidence_score FLOAT CHECK (confidence_score >= 0 AND confidence_score <= 1),
    generation_reasons JSONB, -- Why this campaign was generated
    is_applied BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create campaign_products junction table
CREATE TABLE IF NOT EXISTS campaign_products (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(product_id),
    inclusion_reason TEXT,
    expected_performance JSONB,
    UNIQUE(campaign_id, product_id)
);

-- Create campaign_trends junction table
CREATE TABLE IF NOT EXISTS campaign_trends (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    trend_id INTEGER NOT NULL REFERENCES trends(trend_id),
    relevance_score FLOAT CHECK (relevance_score >= 0 AND relevance_score <= 1),
    link_reason TEXT,
    link_factors JSONB,
    UNIQUE(campaign_id, trend_id)
);

-- Create campaign_images table for generated visuals
CREATE TABLE IF NOT EXISTS campaign_images (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type VARCHAR(50) CHECK (image_type IN ('hero', 'product_collage', 'social_media', 'banner')),
    prompt_used TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_brand_id ON campaigns(brand_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_start_date ON campaigns(start_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_end_date ON campaigns(end_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_products_campaign_id ON campaign_products(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_products_product_id ON campaign_products(product_id);
CREATE INDEX IF NOT EXISTS idx_campaign_trends_campaign_id ON campaign_trends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_trends_trend_id ON campaign_trends(trend_id);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at 
    BEFORE UPDATE ON campaigns 
    FOR EACH ROW 
    EXECUTE FUNCTION update_campaigns_updated_at();

-- Grant permissions
GRANT ALL ON campaigns TO authenticated;
GRANT ALL ON campaign_products TO authenticated;
GRANT ALL ON campaign_trends TO authenticated;
GRANT ALL ON campaign_images TO authenticated;
GRANT ALL ON SEQUENCE campaigns_campaign_id_seq TO authenticated;
GRANT ALL ON SEQUENCE campaign_products_id_seq TO authenticated;
GRANT ALL ON SEQUENCE campaign_trends_id_seq TO authenticated;
GRANT ALL ON SEQUENCE campaign_images_id_seq TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE campaigns IS 'Marketing campaigns that bundle multiple products with trend alignments';
COMMENT ON COLUMN campaigns.bundle_criteria IS 'JSON object describing what metrics were used to bundle products (e.g., category, price_range, style, color)';
COMMENT ON COLUMN campaigns.target_audience IS 'JSON object with demographic and psychographic details';
COMMENT ON COLUMN campaigns.generation_reasons IS 'JSON object explaining why this campaign was generated';
COMMENT ON TABLE campaign_products IS 'Products included in each campaign';
COMMENT ON TABLE campaign_trends IS 'Trends linked to each campaign';
COMMENT ON TABLE campaign_images IS 'Generated marketing visuals for campaigns'; 