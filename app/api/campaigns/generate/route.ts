import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import openaiClient from '@/lib/openai'
import { AI_CONFIG, getAIConfig } from '@/lib/ai-config'
import { extractFromProductHierarchy } from '@/lib/clothing-categories'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Helper function to generate campaign hero image
async function generateCampaignHeroImage(campaign: any, products: any[], trend: any): Promise<string | null> {
  try {
    const productNames = products.slice(0, 3).map(p => p.product_name).join(', ')
    const prompt = `Fashion campaign hero image featuring ${productNames}. Campaign theme: ${campaign.campaign_name}. Trend: ${trend.trend_identifier.replace(/-/g, ' ')}. Professional fashion photography, editorial layout, clean aesthetic, brand cohesion, no text or logos.`
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/images/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        prompt,
        brandContext: { style: 'contemporary', price_point: 'premium' }
      })
    })
    
    if (!response.ok) {
      console.error('Failed to generate campaign hero image:', await response.text())
      return null
    }
    
    const data = await response.json()
    return data.url || null
  } catch (error) {
    console.error('Error generating campaign hero image:', error)
    return null
  }
}

// Helper function to check if clothing articles are similar
function areArticlesSimilar(article1: string, article2: string): boolean {
  const similarityMap: Record<string, string[]> = {
    'jeans': ['denim', 'jeans'],
    'denim': ['jeans', 'denim'],
    'shirts': ['blouses', 'tops', 't-shirts', 'shirts'],
    'blouses': ['shirts', 'tops', 'blouses'],
    'tops': ['shirts', 'blouses', 't-shirts', 'tops'],
    't-shirts': ['shirts', 'tops', 't-shirts'],
    'pants': ['trousers', 'bottoms', 'pants'],
    'trousers': ['pants', 'bottoms', 'trousers'],
    'bottoms': ['pants', 'trousers', 'bottoms'],
    'shoes': ['footwear', 'sneakers', 'shoes'],
    'sneakers': ['shoes', 'footwear', 'sneakers'],
    'footwear': ['shoes', 'sneakers', 'footwear']
  }
  
  // Direct match
  if (article1 === article2) return true
  
  // Check similarity map
  const similar = similarityMap[article1.toLowerCase()]
  return similar ? similar.includes(article2.toLowerCase()) : false
}

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

