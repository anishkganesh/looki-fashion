import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import openaiClient from '@/lib/openai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Bundle criteria types
type BundleCriteria = {
  category?: boolean
  priceRange?: boolean
  color?: boolean
  style?: boolean
  demographics?: boolean
  seasonality?: boolean
  inventory?: boolean
  performance?: boolean
}

// Function to analyze products for bundling opportunities
async function findBundlingOpportunities(products: any[], trends: any[]) {
  console.log(`Analyzing ${products.length} products for bundling opportunities`)
  
  const bundles: Map<string, {
    criteria: BundleCriteria
    products: any[]
    matchingTrends: any[]
    bundleKey: string
    bundleReasons: string[]
  }> = new Map()

  // Group products by various criteria
  for (const product of products) {
    const bundleKeys: string[] = []
    const individualKeys: string[] = []
    const criteria: BundleCriteria = {}
    const reasons: string[] = []

    // Category-based bundling (more flexible)
    if (product.category || product.category_hierarchy) {
      const category = product.category || product.category_hierarchy || 'general'
      individualKeys.push(`category:${category.toLowerCase()}`)
      criteria.category = true
      reasons.push(`Category: ${category}`)
    }

    // Price range bundling (wider ranges)
    const price = product.current_price || 0
    const priceRange = Math.floor(price / 100) * 100 // $100 ranges instead of $50
    individualKeys.push(`price:${priceRange}-${priceRange + 100}`)
    criteria.priceRange = true
    reasons.push(`Price range: $${priceRange}-${priceRange + 100}`)

    // Color-based bundling (check multiple fields)
    const color = product.attributes?.colors?.[0] || 
                  product.color || 
                  (product.product_name?.toLowerCase().match(/(black|white|red|blue|green|yellow|pink|purple|brown|grey|gray|beige|navy)/)?.[0])
    if (color) {
      individualKeys.push(`color:${color.toLowerCase()}`)
      criteria.color = true
      reasons.push(`Color: ${color}`)
    }

    // Style attributes bundling (extract from name if needed)
    const style = product.attributes?.style || 
                  product.style ||
                  (product.product_name?.toLowerCase().includes('casual') ? 'casual' :
                   product.product_name?.toLowerCase().includes('formal') ? 'formal' :
                   product.product_name?.toLowerCase().includes('sport') ? 'sport' : null)
    if (style) {
      individualKeys.push(`style:${style.toLowerCase()}`)
      criteria.style = true
      reasons.push(`Style: ${style}`)
    }

    // Demographics bundling (use brand defaults if not specified)
    const gender = product.demographics?.gender || product.target_gender || 'unisex'
    individualKeys.push(`gender:${gender.toLowerCase()}`)
    criteria.demographics = true
    reasons.push(`Gender: ${gender}`)

    // Season/occasion bundling
    const season = product.attributes?.season || 
                   (product.product_name?.toLowerCase().match(/(summer|winter|spring|fall|autumn)/)?.[0])
    if (season) {
      individualKeys.push(`season:${season.toLowerCase()}`)
      criteria.seasonality = true
      reasons.push(`Season: ${season}`)
    }

    // Create bundles for individual criteria first
    for (const key of individualKeys) {
      if (!bundles.has(key)) {
        bundles.set(key, {
          criteria: {},
          products: [],
          matchingTrends: [],
          bundleKey: key,
          bundleReasons: []
        })
      }
      const bundle = bundles.get(key)!
      bundle.products.push(product)
      // Update criteria and reasons for this specific bundle
      const [criteriaType] = key.split(':')
      if (criteriaType === 'category') bundle.criteria.category = true
      if (criteriaType === 'price') bundle.criteria.priceRange = true
      if (criteriaType === 'color') bundle.criteria.color = true
      if (criteriaType === 'style') bundle.criteria.style = true
      if (criteriaType === 'gender') bundle.criteria.demographics = true
      if (criteriaType === 'season') bundle.criteria.seasonality = true
    }

    // Also create composite bundles (but make them optional)
    const compositeKeys = [
      // Category + Price
      individualKeys.filter(k => k.startsWith('category') || k.startsWith('price')).slice(0, 2).join('|'),
      // Style + Color
      individualKeys.filter(k => k.startsWith('style') || k.startsWith('color')).slice(0, 2).join('|'),
      // Gender + Category
      individualKeys.filter(k => k.startsWith('gender') || k.startsWith('category')).slice(0, 2).join('|'),
      // Price + Gender
      individualKeys.filter(k => k.startsWith('price') || k.startsWith('gender')).slice(0, 2).join('|')
    ].filter(k => k.includes('|'))

    // Add product to composite bundles
    for (const key of compositeKeys) {
      if (!bundles.has(key)) {
        bundles.set(key, {
          criteria,
          products: [],
          matchingTrends: [],
          bundleKey: key,
          bundleReasons: reasons
        })
      }
      bundles.get(key)!.products.push(product)
    }
  }

  console.log(`Created ${bundles.size} potential bundles`)

  // Match trends to bundles (more lenient matching)
  for (const [key, bundle] of bundles) {
    // Update bundle reasons based on actual products
    if (bundle.products.length > 0) {
      const keyParts = key.split('|')
      bundle.bundleReasons = keyParts.map(part => {
        const [type, value] = part.split(':')
        return `${type}: ${value}`
      })
    }

    for (const trend of trends) {
      let relevanceScore = 0
      const factors: string[] = []

      // Extract keywords from trend
      const trendKeywords = [
        trend.trend_identifier,
        trend.trend_category,
        trend.trend_description,
        ...(trend.hashtags || [])
      ].filter(Boolean).join(' ').toLowerCase()

      // Check category match (more flexible)
      if (key.includes('category:')) {
        const category = key.match(/category:([^|]+)/)?.[1]
        if (category && (trendKeywords.includes(category) || category.includes('general'))) {
          relevanceScore += 0.3
          factors.push('Category alignment')
        }
      }

      // Check style match
      if (key.includes('style:')) {
        const style = key.match(/style:([^|]+)/)?.[1]
        if (style && trendKeywords.includes(style)) {
          relevanceScore += 0.3
          factors.push('Style match')
        }
      }

      // Check color match
      if (key.includes('color:')) {
        const color = key.match(/color:([^|]+)/)?.[1]
        if (color && trendKeywords.includes(color)) {
          relevanceScore += 0.2
          factors.push('Color trend')
        }
      }

      // Check demographic match
      if (key.includes('gender:')) {
        const gender = key.match(/gender:([^|]+)/)?.[1]
        const trendGender = trend.target_gender?.toLowerCase() || 'unisex'
        if (gender === trendGender || gender === 'unisex' || trendGender === 'unisex') {
          relevanceScore += 0.2
          factors.push('Demographic match')
        }
      }

      // Boost for trending lifecycle stages
      if (trend.lifecycle_stage === 'emerging' || trend.lifecycle_stage === 'growing') {
        relevanceScore += 0.2
        factors.push(`${trend.lifecycle_stage} trend`)
      } else if (trend.lifecycle_stage === 'peak') {
        relevanceScore += 0.1
        factors.push('Peak trend')
      }

      // Add some relevance for any trend (to ensure we get matches)
      if (relevanceScore === 0 && trend.momentum_score > 50) {
        relevanceScore = 0.3
        factors.push('High momentum trend')
      }

      if (relevanceScore >= 0.2) { // Lower threshold
        bundle.matchingTrends.push({
          ...trend,
          relevanceScore,
          linkFactors: factors
        })
      }
    }
  }

  // Filter bundles with at least 2 products (reduced from 3)
  const validBundles = Array.from(bundles.values())
    .filter(bundle => bundle.products.length >= 2)
    .map(bundle => ({
      ...bundle,
      // If no trends matched, add top trends as generic matches
      matchingTrends: bundle.matchingTrends.length > 0 
        ? bundle.matchingTrends 
        : trends.slice(0, 3).map(t => ({
            ...t,
            relevanceScore: 0.3,
            linkFactors: ['General trend opportunity']
          }))
    }))
    .sort((a, b) => {
      // Sort by combination of product count and trend relevance
      const scoreA = a.products.length + (a.matchingTrends[0]?.relevanceScore || 0) * 10
      const scoreB = b.products.length + (b.matchingTrends[0]?.relevanceScore || 0) * 10
      return scoreB - scoreA
    })

  console.log(`Found ${validBundles.length} valid bundles after filtering`)
  
  return validBundles.slice(0, 15) // Return more opportunities
}

