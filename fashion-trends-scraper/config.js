// Configuration file for Fashion Trends Scraper
require('dotenv').config();

module.exports = {
    firecrawl: {
        apiKey: process.env.FIRECRAWL_API_KEY || 'REDACTED_FIRECRAWL_KEY'
    },
    supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dfxauievbyqwcynwtvib.supabase.co',
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'REDACTED_SUPABASE_JWT'
    }
}; 