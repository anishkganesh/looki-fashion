import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import openaiClient from '@/lib/openai'

// Verify imports are working
if (process.env.NODE_ENV === 'development') {
  console.log('API Route loaded - OpenAI client exists:', !!openaiClient)
  console.log('OpenAI API Key exists:', !!process.env.OPENAI_API_KEY)
}

// Check Supabase configuration
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase configuration:', {
    url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  })
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Product categories mapping for accurate matching
const PRODUCT_CATEGORY_HIERARCHY = {
  footwear: {
    keywords: ['shoe', 'sneaker', 'boot', 'sandal', 'heel', 'loafer', 'oxford', 'pump', 'slipper', 'flat', 'wedge', 'espadrille', 'mule'],
    subcategories: ['athletic', 'casual', 'formal', 'sandals', 'boots'],
    incompatible: ['underwear', 'lingerie', 'swimwear', 'socks', 'hosiery']
  },
  tops: {
    keywords: ['shirt', 'blouse', 'top', 't-shirt', 'tee', 'tank', 'cami', 'sweater', 'cardigan', 'hoodie', 'sweatshirt', 'polo', 'tunic'],
    subcategories: ['casual', 'formal', 'athletic', 'knitwear'],
    incompatible: ['shoe', 'footwear', 'underwear', 'bottom']
  },
  bottoms: {
    keywords: ['pant', 'jean', 'trouser', 'short', 'skirt', 'legging', 'jogger', 'chino', 'cargo', 'palazzo', 'culottes'],
    subcategories: ['pants', 'skirts', 'shorts'],
    incompatible: ['shoe', 'footwear', 'underwear', 'top']
  },
  dresses: {
    keywords: ['dress', 'gown', 'romper', 'jumpsuit', 'playsuit'],
    subcategories: ['casual', 'formal', 'cocktail', 'maxi', 'mini', 'midi'],
    incompatible: ['shoe', 'footwear', 'underwear', 'separate']
  },
  outerwear: {
    keywords: ['jacket', 'coat', 'blazer', 'vest', 'parka', 'trench', 'windbreaker', 'bomber', 'denim jacket'],
    subcategories: ['lightweight', 'heavy', 'formal', 'casual'],
    incompatible: ['shoe', 'footwear', 'underwear']
  },
  underwear: {
    keywords: ['underwear', 'bra', 'panty', 'brief', 'boxer', 'lingerie', 'shapewear', 'hosiery', 'sock'],
    subcategories: ['intimates', 'loungewear', 'socks'],
    incompatible: ['shoe', 'footwear', 'outerwear', 'dress', 'formal']
  },
  accessories: {
    keywords: ['bag', 'belt', 'hat', 'scarf', 'jewelry', 'watch', 'sunglasses', 'wallet', 'glove', 'tie', 'bow tie'],
    subcategories: ['bags', 'jewelry', 'small accessories'],
    incompatible: []
  },
  swimwear: {
    keywords: ['swimsuit', 'bikini', 'tankini', 'swim trunk', 'swim short', 'one-piece', 'cover-up'],
    subcategories: ['women', 'men', 'cover-ups'],
    incompatible: ['shoe', 'formal', 'outerwear', 'underwear']
  }
}

// Trend category compatibility matrix
const TREND_CATEGORY_COMPATIBILITY = {
  color: ['all'], // Color trends can apply to all categories
  pattern: ['tops', 'bottoms', 'dresses', 'outerwear', 'accessories', 'swimwear'],
  silhouette: ['tops', 'bottoms', 'dresses', 'outerwear'],
  material: ['all'],
  style: ['all'],
  footwear: ['footwear'], // Footwear-specific trends only apply to shoes
  accessory: ['accessories'],
  print: ['tops', 'bottoms', 'dresses', 'outerwear', 'swimwear'],
  texture: ['all'],
  design: ['all']
}

interface ProductCategory {
  main: string
  confidence: number
  keywords: string[]
}

interface TrendCategory {
  main: string
  applicableTo: string[]
}

