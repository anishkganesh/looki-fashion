// Web search API using Firecrawl
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    
    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get Firecrawl API key from environment
    const firecrawlApiKey = process.env.FIRECRAWL_API_KEY || 'REDACTED_FIRECRAWL_KEY';
    
    // Retry mechanism for API calls
    let attempts = 0;
    const maxAttempts = 2;
    let lastError = null;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      try {
        // Use Firecrawl search API
        const response = await fetch('https://api.firecrawl.dev/v1/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: query,
            limit: 5,
            scrapeOptions: {
              formats: ["markdown"],
              timeout: 20000
            }
          }),
        });

        if (!response.ok) {
          const errorData = await response.text();
          console.error(`Firecrawl API error (attempt ${attempts}):`, errorData);
          lastError = new Error(`Firecrawl API returned ${response.status}`);
          
          if (attempts < maxAttempts) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
        }

        const data = await response.json();
        
        // Transform Firecrawl results to our format
        const results = (data.data || []).map((item: any) => ({
          title: item.title || 'No title',
          link: item.url || '#',
          snippet: item.markdown ? 
            item.markdown.substring(0, 200) + (item.markdown.length > 200 ? '...' : '') :
            'No content available'
        }));
        
        return new Response(JSON.stringify({ results }), {
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error(`Error during Firecrawl search (attempt ${attempts}):`, error);
        lastError = error;
        
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
      }
    }
    
    // If all attempts failed, return error but continue without search
    console.error('All Firecrawl search attempts failed:', lastError);
    return new Response(JSON.stringify({ 
      results: [],
      error: 'Web search temporarily unavailable, continuing without search results'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Web search error:', error);
    return new Response(JSON.stringify({ 
      results: [],
      error: 'Failed to perform web search' 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 