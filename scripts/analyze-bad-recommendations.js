const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function analyzeBadTrends() {
  console.log('=== Analyzing Non-Fashion Trends ===');
  
  // Find trends that are likely not fashion-related
  const { data: trends } = await supabase
    .from('trends')
    .select('trend_id, trend_name, trend_description, clothing_articles')
    .or('trend_name.ilike.%retail%,trend_name.ilike.%strategy%,trend_name.ilike.%marketing%,trend_name.ilike.%business%,trend_name.ilike.%technology%,trend_name.ilike.%digital%,trend_name.ilike.%omnichannel%,trend_name.ilike.%platform%,trend_name.ilike.%channel%')
    .limit(30);
  
  console.log('\nNon-fashion trends found:', trends?.length || 0);
  trends?.forEach(t => {
    console.log(`\n- "${t.trend_name}" (ID: ${t.trend_id})`);
    console.log(`  Articles: [${t.clothing_articles?.join(', ') || 'none'}]`);
    console.log(`  Description: ${t.trend_description?.substring(0, 100)}...`);
  });
  
  console.log('\n\n=== Analyzing Bad Matches ===');
  
  // Find specific bad recommendations
  const { data: recommendations } = await supabase
    .from('recommendations')
    .select('recommendation_id, product_id, trend_id, match_score, is_active')
    .eq('is_active', true)
    .limit(100);
  
  // Get products and trends details
  const productIds = [...new Set(recommendations?.map(r => r.product_id) || [])];
  const trendIds = [...new Set(recommendations?.map(r => r.trend_id) || [])];
  
  const { data: products } = await supabase
    .from('products')
    .select('product_id, product_name, clothing_articles')
    .in('product_id', productIds);
  
  const { data: trendsData } = await supabase
    .from('trends')
    .select('trend_id, trend_name, clothing_articles')
    .in('trend_id', trendIds);
  
  const productMap = new Map(products?.map(p => [p.product_id, p]) || []);
  const trendMap = new Map(trendsData?.map(t => [t.trend_id, t]) || []);
  
  console.log('\nChecking for mismatched recommendations:');
  let mismatchCount = 0;
  
  recommendations?.forEach(r => {
    const product = productMap.get(r.product_id);
    const trend = trendMap.get(r.trend_id);
    
    if (product && trend) {
      const productArticles = product.clothing_articles || [];
      const trendArticles = trend.clothing_articles || [];
      const hasOverlap = productArticles.some(pa => trendArticles.includes(pa));
      
      if (!hasOverlap || trendArticles.length === 0 || productArticles.length === 0) {
        mismatchCount++;
        console.log(`\nMISMATCH ${mismatchCount}: "${product.product_name}" → "${trend.trend_name}"`);
        console.log(`  Product articles: [${productArticles.join(', ') || 'NONE'}]`);
        console.log(`  Trend articles: [${trendArticles.join(', ') || 'NONE'}]`);
        console.log(`  Match score: ${r.match_score}%`);
      }
    }
  });
  
  console.log(`\n\nTotal mismatches found: ${mismatchCount} out of ${recommendations?.length || 0} recommendations`);
}

analyzeBadTrends().catch(console.error); 