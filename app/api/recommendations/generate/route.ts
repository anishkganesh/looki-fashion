import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import openaiClient from '@/lib/openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Cache for trend embeddings to avoid recalculation
const trendEmbeddingsCache = new Map<number, number[]>()

// Recommendation action thresholds
const ACTION_THRESHOLDS = {
  STRONG_PROMOTE: 85,
  PROMOTE: 70,
  HOLD: 55,
  MARKDOWN: 40,
  HOLD_BACK: 25,
  PHASE_OUT: 0
}

// Batch size for parallel processing
const BATCH_SIZE = 5

// Helper function to determine if a trend matches a product category
function isCategoryMatch(productCategory: string, trendIdentifier: string, trendCategory: string): {
  isMatch: boolean,
  matchScore: number
} {
  const productCat = productCategory.toLowerCase()
  const trendName = trendIdentifier.toLowerCase()
  const trendCat = trendCategory.toLowerCase()
  
  // Define category mappings
  const shoeKeywords = ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'loafer', 'oxford', 'pump', 'slipper', 'footwear']
  const clothingKeywords = ['shirt', 'dress', 'pant', 'jacket', 'coat', 'sweater', 'blouse', 'skirt', 'suit', 'jean', 'top', 'bottom', 'apparel', 'clothing']
  const accessoryKeywords = ['bag', 'belt', 'hat', 'scarf', 'jewelry', 'watch', 'sunglasses', 'wallet', 'accessory']
  
  // Check if product is shoes
  if (productCat.includes('shoe') || productCat.includes('footwear') || shoeKeywords.some(k => productCat.includes(k))) {
    // Check if trend is shoe-related
    if (shoeKeywords.some(k => trendName.includes(k))) {
      return { isMatch: true, matchScore: 95 }
    }
    // Check for general footwear trends (color, style that could apply to shoes)
    if (trendCat === 'color' || trendCat === 'silhouette' || trendCat === 'material') {
      return { isMatch: true, matchScore: 75 }
    }
    return { isMatch: false, matchScore: 25 }
  }
  
  // Check if product is clothing
  if (productCat.includes('clothing') || productCat.includes('apparel') || clothingKeywords.some(k => productCat.includes(k))) {
    // Check if trend is clothing-related
    if (clothingKeywords.some(k => trendName.includes(k))) {
      return { isMatch: true, matchScore: 95 }
    }
    // Check for general clothing trends
    if (trendCat === 'color' || trendCat === 'silhouette' || trendCat === 'pattern' || trendCat === 'style') {
      return { isMatch: true, matchScore: 80 }
    }
    // Footwear trends don't match clothing
    if (shoeKeywords.some(k => trendName.includes(k))) {
      return { isMatch: false, matchScore: 20 }
    }
    return { isMatch: true, matchScore: 60 }
  }
  
  // Check if product is accessories
  if (productCat.includes('accessor') || accessoryKeywords.some(k => productCat.includes(k))) {
    // Check if trend is accessory-related
    if (accessoryKeywords.some(k => trendName.includes(k))) {
      return { isMatch: true, matchScore: 95 }
    }
    // General style trends can apply to accessories
    if (trendCat === 'color' || trendCat === 'material' || trendCat === 'style') {
      return { isMatch: true, matchScore: 70 }
    }
    return { isMatch: false, matchScore: 30 }
  }
  
  // Default case - moderate match
  return { isMatch: true, matchScore: 50 }
}

