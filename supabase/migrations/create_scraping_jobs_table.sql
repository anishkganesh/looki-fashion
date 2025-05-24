-- Create scraping_jobs table to track scraping history
CREATE TABLE IF NOT EXISTS scraping_jobs (
    job_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    trends_found INTEGER,
    trends_updated INTEGER,
    trends_inserted INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_scraping_jobs_started_at ON scraping_jobs(started_at DESC);
CREATE INDEX idx_scraping_jobs_status ON scraping_jobs(status);

-- Add comment
COMMENT ON TABLE scraping_jobs IS 'Tracks the history and status of trend scraping jobs'; 