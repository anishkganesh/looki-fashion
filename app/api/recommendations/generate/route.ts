import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import openaiClient from '@/lib/openai'
import { AI_CONFIG, getAIConfig } from '@/lib/ai-config'
import { extractFromProductHierarchy } from '@/lib/clothing-categories'

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

// Detect product category from name and attributes
function detectProductCategory(product: any): ProductCategory {
  const name = (product.product_name || '').toLowerCase()
  const category = (product.category_hierarchy || '').toLowerCase()
  const subcategory = (product.subcategory || '').toLowerCase()
  
  // Footwear categories
  if (name.includes('shoe') || name.includes('sneaker') || name.includes('boot') || 
      name.includes('sandal') || name.includes('pump') || name.includes('heel') ||
      name.includes('loafer') || name.includes('slipper') || name.includes('flat') ||
      category.includes('footwear') || category.includes('shoe')) {
    return {
      main: 'footwear',
      confidence: 0.9,
      keywords: ['shoe', 'footwear', 'heel', 'boot', 'sandal', 'sneaker', 'pump', 'loafer']
    }
  }
  
  // Accessories
  if (name.includes('bag') || name.includes('belt') || name.includes('scarf') ||
      name.includes('jewelry') || name.includes('accessory') || name.includes('hat') ||
      name.includes('wallet') || name.includes('watch') || category.includes('accessor')) {
    return {
      main: 'accessories', 
      confidence: 0.9,
      keywords: ['bag', 'belt', 'accessory', 'jewelry', 'scarf', 'hat', 'wallet']
    }
  }
  
  // Dresses and skirts
  if (name.includes('dress') || name.includes('skirt') || name.includes('gown')) {
    return {
      main: 'dresses',
      confidence: 0.9,
      keywords: ['dress', 'skirt', 'gown', 'maxi', 'mini', 'midi']
    }
  }
  
  // Outerwear
  if (name.includes('jacket') || name.includes('coat') || name.includes('parka') ||
      name.includes('blazer') || name.includes('cardigan') || name.includes('sweater')) {
    return {
      main: 'outerwear',
      confidence: 0.85,
      keywords: ['jacket', 'coat', 'outerwear', 'blazer', 'cardigan', 'sweater']
    }
  }
  
  // Bottoms
  if (name.includes('jean') || name.includes('pant') || name.includes('trouser') ||
      name.includes('short') || name.includes('legging')) {
    return {
      main: 'bottoms',
      confidence: 0.85,
      keywords: ['jean', 'pant', 'trouser', 'bottom', 'short', 'legging']
    }
  }
  
  // Tops
  if (name.includes('shirt') || name.includes('blouse') || name.includes('top') ||
      name.includes('tee') || name.includes('tank') || name.includes('cami')) {
    return {
      main: 'tops',
      confidence: 0.85,
      keywords: ['shirt', 'top', 'blouse', 'tee', 'tank']
    }
  }
  
  // Default to general apparel
  return {
    main: 'apparel',
    confidence: 0.6,
    keywords: ['clothing', 'apparel', 'fashion']
  }
}