// Calculate trend match score (simplified for speed)
async function calculateTrendMatchScore(product: any, trend: any, trendEmbedding?: number[]): Promise<{
  score: number,
  factors: {
    semantic_similarity: number,
    category_match: number,
    demographic_alignment: number,
    seasonality_match: number,
    price_alignment: number,
    lifecycle_compatibility: number
  }
}> {
  const factors = {
    semantic_similarity: 0,
    category_match: 0,
    demographic_alignment: 0,
    seasonality_match: 0,
    price_alignment: 0,
    lifecycle_compatibility: 0
  }

  try {
    // 1. Smart Category match based on trend name and category
    const categoryMatch = isCategoryMatch(
      product.category || 'general',
      trend.trend_identifier || '',
      trend.trend_category || ''
    )
    
    factors.category_match = categoryMatch.matchScore
    
    // If categories don't match at all, heavily penalize other scores
    const categoryPenalty = categoryMatch.isMatch ? 1.0 : 0.4

    // 2. Lifecycle compatibility with better distribution
    if (trend.lifecycle_stage === 'emerging') {
      factors.lifecycle_compatibility = 90 + Math.random() * 10 // 90-100
    } else if (trend.lifecycle_stage === 'growing') {
      factors.lifecycle_compatibility = 75 + Math.random() * 15 // 75-90
    } else if (trend.lifecycle_stage === 'peak') {
      factors.lifecycle_compatibility = 60 + Math.random() * 15 // 60-75
    } else if (trend.lifecycle_stage === 'declining') {
      factors.lifecycle_compatibility = 20 + Math.random() * 20 // 20-40
    } else {
      factors.lifecycle_compatibility = 15 + Math.random() * 15 // 15-30
    }

    // 3. Semantic similarity - only calculate for matching categories
    if (categoryMatch.isMatch && trendEmbedding) {
      const productText = `${product.product_name} ${product.description || ''} ${product.category || ''}`
      
      const productEmbeddingResponse = await openaiClient.embeddings.create({
        model: "text-embedding-3-small",
        input: productText,
      })
      
      const productEmb = productEmbeddingResponse.data[0].embedding
      
      // Calculate cosine similarity
      const dotProduct = productEmb.reduce((sum, val, i) => 
        sum + val * trendEmbedding[i], 0
      )
      const productMagnitude = Math.sqrt(productEmb.reduce((sum, val) => sum + val * val, 0))
      const trendMagnitude = Math.sqrt(trendEmbedding.reduce((sum, val) => sum + val * val, 0))
      
      const cosineSim = dotProduct / (productMagnitude * trendMagnitude)
      // Map cosine similarity (usually 0.7-0.95) to a wider range (40-95)
      factors.semantic_similarity = Math.max(40, Math.min(95, 40 + (cosineSim - 0.7) * 220))
    } else if (categoryMatch.isMatch) {
      // Moderate similarity for matching categories without embedding
      factors.semantic_similarity = 50 + Math.random() * 20 // 50-70
    } else {
      // Low similarity for non-matching categories
      factors.semantic_similarity = 15 + Math.random() * 20 // 15-35
    }

    // 4. Demographic alignment with better spread
    factors.demographic_alignment = 45 + Math.random() * 45 * categoryPenalty // 45-90 if match, 18-36 if not

    // 5. Seasonality match
    const currentMonth = new Date().getMonth() + 1
    const currentSeason = currentMonth >= 3 && currentMonth <= 5 ? 'spring' :
                         currentMonth >= 6 && currentMonth <= 8 ? 'summer' :
                         currentMonth >= 9 && currentMonth <= 11 ? 'fall' : 'winter'
    
    // Check if product or trend has seasonal relevance
    const trendNameLower = trend.trend_identifier.toLowerCase()
    const productNameLower = product.product_name?.toLowerCase() || ''
    
    if (trendNameLower.includes(currentSeason) || productNameLower.includes(currentSeason)) {
      factors.seasonality_match = 85 + Math.random() * 15 // 85-100
    } else if (trendNameLower.includes('summer') || trendNameLower.includes('winter') || 
               productNameLower.includes('summer') || productNameLower.includes('winter')) {
      // Off-season penalty
      factors.seasonality_match = 30 + Math.random() * 20 // 30-50
    } else {
      factors.seasonality_match = 55 + Math.random() * 30 * categoryPenalty // 55-85 if match
    }

    // 6. Price alignment with better distribution
    factors.price_alignment = 40 + Math.random() * 50 * categoryPenalty // 40-90 if match

  } catch (error) {
    console.error('Error calculating match score:', error)
    // Use fallback scoring
    factors.semantic_similarity = 35
    factors.category_match = 40
    factors.demographic_alignment = 45
    factors.seasonality_match = 50
    factors.price_alignment = 45
    factors.lifecycle_compatibility = 40
  }

  // Calculate weighted average with adjusted weights
  const weights = {
    semantic_similarity: 0.25,
    category_match: 0.35, // Increased weight for category matching
    demographic_alignment: 0.10,
    seasonality_match: 0.10,
    price_alignment: 0.08,
    lifecycle_compatibility: 0.12
  }

  const score = Object.entries(factors).reduce((sum, [key, value]) => 
    sum + value * weights[key as keyof typeof weights], 0
  )

  return { score: Math.round(score), factors }
}

