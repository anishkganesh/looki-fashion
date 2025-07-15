import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { getAIConfig } from '@/lib/ai-config'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export async function POST(request: NextRequest) {
  try {
    const { brand_id, trend_id } = await request.json()
    
    if (!brand_id || !trend_id) {
      return NextResponse.json({ error: 'Brand ID and Trend ID required' }, { status: 400 })
    }

    console.log('Generating campaign for trend:', trend_id, 'brand:', brand_id)
    
    // Test if campaigns table exists
    const { data: tableCheck, error: tableError } = await supabase
      .from('campaigns')
      .select('campaign_id')
      .limit(1)
    
    if (tableError) {
      console.error('Error accessing campaigns table:', tableError)
      return NextResponse.json({ 
        error: 'Cannot access campaigns table',
        details: tableError.message
      }, { status: 500 })
    }
    
    console.log('Campaigns table accessible')

    // Fetch brand info
    const { data: brandInfo, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('brand_id', brand_id)
      .single()

    if (brandError || !brandInfo) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    // Fetch the specific trend
    const { data: trend, error: trendError } = await supabase
      .from('trends')
      .select('*')
      .eq('trend_id', trend_id)
      .single()

    if (trendError || !trend) {
      return NextResponse.json({ error: 'Trend not found' }, { status: 404 })
    }

    // Fetch products that match this trend
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('brand_id', brand_id)
      .gte('current_inventory_level', 5)
      .order('revenue_last_30d', { ascending: false })
      .limit(100)

    if (productsError || !products || products.length === 0) {
      return NextResponse.json({ 
        error: 'No products available for campaign generation',
        message: 'Need at least one active product with inventory'
      }, { status: 400 })
    }

    // Find products that match this trend
    const matchingProducts: any[] = []
    
    for (const product of products) {
      let matchScore = 0
      const reasons: string[] = []
      
      // Convert trend data to searchable keywords
      const trendKeywords = [
        trend.trend_identifier,
        trend.trend_category,
        trend.trend_description
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
      const productColor = (product.color || '').toLowerCase()
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
      const productGender = (product.target_gender || 'unisex').toLowerCase()
      const trendGender = (trend.target_gender || 'unisex').toLowerCase()
      if (productGender === trendGender || productGender === 'unisex' || trendGender === 'unisex') {
        matchScore += 0.1
        reasons.push('Target audience match')
      }
      
      if (matchScore >= 0.1) { // Lower threshold from 0.2 to 0.1 for single trend campaigns
        matchingProducts.push({ product, score: matchScore, reasons })
      }
    }
    
    // Sort by match score and take top products
    matchingProducts.sort((a, b) => b.score - a.score)
    const selectedProducts = matchingProducts.slice(0, 10).map(mp => mp.product)
    
    if (selectedProducts.length === 0) {
      return NextResponse.json({ 
        error: 'No products match this trend',
        message: 'Try selecting a different trend or adding more diverse products'
      }, { status: 400 })
    }

    // Get existing campaign names
    const { data: existingCampaigns } = await supabase
      .from('campaigns')
      .select('campaign_name')
      .eq('brand_id', brand_id)
    
    const existingCampaignNames = existingCampaigns?.map(c => c.campaign_name) || []

    // Generate campaign content
    const productList = selectedProducts.slice(0, 10).map((p: any) => 
      `- ${p.product_name} ($${p.current_price})`
    ).join('\n')

    const prompt = `You are a creative marketing strategist for ${brandInfo.brand_name}.

Create a compelling marketing campaign based on this specific trending fashion movement:

TREND: ${trend.trend_identifier} (${trend.lifecycle_stage}, momentum: ${trend.momentum_score}%)
Trend Description: ${trend.trend_description || 'No description available'}
Target Demographics: ${trend.target_gender || 'All'} aged ${trend.target_age_min || 18}-${trend.target_age_max || 65}
Trend Region: ${trend.trend_region || 'Global'}
Social Reach: ${trend.social_reach?.toLocaleString() || 'Unknown'}

PRODUCTS TO FEATURE (${selectedProducts.length} products):
${productList}

BRAND CONTEXT:
- Brand Style: ${brandInfo.brand_style || 'Contemporary'}
- Brand Values: ${brandInfo.brand_values || 'Quality and style'}

EXISTING CAMPAIGNS (avoid these names):
${existingCampaignNames.join(', ')}

Generate a campaign with:
1. Campaign Name: Creative, memorable, and directly referencing the trend
2. Campaign Description: 2-3 sentences explaining how this campaign leverages the specific trend
3. Target Audience: Specific description based on the trend
4. Budget Range: Realistic min-max in USD
5. Budget Reasoning: Why this budget makes sense for this trend
6. Marketing Copy: 3-4 sentences for social media
7. Hashtags: 5-7 relevant hashtags including the trend
8. Content Suggestions: 3 specific content ideas
9. Success Prediction: Assessment based on trend momentum

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
            content: 'You are an expert fashion marketing strategist. Create compelling, trend-focused campaigns.'
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

      const aiContent = JSON.parse(completion.choices[0].message.content || '{}')
      
      console.log('AI generated campaign content:', aiContent)
      
      // Create campaign
      const startDate = new Date()
      const endDate = new Date()
      endDate.setMonth(endDate.getMonth() + 2) // 2 month campaign for single trend
      
      const campaignData = {
        brand_id,
        campaign_name: aiContent.campaign_name,
        campaign_description: aiContent.campaign_description,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        status: 'draft',
        bundle_criteria: {
          trend: trend.trend_identifier,
          productCount: selectedProducts.length,
          trendMatch: 'direct'
        },
        bundle_reasons: [`Direct match with ${trend.trend_identifier} trend`, `${selectedProducts.length} products aligned`],
        target_audience: {
          age_min: trend.target_age_min || 18,
          age_max: trend.target_age_max || 65,
          gender: trend.target_gender || 'all',
          locations: trend.target_locations || [],
          income_level: trend.target_income_level || 'medium',
          interests: trend.target_interests || []
        },
        target_audience_description: aiContent.target_audience,
        budget_min: aiContent.budget_min,
        budget_max: aiContent.budget_max,
        budget_currency: 'USD',
        budget_reasoning: aiContent.budget_reasoning,
        marketing_copy: aiContent.marketing_copy,
        hashtags: aiContent.hashtags,
        content_suggestions: aiContent.content_suggestions,
        confidence_score: 0.6 + (trend.momentum_score / 100) * 0.4,
        generation_reasons: {
          productCount: selectedProducts.length,
          trend: trend.trend_identifier,
          trendMomentum: trend.momentum_score,
          matchingProducts: matchingProducts.length,
          successPrediction: aiContent.success_prediction
        },
        trend_id: trend.trend_id,
        social_reach: trend.social_reach
      }
      
      console.log('Attempting to insert campaign with data:', JSON.stringify(campaignData, null, 2))
      
      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert(campaignData)
        .select()
        .single()
      
      if (campaignError) {
        console.error('Error creating campaign:', campaignError)
        console.error('Campaign error details:', {
          message: campaignError.message,
          details: campaignError.details,
          hint: campaignError.hint,
          code: campaignError.code
        })
        return NextResponse.json({ 
          error: 'Failed to create campaign in database',
          details: campaignError.message,
          hint: campaignError.hint
        }, { status: 500 })
      }
      
      console.log('Campaign created successfully:', campaign)
      
      // Insert campaign products
      const productInserts = selectedProducts.map((product: any, index: number) => ({
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
      
      return NextResponse.json({
        success: true,
        campaign_name: campaign.campaign_name,
        campaign_id: campaign.campaign_id,
        product_count: selectedProducts.length,
        trend: trend.trend_identifier
      })
      
    } catch (error: any) {
      console.error('Error generating campaign content:', error)
      return NextResponse.json({ 
        error: 'Failed to generate campaign',
        details: error.message
      }, { status: 500 })
    }
    
  } catch (error: any) {
    console.error('Error in single campaign generation:', error)
    return NextResponse.json({ 
      error: 'Campaign generation failed',
      details: error.message
    }, { status: 500 })
  }
} 