const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkBadRecommendations() {
  // First check if those specific trends exist
  const trendNames = [
    'Omnichannel Retail Strategy', 
    'Relatable Fashion Style', 
    'Collared Jacket Style', 
    'Upcycled Denim Trend',
    'Boho Revival Dresses'
  ];
  
  const { data: specificTrends } = await supabase
    .from('trends')
    .select('trend_id, trend_name, trend_description, clothing_articles')
    .in('trend_name', trendNames);
  
  console.log('=== Checking Specific Trends from Image ===');
  specificTrends?.forEach(t => {
    console.log(`\n"${t.trend_name}" (ID: ${t.trend_id})`);
    console.log(`  Articles: [${t.clothing_articles?.join(', ') || 'NONE'}]`);
    console.log(`  Is Fashion Trend: ${isFashionTrend(t.trend_name, t.trend_description)}`);
  });
  
  // Get all recommendations with these trends
  const trendIds = specificTrends?.map(t => t.trend_id) || [];
  
  if (trendIds.length > 0) {
    const { data: recs } = await supabase
      .from('recommendations')
      .select('recommendation_id, product_id, trend_id, match_score')
      .in('trend_id', trendIds)
      .eq('is_active', true);
    
    // Get product details
    const productIds = [...new Set(recs?.map(r => r.product_id) || [])];
    const { data: products } = await supabase
      .from('products')
      .select('product_id, product_name, clothing_articles')
      .in('product_id', productIds);
    
    const productMap = new Map(products?.map(p => [p.product_id, p]) || []);
    const trendMap = new Map(specificTrends?.map(t => [t.trend_id, t]) || []);
    
    console.log('\n\n=== Recommendations with These Trends ===');
    recs?.forEach(r => {
      const product = productMap.get(r.product_id);
      const trend = trendMap.get(r.trend_id);
      if (product && trend) {
        console.log(`\n"${product.product_name}" → "${trend.trend_name}"`);
        console.log(`  Match Score: ${r.match_score}%`);
        console.log(`  Product Articles: [${product.clothing_articles?.join(', ') || 'NONE'}]`);
        console.log(`  Trend Articles: [${trend.clothing_articles?.join(', ') || 'NONE'}]`);
        console.log(`  Articles Match: ${doArticlesMatch(product.clothing_articles, trend.clothing_articles)}`);
      }
    });
  }
  
  // Check all trends for non-fashion ones
  console.log('\n\n=== Scanning All Trends for Non-Fashion Content ===');
  const { data: allTrends } = await supabase
    .from('trends')
    .select('trend_id, trend_name, trend_description')
    .limit(500);
  
  const nonFashionTrends = allTrends?.filter(t => !isFashionTrend(t.trend_name, t.trend_description)) || [];
  
  console.log(`\nFound ${nonFashionTrends.length} non-fashion trends:`);
  nonFashionTrends.slice(0, 20).forEach(t => {
    console.log(`- "${t.trend_name}" (ID: ${t.trend_id})`);
  });
}

function isFashionTrend(name, description) {
  const nonFashionKeywords = [
    'retail strategy', 'omnichannel', 'marketing strategy', 'business model', 
    'technology platform', 'digital transformation', 'sales channel', 
    'customer journey', 'supply chain', 'inventory management',
    'e-commerce platform', 'social media strategy', 'influencer marketing',
    'data analytics', 'customer experience', 'retail technology'
  ];
  
  const text = `${name} ${description || ''}`.toLowerCase();
  
  // Check if it contains non-fashion keywords
  const hasNonFashionKeywords = nonFashionKeywords.some(keyword => text.includes(keyword));
  
  // Check if it's too vague (like "Relatable Fashion Style")
  const isVague = name.match(/^(relatable|general|basic|simple|modern|contemporary)\s+(fashion|style|trend)$/i);
  
  return !hasNonFashionKeywords && !isVague;
}

function doArticlesMatch(productArticles, trendArticles) {
  if (!productArticles?.length || !trendArticles?.length) {
    return false;
  }
  
  // Check if there's any overlap
  return productArticles.some(pa => trendArticles.includes(pa));
}

checkBadRecommendations().catch(console.error); 