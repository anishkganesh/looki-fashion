# Vercel Deployment Instructions

## Prerequisites
1. Vercel account (free tier is sufficient)
2. Supabase project with the trends table
3. Environment variables configured

## Environment Variables
Add these to your Vercel project settings:

```
OPENAI_API_KEY=your-openai-api-key
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
FIRECRAWL_API_KEY=REDACTED_FIRECRAWL_KEY
```

## Database Setup
1. Run the SQL migration in your Supabase SQL editor:
   ```sql
   -- Copy contents from supabase/migrations/create_scraping_jobs_table.sql
   ```

## Deployment Steps
1. Push your code to GitHub
2. Import the project in Vercel
3. Add all environment variables
4. Deploy

## Trend Agent Features
- **Manual Trend Agent**: Click "Run Trend Agent" button to immediately fetch 100+ trends
- **Auto-Run Agent**: Enable "Start Auto-Run Agent" to check every hour if 3 hours have passed since last run
- **Auto-Check on Load**: Dashboard automatically checks and runs trend agent if needed when you visit
- **Toast Notifications**: Shows next run time and results

## How the Trend Agent Works
- Searches 40+ different fashion sources including:
  - Fashion weeks (Paris, Milan, NYC, London, Copenhagen)
  - Celebrity red carpets and street style
  - Music festivals and concerts
  - Social media platforms (TikTok, Instagram, Pinterest)
  - Fashion retailers and magazines
  - Cultural and regional fashion trends
- Extracts 100+ unique trends per run using advanced pattern matching
- Updates existing trends with averaged metrics
- Handles Firecrawl API rate limits intelligently

## Local Development
For local testing, the same trend agent features work:
- Manual button triggers immediate trend collection
- Auto-run agent checks hourly if enabled
- Dashboard checks on page load

## Monitoring
- View trend collection history in the `scraping_jobs` table in Supabase
- Latest trends are stored in the `trends` table with detailed metrics
- Toast notifications show agent status and next run time

## Troubleshooting
1. If trend agent fails, check browser console for errors
2. Ensure all environment variables are set correctly
3. Check that the database tables exist in Supabase
4. Verify Firecrawl API key is valid and has sufficient credits 