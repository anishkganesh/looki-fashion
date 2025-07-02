-- Migration script to simplify recommendations to a single table

-- Step 1: Create new simplified recommendations table
CREATE TABLE IF NOT EXISTS recommendations_simple (
  recommendation_id SERIAL PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(brand_id),
  product_id INTEGER NOT NULL REFERENCES products(product_id),
  matched_trend_id INTEGER REFERENCES trends(trend_id),
  
  -- Scores and factors
  alignment_score DECIMAL(5,2) DEFAULT 0,
  confidence_score DECIMAL(5,2) DEFAULT 0,
  
  -- Alignment factors as JSONB
  alignment_factors JSONB DEFAULT '{
    "category_match": 0,
    "demographic_alignment": 0,
    "style_match": 0,
    "seasonality_match": 0,
    "lifecycle_compatibility": 0,
    "trend_momentum": 0
  }'::jsonb,
  
  -- Recommendation details
  recommendation_type VARCHAR(50) DEFAULT 'trend_based',
  recommendation_action VARCHAR(50) NOT NULL,
  
  -- Reasons as JSONB array
  reasons JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  generated_by VARCHAR(50) DEFAULT 'smart_ai_v3',
  is_active BOOLEAN DEFAULT true,
  applied_at TIMESTAMP,
  status VARCHAR(50),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Step 2: Migrate existing data if tables exist
DO $$
BEGIN
  -- Check if old tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'recommendations') THEN
    -- Migrate data from existing tables
    INSERT INTO recommendations_simple (
      brand_id,
      product_id,
      matched_trend_id,
      alignment_score,
      confidence_score,
      alignment_factors,
      recommendation_type,
      recommendation_action,
      reasons,
      generated_by,
      is_active,
      applied_at,
      status,
      expires_at,
      created_at,
      updated_at
    )
    SELECT 
      r.brand_id,
      r.product_id,
      r.matched_trend_id,
      r.alignment_score,
      r.confidence_score,
      COALESCE(r.alignment_factors, '{
        "category_match": 0,
        "demographic_alignment": 0,
        "style_match": 0,
        "seasonality_match": 0,
        "lifecycle_compatibility": 0,
        "trend_momentum": 0
      }'::jsonb),
      COALESCE(r.recommendation_type, 'trend_based'),
      r.recommendation_action,
      COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'type', rr.reason_type,
            'code', rr.reason_code,
            'description', rr.reason_description,
            'impact_score', rr.impact_score,
            'supporting_data', COALESCE(rr.supporting_data, '{}'::jsonb)
          )
        )
        FROM recommendation_reasons rr
        WHERE rr.recommendation_id = r.recommendation_id
      ), '[]'::jsonb),
      COALESCE(r.generated_by, 'smart_ai_v3'),
      COALESCE(r.is_active, true),
      r.applied_at,
      r.status,
      COALESCE(r.expires_at, NOW() + INTERVAL '7 days'),
      r.created_at,
      r.updated_at
    FROM recommendations r;
  END IF;
END $$;

-- Step 3: Create indexes for performance
CREATE INDEX idx_recommendations_simple_brand_id ON recommendations_simple(brand_id);
CREATE INDEX idx_recommendations_simple_product_id ON recommendations_simple(product_id);
CREATE INDEX idx_recommendations_simple_trend_id ON recommendations_simple(matched_trend_id);
CREATE INDEX idx_recommendations_simple_brand_active ON recommendations_simple(brand_id, is_active);
CREATE INDEX idx_recommendations_simple_confidence ON recommendations_simple(confidence_score DESC);
CREATE INDEX idx_recommendations_simple_action ON recommendations_simple(recommendation_action);

-- Step 4: Drop old tables and rename new one
DO $$
BEGIN
  -- Drop old tables if they exist
  DROP TABLE IF EXISTS recommendation_reasons CASCADE;
  DROP TABLE IF EXISTS recommendations CASCADE;
  
  -- Rename the new table
  ALTER TABLE recommendations_simple RENAME TO recommendations;
  
  -- Update the primary key constraint name
  ALTER TABLE recommendations RENAME CONSTRAINT recommendations_simple_pkey TO recommendations_pkey;
  
  -- Update index names
  ALTER INDEX idx_recommendations_simple_brand_id RENAME TO idx_recommendations_brand_id;
  ALTER INDEX idx_recommendations_simple_product_id RENAME TO idx_recommendations_product_id;
  ALTER INDEX idx_recommendations_simple_trend_id RENAME TO idx_recommendations_trend_id;
  ALTER INDEX idx_recommendations_simple_brand_active RENAME TO idx_recommendations_brand_active;
  ALTER INDEX idx_recommendations_simple_confidence RENAME TO idx_recommendations_confidence;
  ALTER INDEX idx_recommendations_simple_action RENAME TO idx_recommendations_action;
END $$;

-- Step 5: Create or replace updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_recommendations_updated_at ON recommendations;
CREATE TRIGGER update_recommendations_updated_at 
BEFORE UPDATE ON recommendations 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Step 6: Add RLS policies
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

-- Allow users to see recommendations for their brand
CREATE POLICY "Users can view their brand recommendations" ON recommendations
    FOR SELECT
    USING (
        brand_id IN (
            SELECT brand_id FROM usr WHERE auth.uid() = usr_id
        )
    );

-- Allow service role full access
CREATE POLICY "Service role has full access" ON recommendations
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- Step 7: Grant permissions
GRANT SELECT ON recommendations TO authenticated;
GRANT ALL ON recommendations TO service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully migrated to simplified recommendations table!';
END $$;