// Detect trend category from name and description
function detectTrendCategory(trend: any): TrendCategory {
  const name = (trend.trend_identifier || '').toLowerCase()
  const desc = (trend.trend_description || '').toLowerCase()
  const category = (trend.trend_category || '').toLowerCase()
  
  // Activewear/Athletic trends - VERY STRICT
  if (name.includes('activewear') || name.includes('athletic') || name.includes('sport') ||
      name.includes('gym') || name.includes('yoga') || name.includes('running') ||
      name.includes('workout') || name.includes('fitness') ||
      desc.includes('activewear') || desc.includes('athletic') || desc.includes('workout') ||
      desc.includes('gym') || desc.includes('fitness') || desc.includes('sportswear')) {
    return {
      main: 'activewear',
      applicableTo: [] // Empty array means it won't match with ANY regular products
    }
  }
  
  // Men's fashion trends
  if (desc.includes("men's fashion") || desc.includes("menswear") || 
      name.includes('sherwani') || name.includes('mens') || desc.includes('for men')) {
    return {
      main: 'menswear',
      applicableTo: [] // Don't apply to women's products
    }
  }
  
  // Footwear-specific trends
  if (category === 'footwear' || name.includes('shoe') || name.includes('boot') ||
      name.includes('sandal') || name.includes('sneaker') || name.includes('heel')) {
    return {
      main: 'footwear',
      applicableTo: ['footwear']
    }
  }
  
  // Denim/Jeans specific trends
  if (name.includes('jean') || name.includes('denim') || desc.includes('denim')) {
    return {
      main: 'denim',
      applicableTo: ['bottoms', 'outerwear'] // Only jeans and denim jackets
    }
  }
  
  // Dress-specific trends
  if (name.includes('dress') || name.includes('gown') || name.includes('skirt')) {
    return {
      main: 'dresses',
      applicableTo: ['dresses']
    }
  }
  
  // Accessory trends
  if (category === 'accessories' || name.includes('bag') || name.includes('jewelry') ||
      name.includes('belt') || name.includes('accessory')) {
    return {
      main: 'accessories',
      applicableTo: ['accessories']
    }
  }
  
  // Color trends can apply to many categories
  if (category === 'color' || name.includes('color') || name.includes('shade')) {
    return {
      main: 'color',
      applicableTo: ['apparel', 'footwear', 'accessories', 'dresses', 'tops', 'bottoms', 'outerwear']
    }
  }
  
  // Material/Texture trends
  if (category === 'material' || category === 'texture' || name.includes('fabric')) {
    return {
      main: 'material',
      applicableTo: ['apparel', 'footwear', 'accessories', 'dresses', 'tops', 'bottoms', 'outerwear']
    }
  }
  
  // Pattern trends
  if (category === 'pattern' || category === 'print' || name.includes('print') || name.includes('pattern')) {
    return {
      main: 'pattern',
      applicableTo: ['apparel', 'dresses', 'tops', 'bottoms', 'accessories']
    }
  }
  
  // General style trends
  if (category === 'style' || category === 'aesthetic' || category === 'silhouette') {
    return {
      main: 'style',
      applicableTo: ['apparel', 'dresses', 'tops', 'bottoms', 'outerwear']
    }
  }
  
  // Default to general fashion
  return {
    main: 'general',
    applicableTo: ['apparel', 'dresses', 'tops', 'bottoms', 'outerwear']
  }
}

