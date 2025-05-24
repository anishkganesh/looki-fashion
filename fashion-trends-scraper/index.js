// Fashion Trends Scraper
// Main entry point for scraping fashion trends and uploading to Supabase

const FirecrawlApp = require('@mendable/firecrawl-js').default;
const { createClient } = require('@supabase/supabase-js');
const config = require('./config');
const TrendAnalyzer = require('./trendAnalyzer');

class FashionTrendsScraper {
    constructor() {
        this.firecrawl = new FirecrawlApp({ apiKey: config.firecrawl.apiKey });
        this.supabase = createClient(config.supabase.url, config.supabase.anonKey);
        this.trendAnalyzer = new TrendAnalyzer();
    }

    // Define search queries for different trend sources
    getSearchQueries() {
        const today = new Date().toISOString().split('T')[0];
        const currentMonth = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        return [
            `"upcoming fashion trends" "${currentMonth}" 2025`,
            `"fashion week trends" spring summer 2025 emerging`,
            // Temporarily commented out for testing
            /*
            `"new fashion trends" "what to wear" 2025`,
            `"celebrity fashion" "spotted wearing" trending ${today}`,
            `"music festival fashion" Coachella "summer trends" 2025`,
            `"TikTok fashion trends" viral "Gen Z style" 2025`,
            `"Instagram fashion trends" influencer "must have" 2025`,
            `"fashion color trends" Pantone "color of the year" 2025`,
            `"sustainable fashion trends" eco-friendly "upcoming styles"`,
            `"street style trends" "fashion capitals" Paris Milan New York`,
            `"Met Gala" "red carpet fashion" trends influence 2025`,
            `"fashion technology" "smart fabrics" "future trends" 2025`
            */
        ];
    }

