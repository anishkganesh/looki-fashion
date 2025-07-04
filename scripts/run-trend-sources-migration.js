const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🚀 Running trend_sources table migration...\n');
  
  try {
    // Create trend_sources table
    const createTableQuery = `
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
    `;
    
    const { error } = await supabase.rpc('exec_sql', {
      sql: createTableQuery
    });
    
    if (error) {
      // Try direct query if RPC doesn't exist
      console.log('RPC not available, trying direct approach...');
      
      // We'll need to execute this via the Supabase dashboard
      console.log('\n❗ Please run the following SQL in your Supabase SQL editor:\n');
      console.log(createTableQuery);
      console.log('\n📋 The SQL has been copied to scripts/create-trend-sources.sql');
      
      // Save to file for easy copying
      const fs = require('fs');
      fs.writeFileSync('scripts/create-trend-sources.sql', createTableQuery);
      
      return;
    }
    
    console.log('✅ trend_sources table created successfully!');
    
    // Check if table exists
    const { data: tables, error: checkError } = await supabase
      .from('trend_sources')
      .select('id')
      .limit(1);
    
    if (!checkError) {
      console.log('✅ Verified: trend_sources table is accessible');
    } else {
      console.error('⚠️  Warning: Could not verify table access:', checkError.message);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration(); 