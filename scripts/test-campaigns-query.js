const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testCampaignsQuery() {
  console.log('Testing campaigns query for brand_id 13...')
  
  try {
    // Test 1: Basic campaigns query
    console.log('\n1. Testing basic campaigns query:')
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('brand_id', 13)
      .limit(5)
    
    if (campaignsError) {
      console.error('Error fetching campaigns:', campaignsError)
    } else {
      console.log(`Found ${campaigns?.length || 0} campaigns`)
      if (campaigns && campaigns.length > 0) {
        console.log('Sample campaign:', campaigns[0])
      }
    }
    
    // Test 2: Check campaign_products table
    if (campaigns && campaigns.length > 0) {
      console.log('\n2. Testing campaign_products query:')
      const campaignId = campaigns[0].campaign_id
      const { data: campaignProducts, error: cpError } = await supabase
        .from('campaign_products')
        .select('*')
        .eq('campaign_id', campaignId)
        .limit(5)
      
      if (cpError) {
        console.error('Error fetching campaign_products:', cpError)
      } else {
        console.log(`Found ${campaignProducts?.length || 0} products for campaign ${campaignId}`)
      }
    }
    
    // Test 3: Check trends table
    console.log('\n3. Testing trends query:')
    const { data: trends, error: trendsError } = await supabase
      .from('trends')
      .select('trend_id, trend_identifier')
      .limit(5)
    
    if (trendsError) {
      console.error('Error fetching trends:', trendsError)
    } else {
      console.log(`Found ${trends?.length || 0} trends`)
    }
    
    // Test 4: Check products for brand 13
    console.log('\n4. Testing products query for brand 13:')
    const { data: products, count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', 13)
    
    console.log(`Found ${count || 0} products for brand 13`)
    
  } catch (error) {
    console.error('Unexpected error:', error)
  }
}

testCampaignsQuery()