// Enhanced category detection for products
function detectProductCategory(product: any): ProductCategory {
  const productName = (product.product_name || '').toLowerCase()
  const category = (product.category || '').toLowerCase()
  const description = (product.description || '').toLowerCase()
  const subcategory = (product.subcategory || '').toLowerCase()
  const fullText = `${productName} ${category} ${description} ${subcategory}`
  
  let bestMatch = { main: 'general', confidence: 0, keywords: [] as string[] }
  
  for (const [categoryKey, categoryData] of Object.entries(PRODUCT_CATEGORY_HIERARCHY)) {
    const matchedKeywords = categoryData.keywords.filter(keyword => 
      fullText.includes(keyword)
    )
    
    // Check for incompatible keywords
    const hasIncompatible = categoryData.incompatible.some(keyword => 
      fullText.includes(keyword)
    )
    
    if (hasIncompatible) continue
    
    const confidence = matchedKeywords.length / categoryData.keywords.length
    
    if (confidence > bestMatch.confidence) {
      bestMatch = {
        main: categoryKey,
        confidence,
        keywords: matchedKeywords
      }
    }
  }
  
  // If confidence is too low, try to infer from product attributes
  if (bestMatch.confidence < 0.1 && product.style_attributes) {
    const styleAttrs = product.style_attributes
    if (styleAttrs.fit && (styleAttrs.fit.includes('shoe') || styleAttrs.fit.includes('boot'))) {
      bestMatch = { main: 'footwear', confidence: 0.8, keywords: ['shoe'] }
    }
  }
  
  return bestMatch
}

// Enhanced trend category detection
function detectTrendCategory(trend: any): TrendCategory {
  const trendName = (trend.trend_identifier || '').toLowerCase()
  const trendCategory = (trend.trend_category || '').toLowerCase()
  const trendDescription = (trend.trend_description || '').toLowerCase()
  
  // First check if it's a specific category trend
  for (const [productCat, catData] of Object.entries(PRODUCT_CATEGORY_HIERARCHY)) {
    if (catData.keywords.some(keyword => trendName.includes(keyword))) {
      return {
        main: productCat,
        applicableTo: [productCat]
      }
    }
  }
  
  // Then check trend category compatibility
  const compatibility = TREND_CATEGORY_COMPATIBILITY[trendCategory as keyof typeof TREND_CATEGORY_COMPATIBILITY]
  if (compatibility) {
    return {
      main: trendCategory,
      applicableTo: compatibility[0] === 'all' ? Object.keys(PRODUCT_CATEGORY_HIERARCHY) : compatibility
    }
  }
  
  // Default to style trend that can apply broadly
  return {
    main: 'style',
    applicableTo: Object.keys(PRODUCT_CATEGORY_HIERARCHY)
  }
}

// Enhanced compatibility checking with style context
function areCompatible(productCategory: ProductCategory, trendCategory: TrendCategory, product: any, trend: any): boolean {
  // First check basic category compatibility
  const basicCompatible = trendCategory.applicableTo.includes(productCategory.main) || 
                         trendCategory.applicableTo.includes('all')
  
  if (!basicCompatible) return false
  
  // Additional style context checks to prevent mismatches
  const productName = (product.product_name || '').toLowerCase()
  const trendName = (trend.trend_identifier || '').toLowerCase()
  const trendDesc = (trend.trend_description || '').toLowerCase()
  
  // Define style incompatibilities
  const styleIncompatibilities = [
    // Activewear should not match with formal footwear
    {
      productKeywords: ['activewear', 'athletic', 'sport', 'gym', 'yoga', 'running'],
      trendKeywords: ['heel', 'pump', 'oxford', 'formal shoe', 'dress shoe', 'stiletto'],
      incompatible: true
    },
    // Formal wear should not match with athletic trends
    {
      productKeywords: ['formal', 'dress shoe', 'heel', 'pump', 'oxford', 'evening'],
      trendKeywords: ['athletic', 'sport', 'gym', 'running', 'yoga', 'activewear'],
      incompatible: true
    },
    // Swimwear should not match with non-beach footwear
    {
      productKeywords: ['swimsuit', 'bikini', 'swim'],
      trendKeywords: ['boot', 'heel', 'pump', 'oxford', 'loafer'],
      incompatible: true
    },
    // Winter items should not match with summer trends
    {
      productKeywords: ['coat', 'parka', 'wool', 'fleece', 'thermal'],
      trendKeywords: ['beach', 'swim', 'tropical', 'sandal'],
      incompatible: true
    }
  ]
  
  // Check each incompatibility rule
  for (const rule of styleIncompatibilities) {
    const hasProductKeyword = rule.productKeywords.some(k => productName.includes(k))
    const hasTrendKeyword = rule.trendKeywords.some(k => trendName.includes(k) || trendDesc.includes(k))
    
    if (hasProductKeyword && hasTrendKeyword && rule.incompatible) {
      return false
    }
  }
  
  // Special case: if trend is footwear-specific, product must be footwear
  if (trendCategory.main === 'footwear' && productCategory.main !== 'footwear') {
    return false
  }
  
  // Special case: if product is footwear, trend should be footwear-compatible
  if (productCategory.main === 'footwear') {
    const footwearCompatibleTrends = ['footwear', 'color', 'material', 'texture', 'style']
    if (!footwearCompatibleTrends.includes(trendCategory.main)) {
      // Check if trend explicitly mentions footwear
      if (!trendName.includes('shoe') && !trendName.includes('boot') && 
          !trendName.includes('sandal') && !trendName.includes('sneaker')) {
        return false
      }
    }
  }
  
  return true
}