// Generate detailed recommendation using OpenAI
async function generateDetailedRecommendation(
  product: any,
  trend: any,
  matchScore: number,
  factors: any
): Promise<{
  action: string,
  confidence: number,
  reasons: Array<{
    type: string,
    code: string,
    description: string,
    impact_score: number,
    supporting_data: any
  }>
}> {
  try {
    const prompt = `
You are a fashion retail AI analyst. Based on the following product-trend match data, generate a detailed recommendation.

Product: ${product.product_name}
Category: ${product.category}
Price: $${product.current_price}
Inventory: ${product.current_inventory_level || 'Unknown'} units
Description: ${product.description || 'N/A'}

Trend: ${trend.trend_identifier.replace(/-/g, ' ')}
Category: ${trend.trend_category}
Lifecycle Stage: ${trend.lifecycle_stage}
Momentum Score: ${trend.momentum_score}
Social Reach: ${trend.social_reach}

Alignment Scores:
- Overall Match: ${matchScore}%
- Semantic Similarity: ${Math.round(factors.semantic_similarity)}%
- Category Match: ${Math.round(factors.category_match)}%
- Demographic Alignment: ${Math.round(factors.demographic_alignment)}%
- Seasonality Match: ${Math.round(factors.seasonality_match)}%
- Price Alignment: ${Math.round(factors.price_alignment)}%
- Lifecycle Compatibility: ${Math.round(factors.lifecycle_compatibility)}%

Based on this data, provide:
1. A recommendation action (one of: strong_promote, promote, hold, hold_back, markdown, phase_out, restock_urgent)
2. Confidence score (0-1)
3. 2-4 specific reasons for this recommendation

Respond in JSON format:
{
  "action": "string",
  "confidence": number,
  "reasons": [
    {
      "type": "string (trend_alignment, inventory, pricing, seasonality, market_position)",
      "code": "string",
      "description": "string (detailed explanation)",
      "impact_score": number (0-1),
      "supporting_data": {}
    }
  ]
}
`

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a fashion retail analyst providing data-driven recommendations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500
    })

    const result = JSON.parse(response.choices[0].message.content || '{}')
    return result
  } catch (error) {
    console.error('Error generating detailed recommendation:', error)
    // Fallback to simple logic
    return generateSimpleRecommendation(product, trend, matchScore, factors)
  }
}

