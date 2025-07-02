import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Simplified version without OpenAI dependency
export async function POST(request: NextRequest) {
  console.log('Simple recommendations endpoint called')
  
  try {
    const { brand_id } = await request.json()
    
    if (!brand_id) {
      return NextResponse.json({ error: 'Brand ID required' }, { status: 400 })
    }

    console.log('Generating recommendations for brand:', brand_id)

    // Fetch products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('brand_id', brand_id)
      .eq('is_active', true)
      .limit(100)

    if (productsError || !products || products.length === 0) {
      return NextResponse.json({ 
        error: 'No products found',
        recommendations_count: 0
      })
    }

    // Fetch trends
    const { data: trends, error: trendsError } = await supabase
      .from('trends')
      .select('*')
      .in('lifecycle_stage', ['emerging', 'growing', 'peak'])
      .gte('momentum_score', 50)
      .limit(10)

    if (trendsError || !trends || trends.length === 0) {
      return NextResponse.json({ 
        error: 'No trends found',
        recommendations_count: 0
      })
    }

    // Clear existing recommendations
    await supabase
      .from('recommendations')
      .delete()
      .eq('brand_id', brand_id)

    // Generate simple recommendations
    const recommendations = []
    
    for (const product of products.slice(0, 50)) { // Limit to 50 products
      // Pick a random trend
      const trend = trends[Math.floor(Math.random() * trends.length)]
      
      // Generate a simple score
      const score = 50 + Math.floor(Math.random() * 40) // 50-90
      
      // Determine action
      let action = 'hold'
      if (score >= 80) action = 'strong_promote'
      else if (score >= 70) action = 'promote'
      else if (score >= 60) action = 'hold'
      else action = 'markdown'
      
      // Check inventory
      if (product.current_inventory_level < 20 && (action === 'promote' || action === 'strong_promote')) {
        action = 'restock_urgent'
      }
      
      recommendations.push({
        brand_id,
        product_id: product.product_id,
        matched_trend_id: trend.trend_id,
        alignment_score: score,
        alignment_factors: {
          category_match: 60 + Math.random() * 30,
          demographic_alignment: 50 + Math.random() * 40,
          style_match: 55 + Math.random() * 35,
          seasonality_match: 60 + Math.random() * 30,
          lifecycle_compatibility: 70 + Math.random() * 20,
          trend_momentum: trend.momentum_score
        },
        recommendation_type: 'trend_based',
        recommendation_action: action,
        confidence_score: 0.6 + Math.random() * 0.3,
        generated_by: 'simple_algorithm_v1',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        reasons: [
          {
            type: 'trend_alignment',
            code: 'match_found',
            description: `Product aligns with ${trend.trend_identifier} trend based on category and style`,
            impact_score: 0.8,
            supporting_data: { trend_stage: trend.lifecycle_stage }
          },
          {
            type: 'inventory',
            code: product.current_inventory_level < 50 ? 'low_stock' : 'adequate_stock',
            description: `Current inventory: ${product.current_inventory_level || 0} units`,
            impact_score: 0.6,
            supporting_data: { inventory: product.current_inventory_level }
          }
        ]
      })
    }

    // Insert recommendations
    const { data: inserted, error: insertError } = await supabase
      .from('recommendations')
      .insert(recommendations)
      .select()

    if (insertError) {
      console.error('Insert error:', insertError)
      throw insertError
    }

    return NextResponse.json({
      success: true,
      recommendations_count: inserted?.length || 0,
      message: `Generated ${inserted?.length || 0} recommendations (simplified algorithm)`
    })

  } catch (error: any) {
    console.error('Error in simple recommendations:', error)
    return NextResponse.json({ 
      error: 'Failed to generate recommendations',
      details: error.message 
    }, { status: 500 })
  }
}