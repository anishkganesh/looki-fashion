
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
      
      -- Create unique constraint to prevent duplicate sources per trend
      CREATE UNIQUE INDEX IF NOT EXISTS idx_trend_sources_unique ON trend_sources(trend_id, source_url);
      
      -- Grant permissions
      GRANT ALL ON trend_sources TO authenticated;
      GRANT ALL ON SEQUENCE trend_sources_id_seq TO authenticated;
      
      -- Add comment
      COMMENT ON TABLE trend_sources IS 'Detailed tracking of all sources where trends were found';
    