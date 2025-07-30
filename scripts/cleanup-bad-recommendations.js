const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanupBadData() {
  console.log('=== CLEANING UP BAD RECOMMENDATIONS AND TRENDS ===\n');
  
  // 1. First, identify non-fashion trends
  const { data: allTrends } = await supabase
    .from('trends')
    .select('trend_id, trend_identifier, trend_description')
    .limit(1000);
  
  const nonFashionTrends = allTrends?.filter(t => {
    const identifier = t.trend_identifier?.toLowerCase() || '';
    const description = (t.trend_description || '').toLowerCase();
    const text = `${identifier} ${description}`;
    
    const nonFashionKeywords = [
      'retail-strategy', 'retail strategy', 'omnichannel', 'marketing-strategy', 'marketing strategy',
      'business-model', 'business model', 'technology-platform', 'technology platform',
      'digital-transformation', 'digital transformation', 'sales-channel', 'sales channel',
      'customer-journey', 'customer journey', 'supply-chain', 'supply chain',
      'inventory-management', 'inventory management', 'e-commerce-platform', 'e-commerce platform',
      'social-media-strategy', 'social media strategy', 'influencer-marketing', 'influencer marketing',
      'data-analytics', 'data analytics', 'customer-experience', 'customer experience',
      'retail-technology', 'retail technology', 'relatable-fashion-style', 'relatable fashion style',
      'affordable-athleisure-wear', 'beach-to-street-attire', 'social-media-influencer'
    ];
    
    return nonFashionKeywords.some(keyword => text.includes(keyword));
  }) || [];
  
  console.log(`Found ${nonFashionTrends.length} non-fashion trends to delete\n`);
  
  if (nonFashionTrends.length > 0) {
    console.log('Non-fashion trends to delete:');
    nonFashionTrends.slice(0, 20).forEach(t => {
      console.log(`- "${t.trend_identifier}" (ID: ${t.trend_id})`);
    });
    
    const nonFashionTrendIds = nonFashionTrends.map(t => t.trend_id);
    
    // Delete recommendations associated with non-fashion trends
    const { count: deletedRecs } = await supabase
      .from('recommendations')
      .delete()
      .in('matched_trend_id', nonFashionTrendIds);
    
    console.log(`\nDeleted ${deletedRecs || 0} recommendations with non-fashion trends`);
    
    // Delete campaigns associated with non-fashion trends
    const { count: deletedCampaigns } = await supabase
      .from('campaigns')
      .delete()
      .in('trend_id', nonFashionTrendIds);
    
    console.log(`Deleted ${deletedCampaigns || 0} campaigns with non-fashion trends`);
    
    // Delete the non-fashion trends
    const { count: deletedTrends } = await supabase
      .from('trends')
      .delete()
      .in('trend_id', nonFashionTrendIds);
    
    console.log(`Deleted ${deletedTrends || 0} non-fashion trends`);
  }
  
  // 2. Delete recommendations where products and trends have no matching clothing articles
  console.log('\n\n=== CLEANING UP MISMATCHED RECOMMENDATIONS ===\n');
  
  // Get all active recommendations
  const { data: recommendations } = await supabase
    .from('recommendations')
    .select('recommendation_id, product_id, matched_trend_id')
    .eq('is_active', true)
    .limit(1000);
  
  if (recommendations && recommendations.length > 0) {
    // Get unique product and trend IDs
    const productIds = [...new Set(recommendations.map(r => r.product_id))];
    const trendIds = [...new Set(recommendations.map(r => r.matched_trend_id).filter(id => id !== null))];
    
    // Get products and trends with their clothing articles
    const { data: products } = await supabase
      .from('products')
      .select('product_id, product_name, clothing_articles')
      .in('product_id', productIds);
    
    const { data: trends } = await supabase
      .from('trends')
      .select('trend_id, trend_identifier, clothing_articles')
      .in('trend_id', trendIds);
    
    const productMap = new Map(products?.map(p => [p.product_id, p]) || []);
    const trendMap = new Map(trends?.map(t => [t.trend_id, t]) || []);
    
    // Find mismatched recommendations
    const mismatchedRecIds = [];
    
    recommendations.forEach(rec => {
      const product = productMap.get(rec.product_id);
      const trend = trendMap.get(rec.matched_trend_id);
      
      if (product && trend) {
        const productArticles = product.clothing_articles || [];
        const trendArticles = trend.clothing_articles || [];
        
        // Check if there's no match
        const hasMatch = productArticles.length > 0 && 
                        trendArticles.length > 0 && 
                        productArticles.some(pa => trendArticles.includes(pa));
        
        if (!hasMatch) {
          mismatchedRecIds.push(rec.recommendation_id);
          console.log(`Mismatch: "${product.product_name}" [${productArticles.join(', ') || 'NONE'}] → "${trend.trend_identifier}" [${trendArticles.join(', ') || 'NONE'}]`);
        }
      }
    });
    
    console.log(`\nFound ${mismatchedRecIds.length} mismatched recommendations`);
    
    if (mismatchedRecIds.length > 0) {
      // Delete mismatched recommendations
      const { count: deletedMismatched } = await supabase
        .from('recommendations')
        .delete()
        .in('recommendation_id', mismatchedRecIds);
      
      console.log(`Deleted ${deletedMismatched || 0} mismatched recommendations`);
    }
  }
  
  console.log('\n\n=== CLEANUP COMPLETE ===');
  
  // Show remaining stats
  const { count: remainingRecs } = await supabase
    .from('recommendations')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);
  
  const { count: remainingTrends } = await supabase
    .from('trends')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\nRemaining active recommendations: ${remainingRecs}`);
  console.log(`Remaining trends: ${remainingTrends}`);
}

cleanupBadData().catch(console.error); 