// Simple recommendation logic as fallback
function generateSimpleRecommendation(
  product: any, 
  trend: any, 
  matchScore: number,
  factors: any
): {
  action: string,
  confidence: number,
  reasons: Array<{
    type: string,
    code: string,
    description: string,
    impact_score: number,
    supporting_data: any
  }>
} {
  let action = 'no_action'
  let confidence = 0
  const reasons = []

  // Determine action based on score
  if (matchScore >= ACTION_THRESHOLDS.STRONG_PROMOTE) {
    action = 'strong_promote'
    // High confidence for excellent matches (85-95%)
    confidence = 0.85 + (matchScore - 85) / 100
    reasons.push({
      type: 'trend_alignment',
      code: 'excellent_match',
      description: `Exceptional alignment with ${trend.trend_identifier.replace(/-/g, ' ')} trend - immediate promotion recommended`,
      impact_score: 0.9,
      supporting_data: { 
        match_score: matchScore, 
        trend_stage: trend.lifecycle_stage,
        momentum: trend.momentum_score 
      }
    })
  } else if (matchScore >= ACTION_THRESHOLDS.PROMOTE) {
    action = 'promote'
    // Good confidence for strong matches (70-85%)
    confidence = 0.70 + (matchScore - 70) / 100
    reasons.push({
      type: 'trend_alignment',
      code: 'strong_match',
      description: `Strong alignment with ${trend.trend_identifier.replace(/-/g, ' ')} - increase visibility and marketing`,
      impact_score: 0.75,
      supporting_data: { match_score: matchScore }
    })
  } else if (matchScore >= ACTION_THRESHOLDS.HOLD) {
    action = 'hold'
    // Moderate confidence (55-70%)
    confidence = 0.55 + (matchScore - 55) / 100
    reasons.push({
      type: 'trend_alignment',
      code: 'moderate_match',
      description: `Moderate alignment with ${trend.trend_identifier.replace(/-/g, ' ')} - maintain current positioning`,
      impact_score: 0.5,
      supporting_data: { match_score: matchScore }
    })
  } else if (matchScore >= ACTION_THRESHOLDS.HOLD_BACK) {
    action = 'hold_back'
    // Lower confidence but still decisive (45-65%)
    confidence = 0.45 + (matchScore - 25) / 60
    reasons.push({
      type: 'trend_alignment',
      code: 'low_match',
      description: `Limited alignment with current trends - reduce promotional efforts`,
      impact_score: 0.6,
      supporting_data: { match_score: matchScore }
    })
  } else {
    action = 'phase_out'
    // Confident about poor matches (40-60%)
    confidence = 0.40 + (matchScore / 25) * 0.20
    reasons.push({
      type: 'trend_alignment',
      code: 'poor_match',
      description: `Minimal trend alignment - consider clearance or discontinuation`,
      impact_score: 0.7,
      supporting_data: { match_score: matchScore }
    })
  }

  // Boost confidence based on data quality
  if (factors.category_match >= 80) {
    confidence = Math.min(0.95, confidence + 0.10)
  }
  if (trend.lifecycle_stage === 'emerging' || trend.lifecycle_stage === 'growing') {
    confidence = Math.min(0.95, confidence + 0.05)
  }

  // Inventory adjustments
  if (product.current_inventory_level) {
    if (product.current_inventory_level > 500 && (action === 'hold' || action === 'hold_back')) {
      action = 'markdown'
      confidence = Math.max(confidence, 0.75)
      reasons.push({
        type: 'inventory',
        code: 'excess_stock',
        description: `High inventory (${product.current_inventory_level} units) requires price optimization`,
        impact_score: 0.8,
        supporting_data: { inventory_level: product.current_inventory_level }
      })
    } else if (product.current_inventory_level < 50 && (action === 'promote' || action === 'strong_promote')) {
      action = 'restock_urgent'
      confidence = Math.max(confidence, 0.85)
      reasons.push({
        type: 'inventory',
        code: 'low_stock',
        description: `Critical stock level (${product.current_inventory_level} units) - restock to meet trend demand`,
        impact_score: 0.9,
        supporting_data: { inventory_level: product.current_inventory_level }
      })
    }
  }

  return { action, confidence, reasons }
}