// Function to create campaigns - one per trend with matching products
async function createCampaignsFromTrends(products: any[], trends: any[]) {
  console.log(`Creating campaigns from ${trends.length} trends and ${products.length} products`)
  
  const campaigns: Array<{
    trend: any
    products: any[]
    matchScore: number
    bundleReasons: string[]
  }> = []

  // For each high-performing trend, find matching products
  for (const trend of trends) {
    // Skip low momentum trends
    if (trend.momentum_score < 40) continue
    
    // Find matching products for this trend
    const matchingProducts: Array<{product: any, score: number, reasons: string[]}> = []
    
    for (const product of products) {
      // Check clothing article compatibility FIRST (strict matching)
      const productArticles = product.clothing_articles || []
      const trendArticles = trend.clothing_articles || []
      
      // Skip if no clothing article match (strict matching with similarity)
      if (productArticles.length > 0 && trendArticles.length > 0) {
        const hasMatch = productArticles.some((pa: string) => 
          trendArticles.some((ta: string) => 
            pa === ta || areArticlesSimilar(pa, ta)
          )
        )
        if (!hasMatch) {
          continue // Skip this product entirely
        }
      } else if (productArticles.length === 0 || trendArticles.length === 0) {
        // Skip if either has no clothing articles defined
        continue
      }
      
      let matchScore = 0
      const reasons: string[] = []
      
      // Convert trend data to searchable keywords
      const trendKeywords = [
        trend.trend_identifier,
        trend.trend_category,
        trend.trend_description,
        ...(trend.target_interests || []),
        ...(trend.target_lifestyle || []),
        trend.target_gender
      ].filter(Boolean).join(' ').toLowerCase()
      
      // Check category match
      const productCategory = (product.category || product.category_hierarchy || '').toLowerCase()
      if (productCategory && (
        trendKeywords.includes(productCategory) || 
        trend.trend_category?.toLowerCase().includes(productCategory.split('/')[0])
      )) {
        matchScore += 0.3
        reasons.push('Category match')
      }
      
      // Check color match
      const productColor = (product.color || product.attributes?.colors?.[0] || '').toLowerCase()
      if (productColor && trendKeywords.includes(productColor)) {
        matchScore += 0.2
        reasons.push('Color trend alignment')
      }
      
      // Check style/material match
      const productName = (product.product_name || '').toLowerCase()
      const trendWords = trend.trend_identifier.toLowerCase().split(/[^a-z]+/)
      for (const word of trendWords) {
        if (word.length > 3 && productName.includes(word)) {
          matchScore += 0.2
          reasons.push(`Keyword match: ${word}`)
          break
        }
      }
      
      // Check demographic match
      const productGender = (product.target_gender || product.demographics?.gender || 'unisex').toLowerCase()
      const trendGender = (trend.target_gender || 'unisex').toLowerCase()
      if (productGender === trendGender || productGender === 'unisex' || trendGender === 'unisex') {
        matchScore += 0.1
        reasons.push('Target audience match')
      }
      
      // Check price point match based on trend income level
      const price = product.current_price || 0
      const incomeLevel = trend.target_income_level || 'medium'
      if (
        (incomeLevel === 'high' && price > 200) ||
        (incomeLevel === 'medium' && price >= 50 && price <= 200) ||
        (incomeLevel === 'low' && price < 50)
      ) {
        matchScore += 0.1
        reasons.push('Price point alignment')
      }
      
      // Boost for high-performing products
      if (product.revenue_last_30d > 1000 || product.units_sold_last_30d > 20) {
        matchScore += 0.1
        reasons.push('High-performing product')
      }
      
      if (matchScore >= 0.15) { // Lowered from 0.3 to 0.15 for more lenient matching
        matchingProducts.push({ product, score: matchScore, reasons })
      }
    }
    
    // Sort by match score and take top products
    matchingProducts.sort((a, b) => b.score - a.score)
    const selectedProducts = matchingProducts.slice(0, 15).map(mp => mp.product)
    
    // Only create campaign if we have enough matching products
    if (selectedProducts.length >= 3) {
      campaigns.push({
        trend,
        products: selectedProducts,
        matchScore: matchingProducts[0]?.score || 0,
        bundleReasons: [
          `${trend.lifecycle_stage} trend with ${trend.momentum_score}% momentum`,
          `${selectedProducts.length} matching products`,
          ...matchingProducts.slice(0, 3).flatMap(mp => mp.reasons).filter((r, i, arr) => arr.indexOf(r) === i)
        ]
      })
    }
  }
  
  // Sort campaigns by trend momentum and product count
  campaigns.sort((a, b) => {
    const scoreA = a.trend.momentum_score + a.products.length
    const scoreB = b.trend.momentum_score + b.products.length
    return scoreB - scoreA
  })
  
  console.log(`Created ${campaigns.length} campaign opportunities`)
  return campaigns.slice(0, 10) // Return top 10 campaigns
}

