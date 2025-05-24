import { NextResponse } from 'next/server'
import FirecrawlApp from '@mendable/firecrawl-js'

const firecrawl = new FirecrawlApp({ 
  apiKey: process.env.FIRECRAWL_API_KEY || 'REDACTED_FIRECRAWL_KEY' 
})

export async function GET() {
  try {
    console.log('Test scrape starting...')
    
    // Simple search
    const query = '"fashion trends 2025" trending now'
    const searchResult = await firecrawl.search(query, {
      limit: 2,
      scrapeOptions: {
        formats: ["markdown"],
        timeout: 15000,
        waitFor: 1000
      }
    })
    
    console.log('Search result:', JSON.stringify(searchResult, null, 2))
    
    const trends: string[] = []
    
    if (searchResult.data && searchResult.data.length > 0) {
      console.log(`Found ${searchResult.data.length} results`)
      
      for (const result of searchResult.data) {
        const content = result.markdown || ''
        console.log(`Processing ${result.url}, content length: ${content.length}`)
        
        // Simple extraction - look for numbered trends
        const numberedTrends = content.match(/\d+\.\s*([^.\n]{5,80})/gi) || []
        console.log(`Found ${numberedTrends.length} numbered trends`)
        
        numberedTrends.forEach(trend => {
          trends.push(trend)
        })
        
        // Look for specific items
        const itemPatterns = [
          /\b(hot pants|polo shirts?|thong sandals?|strapless dress(?:es)?|boho chic|animal prints?)\b/gi,
          /\b(oversized|mini|maxi|chunky|platform)\s+\w+/gi
        ]
        
        itemPatterns.forEach(pattern => {
          const matches = content.match(pattern) || []
          console.log(`Pattern found ${matches.length} matches`)
          matches.forEach(match => trends.push(match))
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      query,
      resultsFound: searchResult.data?.length || 0,
      trendsExtracted: trends.length,
      trends: trends.slice(0, 20),
      firstResult: searchResult.data?.[0] ? {
        url: searchResult.data[0].url,
        title: searchResult.data[0].title,
        contentLength: searchResult.data[0].markdown?.length || 0
      } : null
    })
    
  } catch (error: any) {
    console.error('Test scrape error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
} 