// Generate campaign using AI
async function generateCampaignContent(bundle: any, brandInfo: any) {
  const productList = bundle.products.slice(0, 10).map((p: any) => 
    `- ${p.product_name} ($${p.current_price})`
  ).join('\n')

  const trendList = bundle.matchingTrends.slice(0, 5).map((t: any) =>
    `- ${t.trend_identifier} (${t.lifecycle_stage}, relevance: ${Math.round(t.relevanceScore * 100)}%)`
  ).join('\n')

  const prompt = `Create a marketing campaign for a fashion brand with these products and trends.

Brand: ${brandInfo.brand_name} (${brandInfo.category})
Target: ${brandInfo.target_gender || 'all'} aged ${brandInfo.target_age_min || 18}-${brandInfo.target_age_max || 65}
Income Level: ${brandInfo.target_income_level || 'medium'}

Bundle Criteria: ${bundle.bundleReasons.join(', ')}

Products (${bundle.products.length} total):
${productList}

Matching Trends:
${trendList}

Generate a comprehensive campaign with:
1. Campaign name (catchy, relevant to products and trends)
2. Campaign description (2-3 sentences)
3. Target audience description (specific demographics and psychographics)
4. Budget recommendation with reasoning
5. Marketing copy (3-4 sentences for social media)
6. Hashtags (5-8 relevant ones)
7. Content suggestions (3 specific post ideas)
8. Why this campaign will succeed (3 reasons)

Return as JSON:
{
  "campaignName": "",
  "campaignDescription": "",
  "targetAudienceDescription": "",
  "budgetMin": 0,
  "budgetMax": 0,
  "budgetReasoning": "",
  "marketingCopy": "",
  "hashtags": [],
  "contentSuggestions": [
    { "type": "post|story|reel", "idea": "", "timing": "" }
  ],
  "successReasons": []
}`

  try {
    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a fashion marketing strategist. Create data-driven campaigns that leverage trends and product bundles. Be specific and actionable."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1000
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('No response from AI')
    
    return JSON.parse(content)
  } catch (error) {
    console.error('Error generating campaign content:', error)
    throw error
  }
}