// Generate campaign using AI
async function generateCampaignContent(campaign: any, brandInfo: any, existingCampaignNames: string[]) {
  const productList = campaign.products.slice(0, 10).map((p: any) => 
    `- ${p.product_name} ($${p.current_price})`
  ).join('\n')

  const trend = campaign.trend
  const trendInfo = `${trend.trend_identifier} (${trend.lifecycle_stage}, momentum: ${trend.momentum_score}%)`

  // Create a diverse prompt based on campaign characteristics
  const campaignStyle = campaign.matchScore > 0.7 ? 'highly targeted' :
                       campaign.matchScore > 0.5 ? 'well-aligned' : 'opportunity-based'
  
  const prompt = `You are a creative marketing strategist for ${brandInfo.brand_name}.

Create a compelling marketing campaign based on this trending fashion movement:

TREND: ${trendInfo}
Trend Description: ${trend.trend_description || 'No description available'}
Target Demographics: ${trend.target_gender || 'All'} aged ${trend.target_age_min || 18}-${trend.target_age_max || 65}
Trend Region: ${trend.trend_region || 'Global'}

PRODUCTS TO FEATURE (${campaign.products.length} total):
${productList}

CAMPAIGN CHARACTERISTICS:
- Style: ${campaignStyle}
- Match Reasons: ${campaign.bundleReasons.join(', ')}
- Brand Style: ${brandInfo.brand_style || 'Contemporary'}
- Brand Values: ${brandInfo.brand_values || 'Quality and style'}

EXISTING CAMPAIGNS (avoid these names):
${existingCampaignNames.join(', ')}

Generate a campaign with:
1. Campaign Name: Use the trend name "${trend.trend_identifier.replace(/-/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}" as the campaign name
2. Campaign Description: 2-3 sentences explaining the campaign concept and how it leverages the trend
3. Target Audience: Specific description based on the trend and products
4. Budget Range: Realistic min-max in USD based on campaign scope
5. Budget Reasoning: Why this budget makes sense
6. Marketing Copy: 3-4 sentences for social media posts
7. Hashtags: 5-7 relevant hashtags including the trend
8. Content Suggestions: 3 specific content ideas (posts, stories, reels)
9. Success Prediction: Brief assessment of likely performance

Format as JSON with these exact keys:
{
  "campaign_name": "",
  "campaign_description": "",
  "target_audience": "",
  "budget_min": 0,
  "budget_max": 0,
  "budget_reasoning": "",
  "marketing_copy": "",
  "hashtags": [],
  "content_suggestions": [],
  "success_prediction": ""
}`

  try {
    const aiConfig = getAIConfig('creative')
    const completion = await openaiClient.chat.completions.create({
      model: aiConfig.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert fashion marketing strategist. Create compelling, trend-driven campaigns that resonate with target audiences and drive sales.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: aiConfig.temperature,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    })

    const result = JSON.parse(completion.choices[0].message.content || '{}')
    
    // Ensure all required fields exist
    return {
      campaign_name: result.campaign_name || `${trend.trend_identifier} Collection`,
      campaign_description: result.campaign_description || `Campaign featuring ${campaign.products.length} products aligned with ${trend.trend_identifier} trend`,
      target_audience: result.target_audience || 'Fashion-forward consumers',
      budget_min: result.budget_min || 5000,
      budget_max: result.budget_max || 15000,
      budget_reasoning: result.budget_reasoning || 'Based on campaign scope and target reach',
      marketing_copy: result.marketing_copy || `Discover our latest collection inspired by ${trend.trend_identifier}`,
      hashtags: result.hashtags || [trend.trend_identifier.replace(/\s+/g, ''), brandInfo.brand_name.replace(/\s+/g, ''), 'fashion'],
      content_suggestions: result.content_suggestions || ['Instagram Reel showcasing products', 'Story series with styling tips', 'Influencer collaboration posts'],
      success_prediction: result.success_prediction || 'High potential based on trend momentum and product selection'
    }
  } catch (error) {
    console.error('Error generating campaign content:', error)
    // Return fallback content
    return {
      campaign_name: `${trend.trend_identifier} Campaign`,
      campaign_description: `Showcase our ${campaign.products.length} products that perfectly capture the ${trend.trend_identifier} trend`,
      target_audience: `${trend.target_gender || 'Fashion-conscious'} shoppers interested in ${trend.trend_category}`,
      budget_min: 5000,
      budget_max: 15000,
      budget_reasoning: 'Standard budget for multi-product campaign',
      marketing_copy: `Be part of the ${trend.trend_identifier} movement with our curated collection`,
      hashtags: [trend.trend_identifier.replace(/\s+/g, ''), brandInfo.brand_name.replace(/\s+/g, ''), 'trending'],
      content_suggestions: ['Product showcase reel', 'Styling guide posts', 'Customer testimonials'],
      success_prediction: 'Good potential based on trend alignment'
    }
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

    // Fetch existing campaign names to avoid duplicates
    const { data: existingCampaigns } = await supabase
      .from('campaigns')
      .select('campaign_name')
      .eq('brand_id', brand_id)
    
    const existingCampaignNames = existingCampaigns?.map(c => c.campaign_name) || []
    
    console.log(`Found ${existingCampaignNames.length} existing campaigns`)

    // Find bundling opportunities
    const bundles = await createCampaignsFromTrends(products, trends)
    
    console.log(`Bundling complete. Found ${bundles.length} opportunities`)
    
    if (bundles.length === 0) {
      return NextResponse.json({ 
        error: 'No suitable campaign opportunities found',
        message: 'Try adding more products or wait for new trends'
      }, { status: 400 })
    }

    // Generate campaigns
    let campaignsCreated = 0
    const maxCampaigns = 5
    const createdCampaigns: any[] = []
    
    for (const bundle of bundles) {
      if (campaignsCreated >= maxCampaigns) break
      
      try {
        console.log(`Generating campaign ${campaignsCreated + 1}/${maxCampaigns}`)
        
        // Generate AI content
        const aiContent = await generateCampaignContent(bundle, brandInfo, existingCampaignNames)
        
        // Add to existing names to avoid duplicates
        existingCampaignNames.push(aiContent.campaign_name)
        
        // Calculate campaign dates
        const startDate = new Date()
        const endDate = new Date()
        endDate.setMonth(endDate.getMonth() + 3)
        
        // Insert campaign
        const { data: campaign, error: campaignError } = await supabase
          .from('campaigns')
          .insert({
            brand_id,
            campaign_name: aiContent.campaign_name,
            campaign_description: aiContent.campaign_description,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            status: 'draft',
            bundle_criteria: {
              trend: bundle.trend.trend_identifier,
              matchScore: bundle.matchScore,
              productCount: bundle.products.length
            },
            bundle_reasons: bundle.bundleReasons,
            target_audience: {
              age_min: bundle.trend.target_age_min || 18,
              age_max: bundle.trend.target_age_max || 65,
              gender: bundle.trend.target_gender || 'all',
              locations: bundle.trend.target_locations || [],
              income_level: bundle.trend.target_income_level || 'medium',
              interests: bundle.trend.target_interests || []
            },
            target_audience_description: aiContent.target_audience,
            budget_min: aiContent.budget_min,
            budget_max: aiContent.budget_max,
            budget_currency: 'USD',
            budget_reasoning: aiContent.budget_reasoning,
            marketing_copy: aiContent.marketing_copy,
            hashtags: aiContent.hashtags,
            content_suggestions: aiContent.content_suggestions,
            confidence_score: 0.7 + bundle.matchScore * 0.3,
            generation_reasons: {
              productCount: bundle.products.length,
              trend: bundle.trend.trend_identifier,
              trendMomentum: bundle.trend.momentum_score,
              matchScore: bundle.matchScore,
              successPrediction: aiContent.success_prediction
            },
            // Add the single trend reference
            trend_id: bundle.trend.trend_id,
            social_reach: bundle.trend.social_reach,
            product_count: bundle.products.length
          })
          .select()
          .single()
        
        if (campaignError) {
          console.error('Error creating campaign:', campaignError)
          continue
        }
        
        // Insert campaign products
        const productInserts = bundle.products.map((product: any, index: number) => ({
          campaign_id: campaign.campaign_id,
          product_id: product.product_id,
          display_order: index + 1,
          inclusion_reason: 'Trend alignment'
        }))
        
        const { error: productsError } = await supabase
          .from('campaign_products')
          .insert(productInserts)
        
        if (productsError) {
          console.error('Error adding products to campaign:', productsError)
        }
        
        // Image generation removed - now done manually via UI button
        
        campaignsCreated++
        console.log(`Created campaign: ${aiContent.campaign_name}`)
        createdCampaigns.push(campaign)
        
      } catch (error) {
        console.error('Error generating campaign:', error)
        continue
      }
    }

    // Check if no campaigns were generated due to strict matching
    if (campaignsCreated === 0) {
      return NextResponse.json({
        success: false,
        campaigns_generated: 0,
        campaigns: [],
        message: 'No campaigns could be generated. No products match the clothing articles of the available trends.'
      })
    }
    
    return NextResponse.json({
      success: true,
      campaigns_generated: campaignsCreated,
      campaigns: createdCampaigns
    })

  } catch (error: any) {
    console.error('Campaign generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate campaigns' },
      { status: 500 }
    )
  }
} 