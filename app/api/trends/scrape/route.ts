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

// Diverse source pools to rotate through
const fashionSources = {
  publications: ['vogue.com', 'harpersbazaar.com', 'elle.com', 'wwd.com', 'businessoffashion.com', 'fashionista.com'],
  social: ['instagram.com', 'tiktok.com', 'pinterest.com', 'twitter.com'],
  retail: ['ssense.com', 'net-a-porter.com', 'farfetch.com', 'matchesfashion.com'],
  streetwear: ['hypebeast.com', 'highsnobiety.com', 'complex.com', 'grailed.com'],
  athletic: ['nike.com', 'adidas.com', 'puma.com', 'underarmour.com', 'lululemon.com']
}

// Get random sources for diversity
function getRandomSources(category: string, count: number = 2): string[] {
  const sources = fashionSources[category as keyof typeof fashionSources] || []
  return sources.sort(() => Math.random() - 0.5).slice(0, count)
}

// Generate brand-specific search queries
function generateBrandSpecificQueries(brandInfo: any) {
  const currentDate = new Date()
  const month = currentDate.toLocaleDateString('en-US', { month: 'long' })
  const year = currentDate.getFullYear()
  const season = getSeason()
  const nextSeason = getNextSeason()
  
  // Default brand context (can be customized based on user's brand)
  const brandContext = brandInfo?.brand_name?.toLowerCase() || 'fashion'
  const brandCategory = brandInfo?.industry || 'general'
  
  // Tailor queries based on brand type
  let queries = []
  
  if (brandContext.includes('nike') || brandContext.includes('athletic') || brandCategory.includes('sport')) {
    queries = [
      `athletic wear trends ${month} ${year} sneaker culture streetwear`,
      `${nextSeason} sportswear trends performance fashion tech fabrics`,
      `celebrity athlete fashion ${year} sports style influencers`,
      `sustainable athletic wear eco-friendly sports fashion ${year}`
    ]
  } else if (brandContext.includes('luxury') || brandCategory.includes('luxury')) {
    queries = [
      `luxury fashion trends ${season} ${year} haute couture designer`,
      `high-end accessories trends ${year} luxury handbags jewelry`,
      `celebrity red carpet fashion ${month} ${year} luxury brands`,
      `${nextSeason} luxury fashion forecast designer collections`
    ]
  } else {
    // General fashion queries
    queries = [
      `fashion trends ${month} ${year} street style viral tiktok`,
      `${nextSeason} fashion trends forecast upcoming styles ${year}`,
      `celebrity fashion ${month} ${year} influencer style trends`,
      `sustainable fashion trends ${year} eco-friendly materials`,
      `emerging fashion designers ${year} new brands to watch`
    ]
  }
  
  // Limit to 5 queries for speed
  return queries.slice(0, 5)
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

// Parse trends using OpenAI - optimized for speed
async function parseTrendsWithAI(content: string, url: string, brandContext?: string) {
  try {
    const prompt = `Extract 5-8 specific fashion trends from this content. Focus on actual items/styles relevant to ${brandContext || 'fashion brands'}.

Content: ${content.slice(0, 2500)}

For each trend, provide a JSON array with these exact fields:
- name: Specific trend name (2-4 words, e.g., "Oversized Blazers", "Neon Running Shoes")
- description: Brief description (1-2 sentences about what it is and why it's trending)
- category: One of: color, pattern, silhouette, fabric, accessory, footwear, lifestyle, tech, general
- is_forecast: true if it's upcoming/predicted for next season, false if currently trending
- relevance: 0.7-1.0 for how relevant to ${brandContext || 'fashion'}

Important: Return ONLY a valid JSON array, no other text.`

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.6,
      max_tokens: 1000
    })
    
    let trendsJson = response.choices[0].message.content?.trim() || '[]'
    
    // Clean up response
    trendsJson = trendsJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    
    // Try to parse
    let trends = []
    try {
      trends = JSON.parse(trendsJson)
      if (!Array.isArray(trends)) {
        console.error('AI response is not an array:', trendsJson)
        return []
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', trendsJson)
      return []
    }
    
    // Add default demographics and validate
    return trends
      .filter(trend => trend.name && trend.category) // Must have at least name and category
      .slice(0, 8) // Max 8 trends per source
      .map((trend: any) => ({
        name: trend.name,
        description: trend.description || `${trend.name} is trending in ${brandContext || 'fashion'}`,
        category: trend.category || 'general',
        is_forecast: trend.is_forecast === true,
        relevance: trend.relevance || 0.8,
        demographics: {
          age_range: [18, 45],
          gender: 'all',
          locations: ['New York', 'Los Angeles', 'London', 'Paris', 'Tokyo'],
          income_level: 'medium',
          lifestyle: ['urban', 'fashion-forward'],
          interests: ['fashion', 'style']
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
      
      // Get brand info (TODO: fetch from user profile)
      const brandInfo = { brand_name: 'Nike', industry: 'athletic' } // Example
      
      // Generate brand-specific queries
      const queries = generateBrandSpecificQueries(brandInfo)
      sendProgress(`Generated ${queries.length} brand-specific queries`)
      
      const allTrends: any[] = []
      const brandContext = brandInfo?.brand_name || 'fashion'
      const processedUrls = new Set<string>()
      
      // Process queries sequentially for better control
      for (const query of queries) {
        sendProgress(`Searching: "${query}"...`)
        
        try {
          // Get search results with content
          const searchResult = await firecrawl.search(query, {
            limit: 5, // 5 results per query
            scrapeOptions: {
              formats: ["markdown"],
              timeout: 4000,
              waitFor: 300
            }
          })
          
          if (!searchResult.data || searchResult.data.length === 0) {
            sendProgress(`No results for: "${query}"`)
            continue
          }
          
          sendProgress(`Found ${searchResult.data.length} results for: "${query}"`)
          
          // Process each result directly (no re-scraping needed)
          for (const result of searchResult.data) {
            if (!result.url || processedUrls.has(result.url)) continue
            processedUrls.add(result.url)
            
            if (!result.markdown || result.markdown.length < 200) {
              sendProgress(`Skipping ${new URL(result.url).hostname} - insufficient content`)
              continue
            }
            
            const domain = new URL(result.url).hostname
            sendProgress(`Extracting trends from ${domain}...`)
            
            const trends = await parseTrendsWithAI(
              result.markdown,
              result.url,
              brandContext
            )
            
            if (trends.length > 0) {
              sendProgress(`Found ${trends.length} trends from ${domain}`)
              
              // Add source info to each trend
              trends.forEach((trend: any) => {
                allTrends.push({
                  ...trend,
                  source_url: result.url,
                  source_title: result.title || domain
                })
              })
            } else {
              sendProgress(`No trends extracted from ${domain}`)
            }
            
            // Stop if we have enough trends
            if (allTrends.length >= 30) break
          }
          
          if (allTrends.length >= 30) break
        } catch (error) {
          console.error(`Search error for "${query}":`, error)
          sendProgress(`Error searching "${query}": ${error}`)
        }
      }
      
      sendProgress(`Extracted ${allTrends.length} raw trends`)
      
      if (allTrends.length === 0) {
        sendProgress('ERROR: No trends extracted. Please try again in a few moments.')
        sendProgress('ERROR', {
          success: false,
          error: 'No trends could be extracted. The sources might be temporarily unavailable. Please retry.'
        })
        return
      }
      
      // Deduplicate and limit to 30 trends
      const uniqueTrends = new Map<string, any>()
      const trendSources = new Map<string, number>()
      
      for (const trend of allTrends) {
        if (uniqueTrends.size >= 30) break
        
        const trendId = trend.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        
        if (!uniqueTrends.has(trendId)) {
          uniqueTrends.set(trendId, trend)
          trendSources.set(trendId, 1)
        } else {
          trendSources.set(trendId, (trendSources.get(trendId) || 1) + 1)
        }
      }
      
      sendProgress(`Saving ${uniqueTrends.size} unique trends to database...`)
      
      // Insert/update trends with better error handling
      let insertedCount = 0
      let updatedCount = 0
      let errorCount = 0
      
      for (const [trendId, trend] of uniqueTrends) {
        try {
          const sourceCount = trendSources.get(trendId) || 1
          const metrics = calculateTrendMetrics(trend, sourceCount)
          
          // Balance trend types - 60% signals, 40% forecasts
          const randomFactor = Math.random()
          const shouldBeForecast = trend.is_forecast || randomFactor < 0.4
          
          const trendType = shouldBeForecast && metrics.momentum_score < 70
            ? 'forecast' : 'signal'
          
          const trendData = {
            trend_identifier: trendId,
            trend_category: trend.category || 'general',
            trend_description: trend.description || '',
            trend_type: trendType,
            ...metrics,
            last_updated: new Date().toISOString(),
            created_at: new Date().toISOString()
          }
          
          // Log the trend being saved
          console.log(`Saving trend: ${trendId}`, { type: trendType, category: trend.category })
          
          // Check if exists
          const { data: existing, error: selectError } = await supabaseService
            .from('trends')
            .select('trend_id')
            .eq('trend_identifier', trendId)
            .maybeSingle()
          
          if (selectError) {
            console.error(`Error checking trend ${trendId}:`, selectError)
            errorCount++
            continue
          }
          
          if (existing) {
            // Update existing
            const { data: updated, error: updateError } = await supabaseService
              .from('trends')
              .update(trendData)
              .eq('trend_id', existing.trend_id)
              .select()
              .single()
            
            if (updateError) {
              console.error(`Error updating trend ${trendId}:`, updateError)
              errorCount++
            } else {
              updatedCount++
              sendProgress(`Updated: ${trend.name}`)
            }
          } else {
            // Insert new
            const { data: inserted, error: insertError } = await supabaseService
              .from('trends')
              .insert(trendData)
              .select()
              .single()
            
            if (insertError) {
              console.error(`Error inserting trend ${trendId}:`, insertError)
              console.error('Trend data:', trendData)
              errorCount++
            } else {
              insertedCount++
              sendProgress(`Added: ${trend.name}`)
            }
          }
        } catch (error) {
          console.error(`Error processing trend ${trend.name}:`, error)
          errorCount++
        }
      }
      
      const duration = Date.now() - startTime
      const message = `Completed in ${(duration/1000).toFixed(1)}s! Added ${insertedCount} new trends, updated ${updatedCount}${errorCount > 0 ? `, ${errorCount} errors` : ''}`
      
      sendProgress(message)
      
      // Send final result
      sendProgress('COMPLETE', {
        success: true,
        inserted: insertedCount,
        updated: updatedCount,
        errors: errorCount,
        total: insertedCount + updatedCount,
        duration: duration
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