// Calculate demographic match score
function calculateDemographicMatch(product: any, trend: any): number {
  let score = 0
  let factors = 0
  
  // Gender match
  if (product.target_demographics?.target_gender && trend.target_gender) {
    factors++
    if (product.target_demographics.target_gender.toLowerCase() === trend.target_gender.toLowerCase() ||
        product.target_demographics.target_gender === 'unisex' || 
        trend.target_gender === 'unisex') {
      score += 1
    }
  }
  
  // Age range match
  if (product.target_demographics?.target_age_min && trend.target_age_min) {
    factors++
    const productMin = product.target_demographics.target_age_min
    const productMax = product.target_demographics.target_age_max || 65
    const trendMin = trend.target_age_min
    const trendMax = trend.target_age_max || 65
    
    // Calculate overlap
    const overlapMin = Math.max(productMin, trendMin)
    const overlapMax = Math.min(productMax, trendMax)
    
    if (overlapMin <= overlapMax) {
      const productRange = productMax - productMin
      const overlap = overlapMax - overlapMin
      score += overlap / productRange
    }
  }
  
  // Income level match
  if (product.target_demographics?.target_income_level && trend.target_income_level) {
    factors++
    const incomeMap: Record<string, number> = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'luxury': 4
    }
    
    const productIncome = incomeMap[product.target_demographics.target_income_level.toLowerCase()] || 2
    const trendIncome = incomeMap[trend.target_income_level.toLowerCase()] || 2
    
    // Allow one level difference
    if (Math.abs(productIncome - trendIncome) <= 1) {
      score += 1 - (Math.abs(productIncome - trendIncome) * 0.5)
    }
  }
  
  // Lifestyle match
  if (product.target_demographics?.target_lifestyle && trend.target_lifestyle) {
    factors++
    const productLifestyles = Array.isArray(product.target_demographics.target_lifestyle) 
      ? product.target_demographics.target_lifestyle 
      : [product.target_demographics.target_lifestyle]
    const trendLifestyles = Array.isArray(trend.target_lifestyle) 
      ? trend.target_lifestyle 
      : [trend.target_lifestyle]
    
    const matches = productLifestyles.filter((lifestyle: string) => 
      trendLifestyles.some((tl: string) => tl.toLowerCase() === lifestyle.toLowerCase())
    )
    
    if (matches.length > 0) {
      score += matches.length / Math.max(productLifestyles.length, trendLifestyles.length)
    }
  }
  
  return factors > 0 ? (score / factors) * 100 : 50 // Default to 50% if no demographic data
}

// Calculate semantic similarity score
function calculateSemanticSimilarity(product: any, trend: any): number {
  const productName = (product.product_name || '').toLowerCase()
  const productDesc = (product.description || '').toLowerCase()
  const productCategory = (product.category_hierarchy || '').toLowerCase()
  const productText = `${productName} ${productDesc} ${productCategory}`
  
  const trendName = (trend.trend_identifier || '').toLowerCase().replace(/-/g, ' ')
  const trendDesc = (trend.trend_description || '').toLowerCase()
  const trendCategory = (trend.trend_category || '').toLowerCase()
  const trendText = `${trendName} ${trendDesc} ${trendCategory}`
  
  // Extract keywords
  const productKeywords = productText.split(/\s+/).filter(w => w.length > 3)
  const trendKeywords = trendText.split(/\s+/).filter(w => w.length > 3)
  
  // Count matching keywords
  let matches = 0
  for (const pk of productKeywords) {
    if (trendKeywords.some(tk => tk.includes(pk) || pk.includes(tk))) {
      matches++
    }
  }
  
  // Calculate similarity score
  const similarity = (matches / Math.max(productKeywords.length, trendKeywords.length)) * 100
  
  // Boost score for exact category matches
  if (productCategory && trendCategory && productCategory.includes(trendCategory)) {
    return Math.min(100, similarity + 20)
  }
  
  return Math.min(100, Math.max(0, similarity))
}