// Enhanced compatibility check with better logic
function areCompatible(productCategory: ProductCategory, trendCategory: TrendCategory, product: any, trend: any): boolean {
  // Basic category compatibility
  if (!trendCategory.applicableTo.includes(productCategory.main) && 
      !trendCategory.applicableTo.includes('all')) {
    return false
  }
  
  const productName = (product.product_name || '').toLowerCase()
  const trendName = (trend.trend_identifier || '').toLowerCase()
  const trendDesc = (trend.trend_description || '').toLowerCase()
  
  // Define incompatible combinations with more specific rules
  const styleIncompatibilities = [
    // Vegan leather accessories should pair with jeans/denim
    {
      productKeywords: ['jean', 'denim', 'jeans'],
      trendKeywords: ['vegan leather', 'leather accessory', 'leather bag'],
      incompatible: true
    },
    // Athletic wear should not match with formal trends
    {
      productKeywords: ['athletic', 'sport', 'gym', 'yoga', 'running'],
      trendKeywords: ['formal', 'elegant', 'cocktail', 'gala', 'luxury'],
      incompatible: true
    },
    // Formal wear should not match with athletic/casual trends
    {
      productKeywords: ['dress', 'gown', 'suit', 'blazer', 'formal'],
      trendKeywords: ['athletic', 'sporty', 'streetwear', 'gym'],
      incompatible: true
    },
    // Winter items should not match with summer trends
    {
      productKeywords: ['coat', 'parka', 'wool', 'fleece', 'thermal', 'sweater'],
      trendKeywords: ['beach', 'swim', 'tropical', 'sandal', 'summer'],
      incompatible: true
    },
    // Summer items should not match with winter trends
    {
      productKeywords: ['swim', 'bikini', 'shorts', 'tank', 'sandal'],
      trendKeywords: ['winter', 'coat', 'wool', 'fleece', 'boots'],
      incompatible: true
    },
    // Footwear should not match with non-footwear accessories
    {
      productKeywords: ['shoe', 'boot', 'sandal', 'sneaker', 'heel'],
      trendKeywords: ['bag', 'jewelry', 'scarf', 'belt', 'hat'],
      incompatible: true
    },
    // Accessories should not match with clothing-specific trends
    {
      productKeywords: ['bag', 'jewelry', 'accessory', 'belt', 'scarf'],
      trendKeywords: ['bootcut', 'skinny', 'wide-leg', 'cropped', 'oversized'],
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
  
  // Special rules for specific categories
  
  // If trend is specifically about jeans/denim, product should be jeans or tops
  if (trendName.includes('jean') || trendName.includes('denim') || trendDesc.includes('jean')) {
    const validForJeansTrend = ['jean', 'denim', 'top', 'shirt', 'blouse', 't-shirt', 'sweater']
    if (!validForJeansTrend.some(v => productName.includes(v))) {
      return false
    }
  }
  
  // If trend is footwear-specific, product must be footwear
  if (trendCategory.main === 'footwear' && productCategory.main !== 'footwear') {
    return false
  }
  
  // If product is footwear, trend should be footwear-compatible
  if (productCategory.main === 'footwear') {
    const footwearCompatibleTrends = ['footwear', 'color', 'material', 'texture', 'style', 'all']
    if (!footwearCompatibleTrends.includes(trendCategory.main)) {
      // Check if trend explicitly mentions footwear
      if (!trendName.includes('shoe') && !trendName.includes('boot') && 
          !trendName.includes('sandal') && !trendName.includes('sneaker') &&
          !trendName.includes('heel') && !trendName.includes('footwear')) {
        return false
      }
    }
  }
  
  // If product is an accessory, it should match with accessory or general trends only
  if (productCategory.main === 'accessories') {
    const accessoryCompatibleTrends = ['accessories', 'color', 'material', 'style', 'all']
    if (!accessoryCompatibleTrends.includes(trendCategory.main)) {
      // Accessories should not match with clothing-specific trends
      const clothingSpecificKeywords = ['jean', 'dress', 'skirt', 'pant', 'shirt', 'top', 'bottom']
      if (clothingSpecificKeywords.some(k => trendName.includes(k))) {
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

// Calculate overall match score between product and trend
function calculateMatchScore(product: any, trend: any, productCategory: ProductCategory, trendCategory: TrendCategory): any {
  // Category match weight: 35%
  const categoryMatch = trendCategory.applicableTo.includes(productCategory.main) || 
                       trendCategory.applicableTo.includes('all') ? 100 : 0
  
  // Calculate individual scores
  const semanticSimilarity = calculateSemanticSimilarity(product, trend)
  const styleMatch = calculateStyleMatch(product, trend)
  const demographicAlignment = calculateDemographicMatch(product, trend)
  const priceAlignment = calculatePriceAlignment(product, trend)
  const seasonality = calculateSeasonalityMatch(product, trend)
  
  // Add some randomness to create more variation (5-15% variation)
  const randomFactor = 0.85 + Math.random() * 0.3
  
  // Weighted average with more extreme weights to create variation
  const weights = {
    category: 0.45,  // Increased from 0.40
    semantic: 0.15,  // Increased from 0.10
    style: 0.25,     // Increased from 0.20
    demographic: 0.10,
    price: 0.05      // Decreased from 0.10
  }
  
  const overallScore = 
    (categoryMatch * weights.category) +
    (semanticSimilarity * weights.semantic) +
    (styleMatch * weights.style) +
    (demographicAlignment * weights.demographic) +
    (priceAlignment * weights.price)
  
  // Apply random factor and ensure more spread
  const adjustedScore = overallScore * randomFactor
  
  return {
    overall_score: Math.round(adjustedScore),
    category_match: categoryMatch,
    semantic_similarity: semanticSimilarity,
    style_match: styleMatch,
    demographic_alignment: demographicAlignment,
    price_alignment: priceAlignment,
    seasonality: 0,  // Always 0, kept for compatibility
    lifecycle_compatibility: 0  // Always 0, kept for compatibility
  }
}

// Helper function to generate image for a recommendation
async function generateRecommendationImage(product: any, trend: any, action: string): Promise<string | null> {
  try {
    const actionPrompts: Record<string, string> = {
      'strong_promote': 'featured prominently in store display, hero product placement',
      'promote': 'stylish product display, attractive merchandising',
      'hold': 'standard retail display, clean presentation',
      'markdown': 'sale display with attractive pricing, clearance section',
      'restock_urgent': 'popular product flying off shelves, high demand visualization',
      'restock': 'product restocking, inventory replenishment'
    }
    
    const prompt = `Fashion product photography: ${product.product_name}. ${actionPrompts[action] || 'retail display'}. Aligned with ${trend.trend_identifier.replace(/-/g, ' ')} trend. Professional fashion photography, commercial style, no text or price tags.`
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/images/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt,
        brandContext: { style: 'contemporary', price_point: 'premium' }
      })
    })
    
    if (!response.ok) {
      console.error('Failed to generate recommendation image:', await response.text())
      return null
    }
    
    const data = await response.json()
    return data.url || null
  } catch (error) {
    console.error('Error generating recommendation image:', error)
    return null
  }
}

// Main matching algorithm - IMPROVED VERSION
async function findBestProductTrendPairs(
  products: any[], 
  trends: any[], 
  maxPairsPerProduct: number = 4,  // Increased to 4 to get more variety
  minQualityThreshold: number = 25  // Lowered from 50 to 25 to be more lenient
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
  
  console.log(`Starting pairing process: ${products.length} products x ${trends.length} trends`)
  console.log(`Quality threshold: ${minQualityThreshold}%`)
  
  // Track trends that have been paired
  const trendPairCount = new Map<string, number>()
  
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
      
      // Skip if categories are incompatible
      if (!areCompatible(productCategory, trendCategory, product, trend)) {
        continue
      }
      
      // Check clothing article compatibility
      const productArticles = product.clothing_articles || extractFromProductHierarchy(product.category_hierarchy || '')
      const trendArticles = trend.clothing_articles || []
      
      // Skip if no clothing article match (strict matching)
      if (productArticles.length > 0 && trendArticles.length > 0) {
        const hasMatch = productArticles.some((pa: string) => 
          trendArticles.includes(pa)
        )
        if (!hasMatch) {
          continue
        }
      }
      
      // Calculate match score
      const matchFactors = calculateMatchScore(product, trend, productCategory, trendCategory)
      const matchScore = matchFactors.overall_score
      
      // Only include if above quality threshold
      if (matchScore >= minQualityThreshold) {
        productPairs.push({
          trend,
          matchScore,
          matchFactors
        })
      }
    }
    
    // Sort by match score and take a diverse range
    productPairs.sort((a, b) => b.matchScore - a.matchScore)
    
    // Take top pairs but also ensure we get some lower scoring ones
    const topPairs: any[] = []
    
    // Always include at least one high scorer if available
    if (productPairs.length > 0) {
      topPairs.push(productPairs[0])
    }
    
    // Include one from 25th percentile (good but not great)
    if (productPairs.length > 4) {
      const index25 = Math.floor(productPairs.length * 0.25)
      topPairs.push(productPairs[index25])
    }
    
    // Include one from 50th percentile (moderate)
    if (productPairs.length > 2) {
      const index50 = Math.floor(productPairs.length * 0.5)
      topPairs.push(productPairs[index50])
    }
    
    // Include one from 75th percentile (poor match) - this ensures markdown items
    if (productPairs.length > 3) {
      const index75 = Math.floor(productPairs.length * 0.75)
      topPairs.push(productPairs[index75])
    }
    
    // If we still need more, fill with next best available
    let i = 1
    while (topPairs.length < maxPairsPerProduct && i < productPairs.length) {
      if (!topPairs.some(p => p.trend.trend_id === productPairs[i].trend.trend_id)) {
        topPairs.push(productPairs[i])
      }
      i++
    }
    
    // Add to overall pairs
    for (const pair of topPairs) {
      pairs.push({
        product,
        trend: pair.trend,
        matchScore: pair.matchScore,
        matchFactors: pair.matchFactors
      })
      
      // Track trend usage
      const count = trendPairCount.get(pair.trend.trend_id) || 0
      trendPairCount.set(pair.trend.trend_id, count + 1)
    }
  }
  
  // Ensure every trend has at least one product match
  for (const trend of trends) {
    const pairCount = trendPairCount.get(trend.trend_id) || 0
    if (pairCount === 0) {
      // Find the best matching product for this trend
      let bestMatch = null
      let bestScore = 0
      
      for (const product of products.slice(0, 10)) { // Check first 10 products
        const productCategory = detectProductCategory(product)
        const trendCategory = detectTrendCategory(trend)
        
        if (areCompatible(productCategory, trendCategory, product, trend)) {
          const matchFactors = calculateMatchScore(product, trend, productCategory, trendCategory)
          if (matchFactors.overall_score > bestScore) {
            bestScore = matchFactors.overall_score
            bestMatch = {
              product,
              trend,
              matchScore: matchFactors.overall_score,
              matchFactors
            }
          }
        }
      }
      
      // Add the best match even if below threshold
      if (bestMatch && bestMatch.matchScore >= 15) { // Very lenient threshold for orphan trends
        pairs.push(bestMatch)
      }
    }
  }
  
  console.log(`Generated ${pairs.length} pairs (above ${minQualityThreshold}% threshold)`)
  console.log(`Trends with matches: ${trendPairCount.size}/${trends.length}`)
  
  return pairs
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
  // Determine action based on match score and inventory
  let baseAction = 'monitor'
  if (matchScore >= 75) {
    baseAction = 'strong_promote'
  } else if (matchScore >= 65) {
    baseAction = 'promote'
  } else if (matchScore >= 55) {
    baseAction = 'monitor'
  } else if (matchScore >= 45) {
    baseAction = 'reduce'
  } else {
    baseAction = 'markdown'
  }
  
  // Adjust based on inventory levels
  const inventoryLevel = product.current_inventory_level || 0
  const daysOfSupply = product.days_of_supply || 0
  
  if (baseAction === 'strong_promote' || baseAction === 'promote') {
    if (inventoryLevel < 50 || daysOfSupply < 14) {
      baseAction = 'restock_urgent'
    }
  } else if (baseAction === 'reduce' || baseAction === 'markdown') {
    if (inventoryLevel > 500 || daysOfSupply > 90) {
      baseAction = 'markdown'
    }
  } else if (baseAction === 'monitor' && inventoryLevel > 300 && daysOfSupply > 60) {
    // Force markdown for high inventory monitor items
    baseAction = 'reduce'
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
- Semantic Similarity: ${Math.round(matchFactors.semantic_similarity || 0)}%
- Style Match: ${Math.round(matchFactors.style_match)}%
- Demographic Match: ${Math.round(matchFactors.demographic_alignment)}%
- Price Alignment: ${Math.round(matchFactors.price_alignment)}%

Base Recommendation: ${baseAction}

Provide 3-4 specific, actionable reasons for this recommendation. Focus on:
1. How well the product aligns with the trend
2. Specific actions to maximize opportunity
3. Inventory/pricing considerations
4. Timeline and urgency

Response must be in JSON format:
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

    const config = getAIConfig('analytical')
    const response = await openaiClient.chat.completions.create({
      model: config.model,
      messages: [
        {
          role: "system",
          content: AI_CONFIG.systemPrompts.inventoryOptimizer
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: config.temperature,
      max_tokens: AI_CONFIG.maxTokens.inventory
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
          reason_description: `Product shows ${matchScore >= 70 ? 'strong' : matchScore >= 55 ? 'moderate' : 'limited'} alignment with ${trend.trend_identifier} trend (${Math.round(matchFactors.semantic_similarity || 0)}% semantic match)`,
          impact_score: matchScore / 100,
          supporting_data: { 
            match_score: matchScore, 
            trend_stage: trend.lifecycle_stage,
            semantic_similarity: Math.round(matchFactors.semantic_similarity || 0)
          }
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

    // Fetch a mix of products - focus on best performers and problem products
    const { data: topProducts, error: topError } = await supabase
      .from('products')
      .select('*')
      .eq('brand_id', brand_id)
      .eq('is_active', true)
      .order('revenue_last_30d', { ascending: false })
      .limit(15) // Reduced from 30 to focus on top performers

    const { data: bottomProducts, error: bottomError } = await supabase
      .from('products')
      .select('*')
      .eq('brand_id', brand_id)
      .eq('is_active', true)
      .or('current_inventory_level.gt.300,days_of_supply.gt.60') // Focus on overstocked items
      .order('revenue_last_30d', { ascending: true })
      .limit(10) // Reduced from 20

    if (topError || bottomError) {
      console.error('Error fetching products:', topError || bottomError)
      return NextResponse.json({ 
        error: 'Failed to fetch products',
        message: (topError || bottomError)?.message,
        type: 'database_error'
      }, { status: 500 })
    }
    
    // Combine and deduplicate products
    const productMap = new Map()
    ;[...(topProducts || []), ...(bottomProducts || [])].forEach(p => {
      productMap.set(p.product_id, p)
    })
    const products = Array.from(productMap.values())
    
    if (!products || products.length === 0) {
      console.log('No products found for brand:', brand_id)
      return NextResponse.json({ 
        error: 'No products found for this brand',
        recommendations_count: 0,
        message: 'Please add products before generating recommendations'
      }, { status: 200 })
    }
    
    console.log(`Found ${products.length} products (top performers and problem inventory)`)

    // Fetch only the most relevant trends
    const { data: trends, error: trendsError } = await supabase
      .from('trends')
      .select('*')
      .in('lifecycle_stage', ['emerging', 'growing', 'peak'])
      .gte('momentum_score', 40) // Increased from 15 to 40 for higher quality
      .order('momentum_score', { ascending: false })
      .limit(50) // Reduced from 150 to focus on best trends

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
    
    console.log(`Found ${trends.length} high-quality trends`)

    // Transform products to include category names
    const enrichedProducts = products.map(product => ({
      ...product,
      category: product.category_hierarchy || product.category || 'General'
    }))

    // Find best product-trend pairs with higher quality threshold
    console.log('Finding best product-trend matches...')
    const rawPairs = await findBestProductTrendPairs(
      enrichedProducts, 
      trends, 
      3, // Increased from 2 to 3 pairs per product for more variety
      25 // Lowered from 50 to 25 minimum quality threshold for more lenient matching
    )
    
    // Sort by match score and take only the best
    const sortedPairs = rawPairs.sort((a, b) => b.matchScore - a.matchScore)
    const maxRecommendations = 30 // Target 30 high-quality recommendations
    const pairs = sortedPairs.slice(0, maxRecommendations)
    
    console.log(`Generated ${pairs.length} high-quality product-trend pairs`)
    
    if (pairs.length === 0) {
      return NextResponse.json({ 
        error: 'No high-quality matches found',
        recommendations_count: 0,
        message: 'Unable to find strong product-trend matches. Try adding more products or wait for new trends.'
      }, { status: 200 })
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
      
      const batchPromises = batch.map(async (pair: {
        product: any,
        trend: any,
        matchScore: number,
        matchFactors: any
      }) => {
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
    
    // Image generation removed - now done manually via UI button

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