export async function POST(request: NextRequest) {
  try {
    const { brand_id } = await request.json()
    
    if (!brand_id) {
      return NextResponse.json({ error: 'Brand ID required' }, { status: 400 })
    }

    console.log('Generating campaigns for brand:', brand_id)

    // Fetch brand info
    const { data: brandInfo, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('brand_id', brand_id)
      .single()

    if (brandError || !brandInfo) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    // Fetch products with good inventory
    // First try with is_active, then without if it fails
    let products = null
    let productsError = null
    
    // Try with is_active first
    const result1 = await supabase
      .from('products')
      .select('*')
      .eq('brand_id', brand_id)
      .eq('is_active', true)
      .gte('current_inventory_level', 5)
      .order('revenue_last_30d', { ascending: false })
      .limit(200)
    
    if (result1.error?.message?.includes('column') || result1.error?.code === '42703') {
      // is_active column doesn't exist, try without it
      console.log('is_active column not found, querying without it')
      const result2 = await supabase
        .from('products')
        .select('*')
        .eq('brand_id', brand_id)
        .gte('current_inventory_level', 5)
        .order('revenue_last_30d', { ascending: false })
        .limit(200)
      
      products = result2.data
      productsError = result2.error
    } else {
      products = result1.data
      productsError = result1.error
    }

    console.log(`Found ${products?.length || 0} products for brand ${brand_id}`)

    // If still no products, try with even more relaxed criteria
    if ((!products || products.length < 5) && !productsError) {
      console.log('Trying with more relaxed criteria...')
      const result3 = await supabase
        .from('products')
        .select('*')
        .eq('brand_id', brand_id)
        .order('created_at', { ascending: false })
        .limit(200)
      
      if (result3.data && result3.data.length > 0) {
        products = result3.data
        productsError = result3.error
        console.log(`Found ${products?.length || 0} products with relaxed criteria`)
      }
    }

    if (productsError || !products || products.length < 2) { // Further reduced to 2
      return NextResponse.json({ 
        error: 'Insufficient products for campaign generation',
        message: `Need at least 2 active products. Found: ${products?.length || 0}`,
        details: productsError?.message
      }, { status: 400 })
    }

    // Log sample product to see structure
    if (products.length > 0) {
      console.log('Sample product structure:', JSON.stringify(products[0], null, 2))
    }

    // Fetch active trends
    const { data: trends, error: trendsError } = await supabase
      .from('trends')
      .select('*')
      .in('lifecycle_stage', ['emerging', 'growing', 'peak'])
      .gte('momentum_score', 20) // Reduced from 30 to 20
      .order('momentum_score', { ascending: false })
      .limit(50)

    console.log(`Found ${trends?.length || 0} active trends`)

    if (trendsError || !trends || trends.length === 0) {
      return NextResponse.json({ 
        error: 'No active trends found',
        message: 'Campaign generation requires trend data'
      }, { status: 400 })
    }

    // Find bundling opportunities
    const bundles = await findBundlingOpportunities(products, trends)
    
    console.log(`Bundling complete. Found ${bundles.length} opportunities`)
    
    if (bundles.length === 0) {
      // Log why no bundles were found
      console.log('No bundles found. Product count:', products.length)
      console.log('Trend count:', trends.length)
      
      return NextResponse.json({ 
        error: 'No campaign opportunities found',
        message: 'Could not find suitable product bundles',
        debug: {
          productCount: products.length,
          trendCount: trends.length,
          minimumProductsPerBundle: 2
        }
      }, { status: 200 })
    }

    // Generate campaigns for top bundles
    const campaigns = []
    for (const bundle of bundles.slice(0, 5)) { // Generate up to 5 campaigns
      try {
        const aiContent = await generateCampaignContent(bundle, brandInfo)
        
        // Calculate campaign dates
        const startDate = new Date()
        startDate.setDate(startDate.getDate() + 7) // Start in 1 week
        const endDate = new Date(startDate)
        endDate.setMonth(endDate.getMonth() + 1) // 1 month campaign

        // Create campaign record
        const { data: campaign, error: campaignError } = await supabase
          .from('campaigns')
          .insert({
            brand_id,
            campaign_name: aiContent.campaignName,
            campaign_description: aiContent.campaignDescription,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            status: 'draft',
            bundle_criteria: bundle.criteria,
            bundle_reasons: bundle.bundleReasons,
            target_audience: {
              gender: brandInfo.target_gender,
              ageMin: brandInfo.target_age_min,
              ageMax: brandInfo.target_age_max,
              incomeLevel: brandInfo.target_income_level,
              interests: brandInfo.target_interests || []
            },
            target_audience_description: aiContent.targetAudienceDescription,
            budget_min: aiContent.budgetMin,
            budget_max: aiContent.budgetMax,
            budget_currency: 'USD',
            budget_reasoning: aiContent.budgetReasoning,
            marketing_copy: aiContent.marketingCopy,
            hashtags: aiContent.hashtags,
            content_suggestions: aiContent.contentSuggestions,
            confidence_score: 0.7 + (bundle.matchingTrends[0]?.relevanceScore || 0) * 0.3,
            generation_reasons: {
              productCount: bundle.products.length,
              trendCount: bundle.matchingTrends.length,
              bundleCriteria: Object.keys(bundle.criteria).filter(k => bundle.criteria[k as keyof BundleCriteria]),
              successReasons: aiContent.successReasons
            }
          })
          .select()
          .single()

        if (campaignError) throw campaignError

        // Link products to campaign
        const productLinks = bundle.products.map((product: any) => ({
          campaign_id: campaign.campaign_id,
          product_id: product.product_id,
          inclusion_reason: `Part of ${bundle.bundleReasons.join(', ')} bundle`,
          expected_performance: {
            currentRevenue: product.revenue_last_30d || 0,
            expectedLift: 20 // 20% lift expected
          }
        }))

        await supabase
          .from('campaign_products')
          .insert(productLinks)

        // Link trends to campaign
        const trendLinks = bundle.matchingTrends.map((trend: any) => ({
          campaign_id: campaign.campaign_id,
          trend_id: trend.trend_id,
          relevance_score: trend.relevanceScore,
          link_reason: trend.linkFactors.join(', '),
          link_factors: {
            factors: trend.linkFactors,
            trendStage: trend.lifecycle_stage,
            momentumScore: trend.momentum_score
          }
        }))

        await supabase
          .from('campaign_trends')
          .insert(trendLinks)

        campaigns.push({
          ...campaign,
          products: bundle.products.slice(0, 5), // Include first 5 products
          trends: bundle.matchingTrends.slice(0, 3) // Include top 3 trends
        })

      } catch (error) {
        console.error('Error generating campaign:', error)
        // Continue with next bundle
      }
    }

    return NextResponse.json({
      success: true,
      campaigns_generated: campaigns.length,
      campaigns
    })

  } catch (error: any) {
    console.error('Campaign generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate campaigns' },
      { status: 500 }
    )
  }
} 