// Calculate price alignment score
function calculatePriceAlignment(product: any, trend: any): number {
  const productPrice = product.current_price || 0
  
  // Define price ranges for different trend categories
  const trendPriceRanges: Record<string, { min: number, max: number }> = {
    'luxury': { min: 200, max: 5000 },
    'premium': { min: 100, max: 300 },
    'contemporary': { min: 50, max: 150 },
    'affordable': { min: 20, max: 80 },
    'budget': { min: 5, max: 30 }
  }
  
  // Determine trend price expectation based on keywords
  let expectedRange = { min: 30, max: 150 } // Default contemporary range
  
  const trendText = `${trend.trend_identifier} ${trend.trend_description || ''}`.toLowerCase()
  
  if (trendText.includes('luxury') || trendText.includes('designer') || trendText.includes('high-end')) {
    expectedRange = trendPriceRanges.luxury
  } else if (trendText.includes('premium') || trendText.includes('quality')) {
    expectedRange = trendPriceRanges.premium
  } else if (trendText.includes('affordable') || trendText.includes('accessible')) {
    expectedRange = trendPriceRanges.affordable
  } else if (trendText.includes('budget') || trendText.includes('value')) {
    expectedRange = trendPriceRanges.budget
  }
  
  // Calculate alignment
  if (productPrice >= expectedRange.min && productPrice <= expectedRange.max) {
    // Perfect alignment
    return 100
  } else if (productPrice < expectedRange.min) {
    // Below range
    const ratio = productPrice / expectedRange.min
    return Math.max(0, ratio * 100)
  } else {
    // Above range
    const ratio = expectedRange.max / productPrice
    return Math.max(0, ratio * 100)
  }
}

// Calculate style match score
function calculateStyleMatch(product: any, trend: any): number {
  let score = 0
  let factors = 0
  
  const trendName = trend.trend_identifier.toLowerCase()
  const trendDesc = (trend.trend_description || '').toLowerCase()
  
  // Check color match
  const productColor = (product.style_attributes?.primary_color || product.color || '').toLowerCase()
  if (productColor) {
    factors += 25
    if (trendName.includes(productColor) || trendDesc.includes(productColor)) {
      score += 25
    } else if (trend.trend_category === 'color') {
      score += 10
    } else {
      score += 15 // Default partial match
    }
  }
  
  // Check pattern match
  const pattern = (product.style_attributes?.pattern || '').toLowerCase()
  if (pattern) {
    factors += 25
    if (trendName.includes(pattern) || trendDesc.includes(pattern)) {
      score += 25
    } else if (trend.trend_category === 'pattern' || trend.trend_category === 'print') {
      score += 10
    } else {
      score += 15
    }
  }
  
  // Check silhouette match
  const silhouette = (product.style_attributes?.silhouette || '').toLowerCase()
  if (silhouette) {
    factors += 25
    if (trendName.includes(silhouette) || trendDesc.includes(silhouette)) {
      score += 25
    } else {
      score += 15
    }
  }
  
  // Check material match
  const material = (product.material_attributes?.primary_material || '').toLowerCase()
  if (material) {
    factors += 25
    if (trendName.includes(material) || trendDesc.includes(material)) {
      score += 25
    } else if (trend.trend_category === 'material' || trend.trend_category === 'texture') {
      score += 10
    } else {
      score += 15
    }
  }
  
  // If no style attributes, return a moderate score
  if (factors === 0) return 50
  
  return (score / factors) * 100
}

