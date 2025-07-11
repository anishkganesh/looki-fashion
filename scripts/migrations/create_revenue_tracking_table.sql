-- Create table to track revenue performance of products with applied recommendations/campaigns
CREATE TABLE IF NOT EXISTS applied_actions_tracking (
  tracking_id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  brand_id INTEGER NOT NULL REFERENCES brands(brand_id),
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('recommendation', 'campaign')),
  action_id INTEGER NOT NULL, -- recommendation_id or campaign_id
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Baseline metrics at time of application
  baseline_revenue DECIMAL(10, 2) DEFAULT 0,
  baseline_units_sold INTEGER DEFAULT 0,
  baseline_conversion_rate DECIMAL(5, 2) DEFAULT 0,
  
  -- Current metrics (updated daily)
  current_revenue DECIMAL(10, 2) DEFAULT 0,
  current_units_sold INTEGER DEFAULT 0,
  current_conversion_rate DECIMAL(5, 2) DEFAULT 0,
  
  -- Performance metrics
  revenue_change_amount DECIMAL(10, 2) DEFAULT 0,
  revenue_change_percentage DECIMAL(5, 2) DEFAULT 0,
  units_change_amount INTEGER DEFAULT 0,
  units_change_percentage DECIMAL(5, 2) DEFAULT 0,
  
  -- Peak performance tracking
  peak_revenue_increase_percentage DECIMAL(5, 2) DEFAULT 0,
  peak_revenue_date DATE,
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Create unique constraint to prevent duplicate tracking
  UNIQUE(product_id, action_type, action_id)
);

-- Create indexes for performance
CREATE INDEX idx_applied_actions_brand_id ON applied_actions_tracking(brand_id);
CREATE INDEX idx_applied_actions_product_id ON applied_actions_tracking(product_id);
CREATE INDEX idx_applied_actions_type_id ON applied_actions_tracking(action_type, action_id);
CREATE INDEX idx_applied_actions_applied_at ON applied_actions_tracking(applied_at);
CREATE INDEX idx_applied_actions_active ON applied_actions_tracking(is_active) WHERE is_active = TRUE;

-- Create table for daily revenue snapshots
CREATE TABLE IF NOT EXISTS revenue_snapshots (
  snapshot_id SERIAL PRIMARY KEY,
  tracking_id INTEGER NOT NULL REFERENCES applied_actions_tracking(tracking_id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  
  -- Daily metrics
  daily_revenue DECIMAL(10, 2) DEFAULT 0,
  daily_units_sold INTEGER DEFAULT 0,
  daily_conversion_rate DECIMAL(5, 2) DEFAULT 0,
  
  -- Comparison to baseline
  revenue_vs_baseline_percentage DECIMAL(5, 2) DEFAULT 0,
  units_vs_baseline_percentage DECIMAL(5, 2) DEFAULT 0,
  
  -- Comparison to brand average
  brand_avg_revenue DECIMAL(10, 2) DEFAULT 0,
  revenue_vs_brand_avg_percentage DECIMAL(5, 2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Prevent duplicate snapshots for same day
  UNIQUE(tracking_id, snapshot_date)
);

-- Create indexes for snapshots
CREATE INDEX idx_revenue_snapshots_tracking_id ON revenue_snapshots(tracking_id);
CREATE INDEX idx_revenue_snapshots_date ON revenue_snapshots(snapshot_date);
CREATE INDEX idx_revenue_snapshots_tracking_date ON revenue_snapshots(tracking_id, snapshot_date);

-- Create view for easy querying of latest performance
CREATE OR REPLACE VIEW applied_actions_performance AS
SELECT 
  aat.*,
  p.product_name,
  p.variant_sku,
  p.category_hierarchy,
  p.current_price,
  CASE 
    WHEN aat.action_type = 'recommendation' THEN t.trend_identifier
    WHEN aat.action_type = 'campaign' THEN c.campaign_name
  END as action_name,
  CASE 
    WHEN aat.action_type = 'recommendation' THEN r.recommendation_action
    WHEN aat.action_type = 'campaign' THEN 'Campaign'
  END as action_detail
FROM applied_actions_tracking aat
JOIN products p ON aat.product_id = p.product_id
LEFT JOIN recommendations r ON aat.action_type = 'recommendation' AND aat.action_id = r.recommendation_id
LEFT JOIN trends t ON r.matched_trend_id = t.trend_id
LEFT JOIN campaigns c ON aat.action_type = 'campaign' AND aat.action_id = c.campaign_id
WHERE aat.is_active = TRUE;

-- Function to track when a recommendation is applied
CREATE OR REPLACE FUNCTION track_recommendation_applied()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_applied = TRUE AND (OLD.is_applied IS NULL OR OLD.is_applied = FALSE) THEN
    -- Calculate baseline metrics (last 7 days)
    INSERT INTO applied_actions_tracking (
      product_id,
      brand_id,
      action_type,
      action_id,
      baseline_revenue,
      baseline_units_sold,
      baseline_conversion_rate
    )
    SELECT 
      NEW.product_id,
      NEW.brand_id,
      'recommendation',
      NEW.recommendation_id,
      COALESCE(p.revenue_last_7d, 0),
      COALESCE(p.units_sold_last_7d, 0),
      COALESCE(p.conversion_rate_last_7d, 0)
    FROM products p
    WHERE p.product_id = NEW.product_id
    ON CONFLICT (product_id, action_type, action_id) 
    DO UPDATE SET
      applied_at = CURRENT_TIMESTAMP,
      is_active = TRUE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for recommendations
CREATE TRIGGER track_recommendation_applied_trigger
AFTER UPDATE ON recommendations
FOR EACH ROW
EXECUTE FUNCTION track_recommendation_applied();

-- Function to track when a campaign is applied
CREATE OR REPLACE FUNCTION track_campaign_applied()
RETURNS TRIGGER AS $$
DECLARE
  product_record RECORD;
BEGIN
  IF NEW.is_applied = TRUE AND (OLD.is_applied IS NULL OR OLD.is_applied = FALSE) THEN
    -- Track each product in the campaign
    FOR product_record IN 
      SELECT cp.product_id, NEW.brand_id
      FROM campaign_products cp
      WHERE cp.campaign_id = NEW.campaign_id
    LOOP
      INSERT INTO applied_actions_tracking (
        product_id,
        brand_id,
        action_type,
        action_id,
        baseline_revenue,
        baseline_units_sold,
        baseline_conversion_rate
      )
      SELECT 
        product_record.product_id,
        product_record.brand_id,
        'campaign',
        NEW.campaign_id,
        COALESCE(p.revenue_last_7d, 0),
        COALESCE(p.units_sold_last_7d, 0),
        COALESCE(p.conversion_rate_last_7d, 0)
      FROM products p
      WHERE p.product_id = product_record.product_id
      ON CONFLICT (product_id, action_type, action_id) 
      DO UPDATE SET
        applied_at = CURRENT_TIMESTAMP,
        is_active = TRUE;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for campaigns
CREATE TRIGGER track_campaign_applied_trigger
AFTER UPDATE ON campaigns
FOR EACH ROW
EXECUTE FUNCTION track_campaign_applied();

-- Add columns to products table for revenue tracking
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS revenue_last_7d DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS units_sold_last_7d INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate_last_7d DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS revenue_last_30d DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS units_sold_last_30d INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS conversion_rate DECIMAL(5, 2) DEFAULT 0; 