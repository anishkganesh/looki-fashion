import { NextResponse } from 'next/server'
import FirecrawlApp from '@mendable/firecrawl-js'
import { supabaseService } from '@/lib/supabase-service'
import OpenAI from 'openai'

// Initialize services
const firecrawl = new FirecrawlApp({ 
  apiKey: process.env.FIRECRAWL_API_KEY! 
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

// Progress update helper
function createProgressStream() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController | null = null
  
  const stream = new ReadableStream({
    start(c) {
      controller = c
    }
  })
  
  const sendProgress = (message: string, data?: any) => {
    if (controller) {
      const event = `data: ${JSON.stringify({ message, data, timestamp: Date.now() })}\n\n`
      controller.enqueue(encoder.encode(event))
    }
  }
  
  const close = () => {
    if (controller) {
      controller.close()
    }
  }
  
  return { stream, sendProgress, close }
}

// Generate search queries based on brand info
function generateSearchQueries(brandInfo: any) {
  const currentDate = new Date()
  const month = currentDate.toLocaleDateString('en-US', { month: 'long' })
  const year = currentDate.getFullYear()
  const season = getSeason()
  const nextSeason = getNextSeason()
  
  // Expanded to 10 diverse queries for better coverage
  const queries = [
    // Celebrity & Entertainment
    `celebrity fashion trends ${month} ${year} red carpet met gala taylor swift beyonce`,
    `celebrity street style ${month} ${year} kendall jenner hailey bieber zendaya`,
    
    // Fashion Weeks & Runway
    `fashion week ${season} ${year} runway trends paris milan new york london`,
    `${nextSeason} ${year} fashion trends forecast upcoming collections designer preview`,
    
    // Social Media & Viral Trends
    `tiktok fashion trends viral ${month} ${year} gen z aesthetic pinterest`,
    `instagram fashion influencer trends ${year} outfit ideas street style`,
    
    // Fashion News & Publications
    `vogue fashion trends ${month} ${year} harpers bazaar elle wwd`,
    `upcoming fashion trends ${nextSeason} ${year} forecast predictions future`,
    
    // Events & Culture
    `coachella festival fashion ${year} concert tour merch celebrity style`,
    `fashion trends forecast ${year} sustainable tech innovation future of fashion`
  ]
  
  return queries
}

function getSeason() {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'fall'
  return 'winter'
}

function getNextSeason() {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'summer'
  if (month >= 5 && month <= 7) return 'fall'
  if (month >= 8 && month <= 10) return 'winter'
  return 'spring'
}

// Parse trends using OpenAI
async function parseTrendsWithAI(content: string, url: string, brandInfo?: any) {
  try {
    const prompt = `Extract specific fashion trends from this content. Focus on actual clothing items, styles, colors, patterns, and fashion movements. Return a JSON array of up to 15 distinct trends.

Content: ${content.slice(0, 3000)}
Source URL: ${url}

For each trend, provide:
- name: Specific trend name (2-5 words, be VERY specific)
- description: Detailed description including who's wearing it, where it was spotted, why it's trending (2-3 sentences)
- category: One of: color, pattern, silhouette, fabric, accessory, footwear, lifestyle, sustainable, tech, general
- relevance: How relevant to fashion brands (0-1)
- is_forecast: boolean - true if this is an upcoming/predicted trend, false if currently active
- forecast_indicators: array of strings that indicate why this is a forecast trend (e.g., "SS24 runway", "upcoming season", "predicted for fall")
- demographics: {
    age_range: [min, max] (e.g., [18, 35]),
    gender: "all" | "male" | "female" | "non-binary",
    locations: array of specific cities where this trend is/will be popular,
    income_level: "low" | "medium" | "high" | "luxury",
    lifestyle: array of lifestyle tags,
    interests: array of interest tags
  }

Examples of good trend names:
- "Oversized Blazers"
- "Neon Green Accessories"
- "Y2K Low Rise Jeans"
- "Coquette Bow Details"
- "Gorpcore Technical Wear"
- "Metallic Silver Boots"
- "Shearling Aviator Jackets"
- "Micro Mini Skirts"
- "Oversized Tote Bags"
- "90s Minimalism Revival"

Look for forecast indicators like:
- "upcoming season", "next year", "SS24", "FW24"
- "predicted to", "expected to trend", "will be popular"
- "emerging trend", "on the horizon", "future of fashion"
- "runway preview", "designer forecast", "trend forecast"

Return ONLY valid JSON array, no markdown formatting.`

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo-1106',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7, // Slightly higher for more variety
      max_tokens: 2000
    })
    
    let trendsJson = response.choices[0].message.content?.trim() || '[]'
    
    // Strip markdown code blocks if present
    trendsJson = trendsJson.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
    
    // Parse and validate
    const trends = JSON.parse(trendsJson)
    
    // Define fashion capitals and major cities
    const fashionCapitals = ['Paris', 'Milan', 'New York', 'London', 'Tokyo']
    const majorCities = ['Los Angeles', 'Chicago', 'San Francisco', 'Miami', 'Berlin', 'Barcelona', 
                        'Seoul', 'Shanghai', 'Mumbai', 'São Paulo', 'Sydney', 'Dubai', 'Stockholm',
                        'Copenhagen', 'Amsterdam', 'Madrid', 'Rome', 'Hong Kong', 'Singapore']
    
    // Ensure each trend has proper structure
    return trends.map((trend: any) => ({
      ...trend,
      is_forecast: trend.is_forecast || false,
      forecast_indicators: trend.forecast_indicators || [],
      demographics: {
        age_range: trend.demographics?.age_range || [18, 45],
        gender: trend.demographics?.gender || 'all',
        locations: trend.demographics?.locations?.length > 0 
          ? trend.demographics.locations 
          : [...fashionCapitals.slice(0, 3), ...majorCities.slice(0, 2)],
        income_level: trend.demographics?.income_level || 'medium',
        lifestyle: trend.demographics?.lifestyle || ['urban', 'fashion-forward'],
        interests: trend.demographics?.interests || ['fashion', 'style']
      }
    }))
  } catch (error) {
    console.error('AI parsing error:', error)
    return []
  }
}

