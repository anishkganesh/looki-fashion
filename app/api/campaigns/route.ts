import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const brand_id = searchParams.get('brand_id')
    
    if (!brand_id) {
      return NextResponse.json({ error: 'Brand ID required' }, { status: 400 })
    }

    // Fetch campaigns with related data
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_products (
          *,
          product:products (
            product_id,
            product_name,
            variant_sku,
            current_price,
            current_inventory_level,
            images
          )
        ),
        campaign_trends (
          *,
          trend:trends (
            trend_id,
            trend_identifier,
            trend_category,
            lifecycle_stage,
            momentum_score
          )
        )
      `)
      .eq('brand_id', brand_id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching campaigns:', error)
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 })
    }

    // Transform the data for easier consumption
    const transformedCampaigns = campaigns?.map(campaign => ({
      ...campaign,
      products: campaign.campaign_products?.map((cp: any) => ({
        ...cp.product,
        inclusion_reason: cp.inclusion_reason,
        expected_performance: cp.expected_performance
      })) || [],
      trends: campaign.campaign_trends?.map((ct: any) => ({
        ...ct.trend,
        relevance_score: ct.relevance_score,
        link_reason: ct.link_reason,
        link_factors: ct.link_factors
      })) || []
    }))

    return NextResponse.json({
      campaigns: transformedCampaigns || [],
      total: transformedCampaigns?.length || 0
    })

  } catch (error: any) {
    console.error('Error in campaigns API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Apply a campaign
export async function PATCH(request: NextRequest) {
  try {
    const { campaign_id, action } = await request.json()
    
    if (!campaign_id || !action) {
      return NextResponse.json({ error: 'Campaign ID and action required' }, { status: 400 })
    }

    let updateData: any = {}
    
    switch (action) {
      case 'apply':
        updateData = {
          is_applied: true,
          applied_at: new Date().toISOString(),
          status: 'active'
        }
        break
      case 'pause':
        updateData = { status: 'paused' }
        break
      case 'resume':
        updateData = { status: 'active' }
        break
      case 'complete':
        updateData = { status: 'completed' }
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('campaigns')
      .update(updateData)
      .eq('campaign_id', campaign_id)
      .select(`
        *,
        campaign_products (
          *,
          product:products (
            product_id,
            product_name,
            variant_sku,
            current_price,
            current_inventory_level,
            images
          )
        ),
        campaign_trends (
          *,
          trend:trends (
            trend_id,
            trend_identifier,
            trend_category,
            lifecycle_stage,
            momentum_score
          )
        )
      `)
      .single()

    if (error) {
      console.error('Error updating campaign:', error)
      return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 })
    }

    // Transform the data like in GET
    const transformedCampaign = {
      ...data,
      products: data.campaign_products?.map((cp: any) => ({
        ...cp.product,
        inclusion_reason: cp.inclusion_reason,
        expected_performance: cp.expected_performance
      })) || [],
      trends: data.campaign_trends?.map((ct: any) => ({
        ...ct.trend,
        relevance_score: ct.relevance_score,
        link_reason: ct.link_reason,
        link_factors: ct.link_factors
      })) || []
    }

    return NextResponse.json({ success: true, campaign: transformedCampaign })

  } catch (error: any) {
    console.error('Error in campaign update:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 