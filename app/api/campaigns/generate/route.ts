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
    const criteria: BundleCriteria = {}
    const reasons: string[] = []

    // Category-based bundling
    if (product.category) {
      bundleKeys.push(`category:${product.category}`)
      criteria.category = true
      reasons.push(`Same category: ${product.category}`)
    }

    // Price range bundling (within 20% of each other)
    const priceRange = Math.floor(product.current_price / 50) * 50
    bundleKeys.push(`price:${priceRange}-${priceRange + 50}`)
    criteria.priceRange = true
    reasons.push(`Similar price range: $${priceRange}-${priceRange + 50}`)

    // Color-based bundling
    if (product.attributes?.colors?.length > 0) {
      const primaryColor = product.attributes.colors[0]
      bundleKeys.push(`color:${primaryColor}`)
      criteria.color = true
      reasons.push(`Color theme: ${primaryColor}`)
    }

    // Style attributes bundling
    if (product.attributes?.style) {
      bundleKeys.push(`style:${product.attributes.style}`)
      criteria.style = true
      reasons.push(`Style: ${product.attributes.style}`)
    }

    // Demographics bundling
    if (product.demographics?.gender) {
      bundleKeys.push(`demo:${product.demographics.gender}:${product.demographics.age_group || 'all'}`)
      criteria.demographics = true
      reasons.push(`Target: ${product.demographics.gender} ${product.demographics.age_group || ''}`)
    }

    // Create composite bundle keys
    const compositeKeys = [
      bundleKeys.filter(k => k.startsWith('category') || k.startsWith('price')).join('|'),
      bundleKeys.filter(k => k.startsWith('style') || k.startsWith('color')).join('|'),
      bundleKeys.filter(k => k.startsWith('demo') || k.startsWith('category')).join('|')
    ].filter(k => k.includes('|'))

    // Add product to relevant bundles
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

  // Match trends to bundles
  for (const [key, bundle] of bundles) {
    for (const trend of trends) {
      let relevanceScore = 0
      const factors: string[] = []

      // Check category match
      if (bundle.criteria.category && bundle.products[0].category) {
        const category = bundle.products[0].category.toLowerCase()
        if (trend.trend_category?.toLowerCase().includes(category) ||
            trend.trend_identifier?.toLowerCase().includes(category)) {
          relevanceScore += 0.3
          factors.push('Category alignment')
        }
      }

      // Check style match
      if (bundle.criteria.style && bundle.products[0].attributes?.style) {
        const style = bundle.products[0].attributes.style.toLowerCase()
        if (trend.trend_identifier?.toLowerCase().includes(style) ||
            trend.trend_description?.toLowerCase().includes(style)) {
          relevanceScore += 0.3
          factors.push('Style match')
        }
      }

      // Check demographic match
      if (bundle.criteria.demographics && trend.target_gender) {
        const productDemo = bundle.products[0].demographics
        if (productDemo?.gender === trend.target_gender) {
          relevanceScore += 0.2
          factors.push('Demographic match')
        }
      }

      // Check lifecycle stage
      if (trend.lifecycle_stage === 'emerging' || trend.lifecycle_stage === 'growing') {
        relevanceScore += 0.2
        factors.push(`${trend.lifecycle_stage} trend opportunity`)
      }

      if (relevanceScore >= 0.3) {
        bundle.matchingTrends.push({
          ...trend,
          relevanceScore,
          linkFactors: factors
        })
      }
    }
  }

  // Filter bundles with at least 3 products and 1 trend
  return Array.from(bundles.values())
    .filter(bundle => bundle.products.length >= 3 && bundle.matchingTrends.length >= 1)
    .sort((a, b) => b.products.length - a.products.length)
    .slice(0, 10) // Top 10 opportunities
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
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('brand_id', brand_id)
      .eq('is_active', true)
      .gte('current_inventory_level', 10) // At least 10 units
      .order('revenue_last_30d', { ascending: false })
      .limit(200)

    if (productsError || !products || products.length < 10) {
      return NextResponse.json({ 
        error: 'Insufficient products for campaign generation',
        message: 'Need at least 10 active products with inventory'
      }, { status: 400 })
    }

    // Fetch active trends
    const { data: trends, error: trendsError } = await supabase
      .from('trends')
      .select('*')
      .in('lifecycle_stage', ['emerging', 'growing', 'peak'])
      .gte('momentum_score', 30)
      .order('momentum_score', { ascending: false })
      .limit(50)

    if (trendsError || !trends || trends.length === 0) {
      return NextResponse.json({ 
        error: 'No active trends found',
        message: 'Campaign generation requires trend data'
      }, { status: 400 })
    }

    // Find bundling opportunities
    const bundles = await findBundlingOpportunities(products, trends)
    
    if (bundles.length === 0) {
      return NextResponse.json({ 
        error: 'No campaign opportunities found',
        message: 'Could not find suitable product bundles'
      }, { status: 200 })
    }

    console.log(`Found ${bundles.length} bundling opportunities`)

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