// Calculate trend metrics
function calculateTrendMetrics(trend: any, sourceCount: number) {
  const now = new Date()
  
  // Base momentum on whether it's forecast or current
  const baseMomentum = trend.is_forecast ? 30 : 60
  const momentum = Math.min(100, baseMomentum + (sourceCount * 10) + Math.random() * 20)
  
  // Velocity (rate of growth) - lower for forecasts
  const baseVelocity = trend.is_forecast ? 3 : 8
  const velocity = baseVelocity + (sourceCount * 2) + Math.random() * 5
  
  // Lifecycle stage based on forecast status and momentum
  let lifecycle = 'emerging'
  if (trend.is_forecast) {
    lifecycle = 'emerging'
  } else if (momentum > 80) {
    lifecycle = 'viral'
  } else if (momentum > 60) {
    lifecycle = 'growing'
  } else if (momentum > 40) {
    lifecycle = 'peak'
  }
  
  // Adoption rate (0-1) - lower for forecasts
  const adoption = trend.is_forecast 
    ? Math.min(0.3, 0.05 + (momentum / 100) * 0.2)
    : Math.min(1, 0.2 + (momentum / 100) * 0.5)
  
  // Social reach - vary by demographic and forecast status
  const demographicMultiplier = trend.demographics?.age_range?.[0] < 25 ? 1.5 : 1
  const forecastMultiplier = trend.is_forecast ? 0.3 : 1
  const socialReach = Math.floor((10000 + (momentum * 5000) + Math.random() * 50000) * demographicMultiplier * forecastMultiplier)
  
  // Risk score (0-1) - higher for forecasts
  const risk = trend.is_forecast 
    ? 0.4 + Math.random() * 0.3 
    : 0.1 + Math.random() * 0.2
  
  // Conversion impact (0-1)
  const conversion = trend.is_forecast
    ? 0.02 + (momentum / 100) * 0.08 + Math.random() * 0.05
    : 0.05 + (momentum / 100) * 0.15 + Math.random() * 0.1
  
  // Peak prediction - further out for forecasts
  const daysToPeak = trend.is_forecast
    ? Math.floor(60 + (1 - velocity / 30) * 120) // 60-180 days for forecasts
    : Math.floor(30 + (1 - velocity / 30) * 60)  // 30-90 days for current trends
  const peakDate = new Date(now.getTime() + daysToPeak * 24 * 60 * 60 * 1000)
  
  // Decline prediction (60-180 days after peak)
  const daysToDecline = Math.floor(60 + Math.random() * 120)
  const declineDate = new Date(peakDate.getTime() + daysToDecline * 24 * 60 * 60 * 1000)
  
  return {
    momentum_score: momentum,
    velocity: velocity,
    lifecycle_stage: lifecycle,
    adoption_rate: adoption,
    competitor_adoption: Math.random() * 0.6,
    seasonality_factor: 0.5 + Math.random() * 0.5,
    predicted_peak_date: peakDate.toISOString().split('T')[0],
    predicted_decline_date: declineDate.toISOString().split('T')[0],
    social_reach: socialReach,
    conversion_impact: conversion,
    risk_score: risk,
    // Add demographics
    target_age_min: trend.demographics?.age_range?.[0] || 18,
    target_age_max: trend.demographics?.age_range?.[1] || 65,
    target_gender: trend.demographics?.gender || 'all',
    target_locations: trend.demographics?.locations || ['US'],
    target_income_level: trend.demographics?.income_level || 'medium',
    target_lifestyle: trend.demographics?.lifestyle || [],
    target_interests: trend.demographics?.interests || []
  }
}