// Calculate seasonality match
function calculateSeasonalityMatch(product: any, trend: any): number {
  const currentMonth = new Date().getMonth() + 1
  const currentSeason = currentMonth >= 3 && currentMonth <= 5 ? 'spring' :
                       currentMonth >= 6 && currentMonth <= 8 ? 'summer' :
                       currentMonth >= 9 && currentMonth <= 11 ? 'fall' : 'winter'
  
  const productName = (product.product_name || '').toLowerCase()
  const trendName = (trend.trend_identifier || '').toLowerCase()
  
  let score = 60 // Base score
  
  // Seasonal keywords
  const summerKeywords = ['summer', 'beach', 'sun', 'light', 'breathable', 'sandal', 'swim']
  const winterKeywords = ['winter', 'warm', 'coat', 'boot', 'sweater', 'wool', 'fleece']
  const transitionKeywords = ['spring', 'fall', 'autumn', 'transitional', 'layering']
  
  const isSummerProduct = summerKeywords.some(k => productName.includes(k))
  const isWinterProduct = winterKeywords.some(k => productName.includes(k))
  const isTransitionProduct = transitionKeywords.some(k => productName.includes(k))
  
  const isSummerTrend = summerKeywords.some(k => trendName.includes(k))
  const isWinterTrend = winterKeywords.some(k => trendName.includes(k))
  const isTransitionTrend = transitionKeywords.some(k => trendName.includes(k))
  
  // Perfect seasonal match
  if ((currentSeason === 'summer' && isSummerProduct && isSummerTrend) ||
      (currentSeason === 'winter' && isWinterProduct && isWinterTrend) ||
      ((currentSeason === 'spring' || currentSeason === 'fall') && isTransitionProduct && isTransitionTrend)) {
    score = 95
  }
  // Opposite season penalty
  else if ((currentSeason === 'summer' && (isWinterProduct || isWinterTrend)) ||
           (currentSeason === 'winter' && (isSummerProduct || isSummerTrend))) {
    score = 25
  }
  // Transition seasons are more flexible
  else if (currentSeason === 'spring' || currentSeason === 'fall') {
    score = 75
  }
  
  // Trend momentum adjustment for seasonality
  if (trend.momentum_score > 80) {
    score = Math.min(100, score + 10)
  }
  
  return score
}

// Main matching algorithm
async function findBestProductTrendPairs(
  products: any[], 
  trends: any[], 
  maxPairsPerProduct: number = 3
): Promise<Array<{
  product: any,
  trend: any,
  matchScore: number,
  matchFactors: any
}>> {
  const pairs: Array<{
    product: any,
    trend: any,
    matchScore: number,
    matchFactors: any
  }> = []
  
  // Process each product
  for (const product of products) {
    const productCategory = detectProductCategory(product)
    const productPairs: Array<{
      trend: any,
      matchScore: number,
      matchFactors: any
    }> = []
    
    // Check each trend
    for (const trend of trends) {
      const trendCategory = detectTrendCategory(trend)
      
      // Enhanced compatibility check with style context
      if (!areCompatible(productCategory, trendCategory, product, trend)) {
        continue
      }
      
      // Calculate all match scores (removed semantic similarity)
      const categoryScore = productCategory.confidence * 100
      const demographicScore = calculateDemographicMatch(product, trend)
      const styleScore = calculateStyleMatch(product, trend)
      const seasonalityScore = calculateSeasonalityMatch(product, trend)
      const priceScore = calculatePriceAlignment(product, trend)
      
      // Lifecycle bonus (prefer emerging and growing trends)
      let lifecycleScore = 50
      if (trend.lifecycle_stage === 'emerging') lifecycleScore = 90
      else if (trend.lifecycle_stage === 'growing') lifecycleScore = 80
      else if (trend.lifecycle_stage === 'peak') lifecycleScore = 60
      else if (trend.lifecycle_stage === 'declining') lifecycleScore = 30
      
      // Calculate weighted match score without semantic similarity
      const matchFactors = {
        category_match: categoryScore,
        demographic_alignment: demographicScore,
        style_match: styleScore,
        seasonality: seasonalityScore,
        price_alignment: priceScore,
        lifecycle_bonus: lifecycleScore,
        momentum: trend.momentum_score || 50
      }
      
      // Enhanced weighting that prioritizes category compatibility
      const weights = {
        category_match: 0.35,        // Increased from previous - most important
        style_match: 0.25,           // Second most important
        demographic_alignment: 0.15,
        seasonality: 0.10,
        price_alignment: 0.10,
        lifecycle_bonus: 0.05
      }
      
      // Calculate weighted score
      const weightedScore = 
        (matchFactors.category_match * weights.category_match) +
        (matchFactors.style_match * weights.style_match) +
        (matchFactors.demographic_alignment * weights.demographic_alignment) +
        (matchFactors.seasonality * weights.seasonality) +
        (matchFactors.price_alignment * weights.price_alignment) +
        (matchFactors.lifecycle_bonus * weights.lifecycle_bonus)
      
      // Apply momentum multiplier
      const momentumMultiplier = 1 + (matchFactors.momentum / 200)
      const finalScore = Math.min(100, weightedScore * momentumMultiplier)
      
      // Only consider pairs with minimum category match
      if (matchFactors.category_match < 40) {
        continue
      }
      
      productPairs.push({
        trend,
        matchScore: finalScore,
        matchFactors
      })
    }
    
    // Sort by match score and take top matches
    productPairs.sort((a, b) => b.matchScore - a.matchScore)
    const topPairs = productPairs.slice(0, maxPairsPerProduct)
    
    // Add to final pairs list
    for (const pair of topPairs) {
      pairs.push({
        product,
        trend: pair.trend,
        matchScore: pair.matchScore,
        matchFactors: pair.matchFactors
      })
    }
  }
  
  return pairs
}