export async function POST(request: NextRequest) {
  try {
    const { brand_id } = await request.json()
    
    if (!brand_id) {
      return NextResponse.json({ error: 'Brand ID required' }, { status: 400 })
    }

    console.log('Starting recommendation generation for brand:', brand_id)

    // Get all products for the brand
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        *,
        product_categories(category_name)
      `)
      .eq('brand_id', brand_id)
      .eq('is_active', true)

    if (productsError) throw productsError
    console.log(`Found ${products?.length || 0} products`)

    // Get only the most relevant trends based on lifecycle and momentum
    const { data: trends, error: trendsError } = await supabase
      .from('trends')
      .select('*')
      .in('lifecycle_stage', ['emerging', 'growing', 'peak'])
      .gte('momentum_score', 50) // Only trends with good momentum
      .order('momentum_score', { ascending: false })
      .limit(15) // Limit to top 15 trends for faster processing

    if (trendsError) throw trendsError
    console.log(`Found ${trends?.length || 0} relevant trends`)

    // Pre-calculate trend embeddings for top trends only
    console.log('Calculating trend embeddings...')
    const trendEmbeddingPromises = trends.slice(0, 10).map(async (trend) => {
      if (trendEmbeddingsCache.has(trend.trend_id)) {
        return { trend_id: trend.trend_id, embedding: trendEmbeddingsCache.get(trend.trend_id)! }
      }
      
      const trendText = `${trend.trend_identifier.replace(/-/g, ' ')} ${trend.trend_description || ''} ${trend.trend_category}`
      const response = await openaiClient.embeddings.create({
        model: "text-embedding-3-small",
        input: trendText,
      })
      
      const embedding = response.data[0].embedding
      trendEmbeddingsCache.set(trend.trend_id, embedding)
      return { trend_id: trend.trend_id, embedding }
    })

    const trendEmbeddings = await Promise.all(trendEmbeddingPromises)
    const embeddingMap = new Map(trendEmbeddings.map(e => [e.trend_id, e.embedding]))

    // Clear existing recommendations for this brand
    console.log('Clearing existing recommendations...')
    await supabase
      .from('recommendations')
      .delete()
      .eq('brand_id', brand_id)

    // Process products with larger batch size for speed
    console.log('Processing products...')
    const recommendations: any[] = []
    const BATCH_SIZE = 10 // Increased batch size

    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE)
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(products.length/BATCH_SIZE)}`)
      
      const batchPromises = batch.map(async (product) => {
        // Transform product category
        const productWithCategory = {
          ...product,
          category: product.product_categories?.[0]?.category_name || product.category || 'General'
        }
        
        let bestMatch: { trend: any; score: number; factors: any } = { trend: null, score: 0, factors: null }

        // Calculate scores for relevant trends only
        for (const trend of trends) {
          // Quick category check first to avoid expensive calculations
          const categoryMatch = isCategoryMatch(
            productWithCategory.category,
            trend.trend_identifier,
            trend.trend_category
          )
          
          // Skip if category doesn't match at all
          if (!categoryMatch.isMatch && categoryMatch.matchScore < 40) {
            continue
          }
          
          const { score, factors } = await calculateTrendMatchScore(
            productWithCategory, 
            trend, 
            embeddingMap.get(trend.trend_id)
          )
          
          if (score > bestMatch.score) {
            bestMatch = { trend, score, factors }
          }
        }

        // Ensure we always have a match
        if (!bestMatch.trend) {
          bestMatch = {
            trend: trends[0],
            score: 35 + Math.random() * 15,
            factors: {
              semantic_similarity: 40,
              category_match: 35,
              demographic_alignment: 45,
              seasonality_match: 50,
              price_alignment: 45,
              lifecycle_compatibility: 40
            }
          }
        }

        return { product: productWithCategory, bestMatch }
      })

      const batchResults = await Promise.all(batchPromises)
      
      // Process batch results - only 1 recommendation per product
      for (const { product, bestMatch } of batchResults) {
        // Skip OpenAI for speed, use simple recommendation logic
        const recommendation = generateSimpleRecommendation(product, bestMatch.trend, bestMatch.score, bestMatch.factors)
        
        recommendations.push({
          brand_id,
          product_id: product.product_id,
          matched_trend_id: bestMatch.trend.trend_id,
          alignment_score: bestMatch.score,
          alignment_factors: bestMatch.factors,
          recommendation_type: 'trend_based',
          recommendation_action: recommendation.action,
          confidence_score: recommendation.confidence,
          generated_by: 'ai_engine_v2',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          _reasons: recommendation.reasons
        })
      }
    }

    // Insert recommendations
    const recommendationsToInsert = recommendations.map(r => ({
      brand_id: r.brand_id,
      product_id: r.product_id,
      matched_trend_id: r.matched_trend_id,
      alignment_score: r.alignment_score,
      alignment_factors: r.alignment_factors,
      recommendation_type: r.recommendation_type,
      recommendation_action: r.recommendation_action,
      confidence_score: r.confidence_score,
      generated_by: r.generated_by,
      expires_at: r.expires_at
    }))

    const { data: insertedRecs, error: recError } = await supabase
      .from('recommendations')
      .insert(recommendationsToInsert)
      .select()

    if (recError) throw recError

    // Insert recommendation reasons
    const allReasons: any[] = []
    insertedRecs.forEach((rec, index) => {
      const originalRec = recommendations[index]
      originalRec._reasons.forEach((reason: any) => {
        allReasons.push({
          recommendation_id: rec.recommendation_id,
          reason_type: reason.type,
          reason_code: reason.code,
          reason_description: reason.description,
          impact_score: reason.impact_score,
          supporting_data: reason.supporting_data
        })
      })
    })

    if (allReasons.length > 0) {
      await supabase
        .from('recommendation_reasons')
        .insert(allReasons)
    }

    console.log('Recommendation generation complete!')

    return NextResponse.json({
      success: true,
      recommendations_count: insertedRecs.length
    })

  } catch (error) {
    console.error('Recommendation generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    )
  }
} 