export async function POST(request: Request) {
  const { stream, sendProgress, close } = createProgressStream()
  
  // Start the async processing
  const processPromise = (async () => {
    try {
      const startTime = Date.now()
      
      sendProgress('Starting Fashion Trend Agent...')
      
      // Generate search queries
      const queries = generateSearchQueries(null)
      sendProgress(`Generated ${queries.length} search queries`)
      
      const allTrends: any[] = []
      const trendSources = new Map<string, number>()
      
      // Process queries with progress updates
      for (let i = 0; i < queries.length; i++) {
        const query = queries[i]
        sendProgress(`Searching: "${query}"...`)
        
        try {
          const searchResult = await firecrawl.search(query, {
            limit: 8, // Increased for better coverage
            scrapeOptions: {
              formats: ["markdown"],
              timeout: 8000, // Increased timeout for better results
              waitFor: 500
            }
          })
          
          if (!searchResult.data) {
            sendProgress(`No results for: "${query}"`)
            continue
          }
          
          sendProgress(`Found ${searchResult.data.length} websites`)
          
          // Process each website
          for (let j = 0; j < searchResult.data.length; j++) {
            const result = searchResult.data[j]
            if (!result.markdown || result.markdown.length < 100) continue
            
            const domain = new URL(result.url || '').hostname
            sendProgress(`Extracting trends from ${domain}...`)
            
            const trends = await parseTrendsWithAI(
              result.markdown,
              result.url || '',
              null
            )
            
            sendProgress(`Found ${trends.length} trends from ${domain}`)
            
            trends.slice(0, 5).forEach((trend: any) => {
              allTrends.push({
                ...trend,
                source_url: result.url,
                source_title: result.title
              })
            })
          }
        } catch (error) {
          sendProgress(`Error with query "${query}": ${error}`)
        }
      }
      
      sendProgress(`Processing ${allTrends.length} raw trends...`)
      
      // Deduplicate
      const uniqueTrends = new Map<string, any>()
      
      for (const trend of allTrends) {
        if (uniqueTrends.size >= 40) break // Increased limit
        
        const trendId = trend.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        
        if (!uniqueTrends.has(trendId)) {
          uniqueTrends.set(trendId, trend)
          trendSources.set(trendId, 1)
        } else {
          trendSources.set(trendId, (trendSources.get(trendId) || 1) + 1)
          // Merge forecast indicators
          const existing = uniqueTrends.get(trendId)
          if (trend.is_forecast && existing) {
            existing.is_forecast = true
            existing.forecast_indicators = [...(existing.forecast_indicators || []), ...(trend.forecast_indicators || [])]
          }
        }
      }
      
      sendProgress(`Identified ${uniqueTrends.size} unique trends`)
      
      // Insert/update trends
      let insertedCount = 0
      let updatedCount = 0
      const processedTrends = []
      
      sendProgress('Saving trends to database...')
      
      for (const [trendId, trend] of uniqueTrends) {
        try {
          const sourceCount = trendSources.get(trendId) || 1
          const metrics = calculateTrendMetrics(trend, sourceCount)
          
          // Determine trend type based on forecast status and indicators
          let trendType = 'signal'
          
          // Check if it's a forecast trend
          if (trend.is_forecast || 
              trend.forecast_indicators?.length > 0 ||
              metrics.lifecycle_stage === 'emerging' && metrics.momentum_score < 50 ||
              trend.description?.toLowerCase().includes('upcoming') ||
              trend.description?.toLowerCase().includes('predicted') ||
              trend.description?.toLowerCase().includes('forecast') ||
              trend.description?.toLowerCase().includes('next season') ||
              trend.description?.toLowerCase().includes('future')) {
            trendType = 'forecast'
          }
          
          const trendData = {
            trend_identifier: trendId,
            trend_category: trend.category || 'general',
            trend_description: trend.description || '',
            trend_type: trendType,
            ...metrics,
            last_updated: new Date().toISOString()
          }
          
          const { data: existing } = await supabaseService
            .from('trends')
            .select('trend_id')
            .eq('trend_identifier', trendId)
            .maybeSingle()
          
          if (existing) {
            const { error } = await supabaseService
              .from('trends')
              .update(trendData)
              .eq('trend_id', existing.trend_id)
            
            if (!error) {
              updatedCount++
              processedTrends.push({ ...trendData, trend_id: existing.trend_id })
            }
          } else {
            const { data: inserted, error } = await supabaseService
              .from('trends')
              .insert(trendData)
              .select()
              .single()
            
            if (!error && inserted) {
              insertedCount++
              processedTrends.push(inserted)
            }
          }
        } catch (error) {
          console.error(`Error processing trend ${trend.name}:`, error)
        }
      }
      
      const duration = Date.now() - startTime
      
      sendProgress(`Completed! ${insertedCount} new trends, ${updatedCount} updated in ${(duration/1000).toFixed(1)}s`)
      
      // Send final result
      sendProgress('COMPLETE', {
        success: true,
        inserted: insertedCount,
        updated: updatedCount,
        total: processedTrends.length,
        duration: duration,
        trends: processedTrends.map(t => ({
          name: t.trend_identifier.replace(/-/g, ' '),
          category: t.trend_category,
          momentum: t.momentum_score
        }))
      })
      
    } catch (error) {
      console.error('Scraping error:', error)
      sendProgress('ERROR', {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to scrape trends'
      })
    } finally {
      close()
    }
  })()
  
  // Return the stream immediately
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// GET endpoint for checking status
export async function GET() {
  try {
    const { count } = await supabaseService
      .from('trends')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      success: true,
      totalTrends: count || 0,
      message: 'Trend scraping API is ready'
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get status' },
      { status: 500 }
    )
  }
} 