// Apply curve grading to ensure good distribution of scores
function applyCurveGrading(pairs: Array<{
  product: any,
  trend: any,
  matchScore: number,
  matchFactors: any
}>): Array<{
  product: any,
  trend: any,
  matchScore: number,
  matchFactors: any
}> {
  if (pairs.length === 0) return pairs
  
  // Sort pairs by raw match score
  const sortedPairs = [...pairs].sort((a, b) => b.matchScore - a.matchScore)
  
  // Calculate percentile boundaries
  const topTier = Math.floor(pairs.length * 0.2) // Top 20%
  const midTier = Math.floor(pairs.length * 0.6) // Next 40% (20-60%)
  
  // Apply curve grading
  return sortedPairs.map((pair, index) => {
    let curvedScore: number
    
    if (index < topTier) {
      // Top 20% get 70-100%
      const position = index / topTier
      curvedScore = 100 - (position * 30) // Linear from 100 to 70
    } else if (index < midTier) {
      // Next 40% get 50-70%
      const position = (index - topTier) / (midTier - topTier)
      curvedScore = 70 - (position * 20) // Linear from 70 to 50
    } else {
      // Bottom 40% get 30-50%
      const position = (index - midTier) / (pairs.length - midTier)
      curvedScore = 50 - (position * 20) // Linear from 50 to 30
    }
    
    return {
      ...pair,
      matchScore: Math.round(curvedScore)
    }
  })
}

// Generate recommendation with GPT-3.5-turbo
async function generateRecommendation(
  product: any,
  trend: any,
  matchScore: number,
  matchFactors: any
): Promise<{
  action: string,
  confidence: number,
  reasons: Array<{
    reason_type: string,
    reason_code: string,
    reason_description: string,
    impact_score: number,
    supporting_data: any
  }>
}> {
  // Quick action determination based on score - adjusted thresholds
  let baseAction = 'hold'
  if (matchScore >= 75) baseAction = 'strong_promote'
  else if (matchScore >= 60) baseAction = 'promote'
  else if (matchScore >= 45) baseAction = 'hold'
  else if (matchScore >= 30) baseAction = 'markdown'
  else baseAction = 'phase_out'
  
  // Inventory adjustment
  if (product.current_inventory_level) {
    if (product.current_inventory_level < 20 && (baseAction === 'promote' || baseAction === 'strong_promote')) {
      baseAction = 'restock_urgent'
    } else if (product.current_inventory_level > 500 && baseAction === 'hold') {
      baseAction = 'markdown'
    }
  }
  
  try {
    const prompt = `As a fashion retail analyst, provide a detailed recommendation for this product-trend match.

Product: ${product.product_name} (${product.category_hierarchy || 'General'})
Current Price: ${product.currency} ${product.current_price}
Inventory: ${product.current_inventory_level || 'Unknown'} units
Stock Status: ${product.stock_status || 'Unknown'}
Days of Supply: ${product.days_of_supply || 'Unknown'}
Velocity: ${product.inventory_velocity || 'Unknown'}/day

Matched Trend: ${trend.trend_identifier} (${trend.trend_category})
Trend Stage: ${trend.lifecycle_stage}
Trend Momentum: ${trend.momentum_score}

Match Analysis:
- Overall Score: ${matchScore}%
- Category Match: ${Math.round(matchFactors.category_match)}%
- Style Match: ${Math.round(matchFactors.style_match)}%
- Demographic Match: ${Math.round(matchFactors.demographic_alignment)}%
- Seasonality: ${Math.round(matchFactors.seasonality)}%

Base Recommendation: ${baseAction}

Provide 3-4 specific, actionable reasons for this recommendation. Focus on:
1. How well the product aligns with the trend
2. Specific actions to maximize opportunity
3. Inventory/pricing considerations
4. Timeline and urgency

Response format:
{
  "action": "${baseAction}",
  "confidence": 0.0-1.0,
  "reasons": [
    {
      "reason_type": "trend_alignment|inventory|pricing|seasonality|market_position",
      "reason_code": "short_code",
      "reason_description": "Detailed actionable explanation",
      "impact_score": 0.0-1.0,
      "supporting_data": {}
    }
  ]
}`

    const response = await openaiClient.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a fashion retail analyst. Provide specific, actionable recommendations based on data. Be concise but insightful."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 600
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI')
    }
    
    return JSON.parse(content)
  } catch (error) {
    console.error('Error with GPT-3.5:', error)
    // Fallback recommendation
    return {
      action: baseAction,
      confidence: Math.min(0.95, 0.5 + (matchScore / 200)),
      reasons: [
        {
          reason_type: 'trend_alignment',
          reason_code: matchScore >= 70 ? 'strong_match' : matchScore >= 55 ? 'moderate_match' : 'weak_match',
          reason_description: `Product shows ${matchScore >= 70 ? 'strong' : matchScore >= 55 ? 'moderate' : 'limited'} alignment with ${trend.trend_identifier} trend`,
          impact_score: matchScore / 100,
          supporting_data: { match_score: matchScore, trend_stage: trend.lifecycle_stage }
        },
        {
          reason_type: 'inventory',
          reason_code: product.current_inventory_level < 50 ? 'low_stock' : product.current_inventory_level > 300 ? 'high_stock' : 'optimal_stock',
          reason_description: `Current inventory of ${product.current_inventory_level || 0} units ${product.current_inventory_level < 50 ? 'requires restocking' : product.current_inventory_level > 300 ? 'may need promotion' : 'is at optimal levels'}`,
          impact_score: 0.7,
          supporting_data: { inventory: product.current_inventory_level, days_supply: product.days_of_supply }
        }
      ]
    }
  }
}

