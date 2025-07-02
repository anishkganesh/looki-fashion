-- Migration: Add trend enhancement columns
-- Date: 2025-01-02
-- Description: Adds columns to support better trend naming, source tracking, and confidence scoring

-- Add trend_name column to store original trend name with proper formatting (including hashtags)
ALTER TABLE trends 
ADD COLUMN IF NOT EXISTS trend_name TEXT;

-- Add source_urls column to track all sources where trend was found
ALTER TABLE trends 
ADD COLUMN IF NOT EXISTS source_urls JSONB DEFAULT '[]'::jsonb;

-- Add confidence_score column for trend confidence (0.0 to 1.0)
ALTER TABLE trends 
ADD COLUMN IF NOT EXISTS confidence_score FLOAT DEFAULT 0.8 
  CHECK (confidence_score >= 0 AND confidence_score <= 1);

-- Add originator column to track who/what started the trend
ALTER TABLE trends 
ADD COLUMN IF NOT EXISTS originator TEXT;

-- Add parent_trend_id for trend hierarchies
ALTER TABLE trends 
ADD COLUMN IF NOT EXISTS parent_trend_id INTEGER REFERENCES trends(trend_id);

-- Add mention_count to track how many times we've seen this trend
ALTER TABLE trends 
ADD COLUMN IF NOT EXISTS mention_count INTEGER DEFAULT 1;

-- Add previous_mention_count for velocity calculations
ALTER TABLE trends 
ADD COLUMN IF NOT EXISTS previous_mention_count INTEGER DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trends_trend_name ON trends(trend_name);
CREATE INDEX IF NOT EXISTS idx_trends_confidence_score ON trends(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_trends_parent_trend_id ON trends(parent_trend_id);
CREATE INDEX IF NOT EXISTS idx_trends_trend_type ON trends(trend_type);

-- Create trend_history table for tracking trend metrics over time
CREATE TABLE IF NOT EXISTS trend_history (
  id SERIAL PRIMARY KEY,
  trend_id INTEGER REFERENCES trends(trend_id) ON DELETE CASCADE,
  momentum_score INTEGER,
  social_reach INTEGER,
  mention_count INTEGER,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for trend history queries
CREATE INDEX IF NOT EXISTS idx_trend_history_trend_id ON trend_history(trend_id);
CREATE INDEX IF NOT EXISTS idx_trend_history_recorded_at ON trend_history(recorded_at DESC);

-- Create trend_sources table for detailed source tracking
CREATE TABLE IF NOT EXISTS trend_sources (
  id SERIAL PRIMARY KEY,
  trend_id INTEGER REFERENCES trends(trend_id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  source_type TEXT CHECK (source_type IN ('social', 'publication', 'retail', 'blog', 'forum', 'other')),
  source_title TEXT,
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  relevance_score FLOAT DEFAULT 0.8 CHECK (relevance_score >= 0 AND relevance_score <= 1)
);

-- Create indexes for trend sources
CREATE INDEX IF NOT EXISTS idx_trend_sources_trend_id ON trend_sources(trend_id);
CREATE INDEX IF NOT EXISTS idx_trend_sources_source_type ON trend_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_trend_sources_extracted_at ON trend_sources(extracted_at DESC);

-- Add a function to clean up old trend history (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_trend_history()
RETURNS void AS $$
BEGIN
  DELETE FROM trend_history 
  WHERE recorded_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Create a function to track trend history (can be called after each update)
CREATE OR REPLACE FUNCTION track_trend_history()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.momentum_score IS DISTINCT FROM OLD.momentum_score OR
     NEW.social_reach IS DISTINCT FROM OLD.social_reach OR
     NEW.mention_count IS DISTINCT FROM OLD.mention_count THEN
    INSERT INTO trend_history (trend_id, momentum_score, social_reach, mention_count)
    VALUES (NEW.trend_id, NEW.momentum_score, NEW.social_reach, NEW.mention_count);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically track history on trend updates
DROP TRIGGER IF EXISTS trigger_track_trend_history ON trends;
CREATE TRIGGER trigger_track_trend_history
  AFTER UPDATE ON trends
  FOR EACH ROW
  EXECUTE FUNCTION track_trend_history();

-- Update existing trends to have trend_name populated from description
UPDATE trends 
SET trend_name = 
  CASE 
    WHEN trend_description LIKE '%:%' THEN 
      SPLIT_PART(trend_description, ':', 1)
    ELSE 
      REPLACE(INITCAP(REPLACE(trend_identifier, '-', ' ')), ' ', '')
  END
WHERE trend_name IS NULL;

-- Grant appropriate permissions
GRANT ALL ON trends TO authenticated;
GRANT ALL ON trend_history TO authenticated;
GRANT ALL ON trend_sources TO authenticated;
GRANT ALL ON SEQUENCE trend_history_id_seq TO authenticated;
GRANT ALL ON SEQUENCE trend_sources_id_seq TO authenticated;

-- Add comments for documentation
COMMENT ON COLUMN trends.trend_name IS 'Original trend name with proper formatting, including hashtags';
COMMENT ON COLUMN trends.source_urls IS 'JSON array of all URLs where this trend was found';
COMMENT ON COLUMN trends.confidence_score IS 'AI confidence score for this trend (0.0-1.0)';
COMMENT ON COLUMN trends.originator IS 'Who or what started this trend (brand, influencer, etc)';
COMMENT ON COLUMN trends.parent_trend_id IS 'Reference to parent trend for hierarchical relationships';
COMMENT ON COLUMN trends.mention_count IS 'Total number of times this trend has been found';
COMMENT ON TABLE trend_history IS 'Historical tracking of trend metrics over time';
COMMENT ON TABLE trend_sources IS 'Detailed tracking of all sources where trends were found';