    // Extract trend identifiers from content
    extractTrendIdentifiers(content) {
        const trends = new Set();
        
        // Pattern matching for trend names
        const trendPatterns = [
            /(?:trend[s]?|style[s]?|look[s]?):\s*([^.!?,]+)/gi,
            /(?:wearing|sporting|rocking)\s+(?:the\s+)?([^.!?,]+)/gi,
            /(?:new|upcoming|emerging)\s+([^.!?,]+)\s+(?:trend|style|look)/gi,
            /([^.!?,]+)\s+(?:is|are)\s+(?:trending|popular|viral)/gi,
            /"([^"]+)"\s+(?:trend|style|look)/gi
        ];

        trendPatterns.forEach(pattern => {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                if (match[1]) {
                    const trend = match[1].trim().toLowerCase()
                        .replace(/\s+/g, '-')
                        .replace(/[^\w-]/g, '')
                        .slice(0, 50); // Limit length
                    
                    if (trend.length > 3 && !trend.match(/^(the|and|for|with|from)$/)) {
                        trends.add(trend);
                    }
                }
            }
        });

        // Also look for specific items mentioned
        const itemPatterns = [
            /\b(oversized blazers?|crop tops?|wide-leg pants?|mini skirts?|maxi dresses?)\b/gi,
            /\b(neon colors?|pastel shades?|metallic fabrics?|bold prints?)\b/gi,
            /\b(sustainable materials?|recycled fabrics?|vegan leather)\b/gi,
            /\b(y2k fashion|90s revival|minimalist style|maximalist trend)\b/gi
        ];

        itemPatterns.forEach(pattern => {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                if (match[0]) {
                    const trend = match[0].trim().toLowerCase().replace(/\s+/g, '-');
                    trends.add(trend);
                }
            }
        });

        return Array.from(trends);
    }

    // Perform search and scrape content
    async searchAndScrape(query) {
        try {
            console.log(`Searching for: ${query}`);
            
            const searchResult = await this.firecrawl.search(query, {
                limit: 5,
                scrapeOptions: {
                    formats: ["markdown", "links"],
                    timeout: 30000
                }
            });

            const results = [];
            
            if (searchResult.data) {
                for (const result of searchResult.data) {
                    const content = result.markdown || '';
                    const title = result.title || '';
                    const url = result.url || '';
                    
                    // Combine title and content for analysis
                    const fullContent = `${title} ${content}`;
                    
                    // Extract trend identifiers
                    const trendIdentifiers = this.extractTrendIdentifiers(fullContent);
                    
                    // Analyze each trend
                    for (const rawTrendId of trendIdentifiers) {
                        // Clean up the trend identifier with OpenAI
                        const trendId = await this.trendAnalyzer.processTrendIdentifier(rawTrendId);
                        const analysis = await this.trendAnalyzer.analyzeTrend(trendId, fullContent);
                        results.push({
                            ...analysis,
                            source_url: url,
                            source_title: title
                        });
                    }
                }
            }
            
            return results;
        } catch (error) {
            console.error(`Error searching for "${query}":`, error);
            return [];
        }
    }

    // Upload trends to Supabase
    async uploadToSupabase(trends) {
        try {
            const now = new Date().toISOString();
            let updatedCount = 0;
            let insertedCount = 0;
            
            // Process each trend
            for (const trend of trends) {
                // Remove fields that aren't in the database schema
                const { source_url, source_title, ...trendData } = trend;
                
                // Check if trend already exists
                const { data: existingTrend, error: fetchError } = await this.supabase
                    .from('trends')
                    .select('trend_id')
                    .eq('trend_identifier', trendData.trend_identifier)
                    .single();
                
                if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
                    console.error('Error checking existing trend:', fetchError);
                    continue;
                }
                
                if (existingTrend) {
                    // Update existing trend with new metrics
                    const { error: updateError } = await this.supabase
                        .from('trends')
                        .update({
                            ...trendData,
                            last_updated: now,
                            // Don't update created_at
                        })
                        .eq('trend_id', existingTrend.trend_id);
                    
                    if (updateError) {
                        console.error('Error updating trend:', updateError);
                    } else {
                        updatedCount++;
                    }
                } else {
                    // Insert new trend
                    const { error: insertError } = await this.supabase
                        .from('trends')
                        .insert({
                            ...trendData,
                            last_updated: now,
                            created_at: now
                        });
                    
                    if (insertError) {
                        console.error('Error inserting trend:', insertError);
                    } else {
                        insertedCount++;
                    }
                }
            }
            
            console.log(`Updated ${updatedCount} existing trends, inserted ${insertedCount} new trends`);
            
            // Mark old trends as inactive (not seen in last 24 hours)
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { error: inactiveError } = await this.supabase
                .from('trends')
                .update({ lifecycle_stage: 'dormant' })
                .lt('last_updated', yesterday)
                .neq('lifecycle_stage', 'dormant');
            
            if (inactiveError) {
                console.error('Error marking inactive trends:', inactiveError);
            }
            
            return { updated: updatedCount, inserted: insertedCount, total: updatedCount + insertedCount };
        } catch (error) {
            console.error('Error uploading to Supabase:', error);
            return { updated: 0, inserted: 0, total: 0 };
        }
    }

    // Main execution function
    async run() {
        console.log('Starting Fashion Trends Scraper...');
        
        const queries = this.getSearchQueries();
        const allTrends = [];
        
        // Process each search query
        for (const query of queries) {
            const trends = await this.searchAndScrape(query);
            allTrends.push(...trends);
            
            // Add delay between searches to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Remove duplicates based on trend_identifier
        const uniqueTrends = Array.from(
            new Map(allTrends.map(trend => [trend.trend_identifier, trend])).values()
        );
        
        console.log(`Found ${uniqueTrends.length} unique trends`);
        
        // Upload to Supabase
        const uploadResult = await this.uploadToSupabase(uniqueTrends);
        
        console.log(`Scraping complete! Updated ${uploadResult.updated}, inserted ${uploadResult.inserted} trends`);
        
        // Return summary
        return {
            totalSearches: queries.length,
            totalTrendsFound: allTrends.length,
            uniqueTrends: uniqueTrends.length,
            updatedTrends: uploadResult.updated,
            insertedTrends: uploadResult.inserted,
            totalProcessed: uploadResult.total,
            trends: uniqueTrends.slice(0, 10) // Return first 10 as sample
        };
    }
}

// Execute if run directly
if (require.main === module) {
    const scraper = new FashionTrendsScraper();
    scraper.run()
        .then(result => {
            console.log('\nSummary:');
            console.log(`- Total searches performed: ${result.totalSearches}`);
            console.log(`- Total trends found: ${result.totalTrendsFound}`);
            console.log(`- Unique trends: ${result.uniqueTrends}`);
            console.log(`- Updated trends: ${result.updatedTrends}`);
            console.log(`- Inserted trends: ${result.insertedTrends}`);
            console.log(`- Total processed: ${result.totalProcessed}`);
            console.log('\nSample trends:');
            result.trends.forEach(trend => {
                console.log(`  - ${trend.trend_identifier} (${trend.trend_category}, ${trend.lifecycle_stage})`);
            });
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = FashionTrendsScraper; 