export async function POST(request: NextRequest) {
  console.log('Recommendations generate endpoint called')
  console.log('Environment check - OpenAI key exists:', !!process.env.OPENAI_API_KEY)
  console.log('OpenAI client initialized:', !!openaiClient)
  
  try {
    // Check if OpenAI key exists
    if (!process.env.OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY environment variable')
      return NextResponse.json({ 
        error: 'OpenAI API key not configured',
        message: 'Please set OPENAI_API_KEY in your environment variables',
        type: 'configuration_error' 
      }, { status: 500 })
    }
    
    // Verify OpenAI client is initialized
    if (!openaiClient) {
      console.error('OpenAI client not initialized')
      return NextResponse.json({ 
        error: 'OpenAI client initialization failed',
        message: 'Failed to initialize OpenAI client',
        type: 'initialization_error' 
      }, { status: 500 })
    }
    
    const body = await request.json()
    const { brand_id } = body
    
    if (!brand_id) {
      return NextResponse.json({ error: 'Brand ID required' }, { status: 400 })
    }

    console.log('Starting smart recommendation generation for brand:', brand_id)

    // Fetch products with enriched data
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('brand_id', brand_id)
      .eq('is_active', true)
      .order('revenue_last_30d', { ascending: false })
      .limit(1000) // Process top 1000 products by revenue

    if (productsError) {
      console.error('Error fetching products:', productsError)
      console.error('Detailed error:', {
        message: productsError.message,
        details: productsError.details,
        hint: productsError.hint,
        code: productsError.code
      })
      return NextResponse.json({ 
        error: 'Failed to fetch products',
        message: productsError.message,
        details: productsError.details,
        hint: productsError.hint,
        type: 'database_error'
      }, { status: 500 })
    }
    
    if (!products || products.length === 0) {
      console.log('No products found for brand:', brand_id)
      return NextResponse.json({ 
        error: 'No products found for this brand',
        recommendations_count: 0,
        message: 'Please add products before generating recommendations'
      }, { status: 200 })
    }
    
    console.log(`Found ${products.length} products`)

    // Fetch relevant trends
    const { data: trends, error: trendsError } = await supabase
      .from('trends')
      .select('*')
      .in('lifecycle_stage', ['emerging', 'growing', 'peak'])
      .gte('momentum_score', 30) // Lower threshold for more trends
      .order('momentum_score', { ascending: false })
      .limit(50) // Top 50 trends for better coverage

    if (trendsError) {
      console.error('Error fetching trends:', trendsError)
      return NextResponse.json({ 
        error: 'Failed to fetch trends',
        details: trendsError.message,
        type: 'database_error'
      }, { status: 500 })
    }
    
    if (!trends || trends.length === 0) {
      console.log('No active trends found')
      return NextResponse.json({ 
        error: 'No active trends found',
        recommendations_count: 0,
        message: 'Please wait for trend data to be available'
      }, { status: 200 })
    }
    
    console.log(`Found ${trends.length} relevant trends`)

    // Transform products to include category names
    const enrichedProducts = products.map(product => ({
      ...product,
      category: product.category_hierarchy || product.category || 'General'
    }))

    // Find best product-trend pairs
    console.log('Finding best product-trend matches...')
    const rawPairs = await findBestProductTrendPairs(enrichedProducts, trends, 2)
    
    // Apply curve grading to ensure good score distribution
    const pairs = applyCurveGrading(rawPairs)
    
    console.log(`Generated ${pairs.length} product-trend pairs with curved scores`)
    
    if (pairs.length === 0) {
      console.log('No suitable product-trend matches found')
      return NextResponse.json({
        success: true,
        recommendations_count: 0,
        message: 'No suitable product-trend matches found. This might be due to category mismatches.'
      })
    }

    // Clear existing recommendations
    await supabase
      .from('recommendations')
      .delete()
      .eq('brand_id', brand_id)

    // Process recommendations in batches
    const BATCH_SIZE = 20
    const recommendations: any[] = []
    
    for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
      const batch = pairs.slice(i, i + BATCH_SIZE)
      console.log(`Processing recommendation batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(pairs.length/BATCH_SIZE)}`)
      
      const batchPromises = batch.map(async (pair) => {
        const recommendation = await generateRecommendation(
          pair.product,
          pair.trend,
          pair.matchScore,
          pair.matchFactors
        )
        
        return {
          brand_id,
          product_id: pair.product.product_id,
          matched_trend_id: pair.trend.trend_id,
          alignment_score: pair.matchScore,
          alignment_factors: pair.matchFactors,
          recommendation_type: 'trend_based',
          recommendation_action: recommendation.action,
          confidence_score: recommendation.confidence,
          generated_by: 'smart_ai_v3',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          _reasons: recommendation.reasons
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      recommendations.push(...batchResults)
    }

    // Check if reasons columns exist
    let hasReasonsColumn = true
    let hasRecommendationReasonsColumn = true
    try {
      // Test query to check if reasons column exists
      const { error: testError } = await supabase
        .from('recommendations')
        .select('reasons, recommendation_reasons')
        .limit(0)
      
      if (testError && testError.message.includes('reasons')) {
        hasReasonsColumn = false
        console.warn('Warning: reasons column not found - recommendations will be created without detailed reasons')
        console.warn('Run "npm run migrate:add-reasons" to add the reasons column')
      }
      if (testError && testError.message.includes('recommendation_reasons')) {
        hasRecommendationReasonsColumn = false
      }
    } catch (e) {
      hasReasonsColumn = false
      hasRecommendationReasonsColumn = false
    }

    // Insert recommendations with or without reasons based on column existence
    const recommendationsToInsert = recommendations.map(r => {
      const rec: any = {
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
      }
      
      // Only add reasons if the column exists
      if (hasReasonsColumn && r._reasons) {
        rec.reasons = r._reasons
      }
      
      // Add text-based reasons if column exists
      if (hasRecommendationReasonsColumn && r._reasons) {
        rec.recommendation_reasons = r._reasons
          .map((reason: any) => `• ${reason.reason_description}`)
          .join('\n')
      }
      
      return rec
    })

    const { data: insertedRecs, error: recError } = await supabase
      .from('recommendations')
      .insert(recommendationsToInsert)
      .select()

    if (recError) throw recError

    console.log('Smart recommendation generation complete!')

    return NextResponse.json({
      success: true,
      recommendations_count: insertedRecs.length,
      message: `Generated ${insertedRecs.length} smart recommendations for ${products.length} products`
    })

  } catch (error: any) {
    console.error('Recommendation generation error:', error)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to generate recommendations'
    let errorDetails = {}
    
    if (error.message?.includes('foreign key')) {
      errorMessage = 'Database relationship error - please ensure products and trends exist'
      errorDetails = { type: 'foreign_key_error', details: error.message }
    } else if (error.message?.includes('products')) {
      errorMessage = 'No products found for this brand'
      errorDetails = { type: 'no_products' }
    } else if (error.message?.includes('trends')) {
      errorMessage = 'No active trends found'
      errorDetails = { type: 'no_trends' }
    } else if (error.code === 'PGRST116') {
      errorMessage = 'The recommendations table may not exist - please run the migration script'
      errorDetails = { type: 'table_missing', table: 'recommendations' }
    } else {
      errorDetails = { 
        type: 'unknown_error', 
        message: error.message,
        code: error.code,
        details: error.details || error.detail
      }
    }
    
    return NextResponse.json(
      { error: errorMessage, ...errorDetails },
      { status: 500 }
    )
  }
}