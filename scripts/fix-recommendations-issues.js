const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function analyzeAndFixIssues() {
  console.log('=== ANALYZING RECOMMENDATION ISSUES ===\n');
  
  // 1. Check recommendations for brand 13
  const { data: brand13Recs } = await supabase
    .from('recommendations')
    .select('recommendation_id, product_id, matched_trend_id, alignment_score, recommendation_reasons')
    .eq('brand_id', 13)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log(`Found ${brand13Recs?.length || 0} recommendations for brand 13 (Marisa)\n`);
  
  if (brand13Recs && brand13Recs.length > 0) {
    // Get product and trend details
    const productIds = brand13Recs.map(r => r.product_id);
    const trendIds = brand13Recs.map(r => r.matched_trend_id).filter(id => id !== null);
    
    const { data: products } = await supabase
      .from('products')
      .select('product_id, product_name, clothing_articles')
      .in('product_id', productIds);
    
    const { data: trends } = await supabase
      .from('trends')
      .select('*')
      .in('trend_id', trendIds);
    
    const productMap = new Map(products?.map(p => [p.product_id, p]) || []);
    const trendMap = new Map(trends?.map(t => [t.trend_id, t]) || []);
    
    console.log('=== CURRENT BAD RECOMMENDATIONS (Brand 13) ===\n');
    
    brand13Recs.forEach((rec, i) => {
      const product = productMap.get(rec.product_id);
      const trend = trendMap.get(rec.matched_trend_id);
      
      if (product) {
        console.log(`${i + 1}. [Rec ID: ${rec.recommendation_id}]`);
        console.log(`   Product: "${product.product_name}"`);
        console.log(`   Product Articles: [${product.clothing_articles?.join(', ') || 'NONE'}]`);
        
        if (trend) {
          console.log(`   Trend: "${trend.trend_name}"`);
          console.log(`   Trend Articles: [${trend.clothing_articles?.join(', ') || 'NONE'}]`);
          console.log(`   Is Fashion Trend: ${isFashionTrend(trend.trend_name, trend.trend_description)}`);
        } else {
          console.log(`   Trend: NOT FOUND (ID: ${rec.matched_trend_id})`);
        }
        
        console.log(`   Alignment Score: ${rec.alignment_score}%`);
        console.log(`   Reasons: ${rec.recommendation_reasons?.split('\n')[0] || 'N/A'}`);
        console.log('');
      }
    });
  }
  
  // 2. Analyze all products without clothing articles
  const { count: productsNoArticles } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .or('clothing_articles.is.null,clothing_articles.eq.{}');
  
  const { count: totalProducts } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n=== PRODUCT ANALYSIS ===');
  console.log(`Products without clothing articles: ${productsNoArticles} out of ${totalProducts} (${(productsNoArticles/totalProducts*100).toFixed(1)}%)`);
  
  // 3. Analyze trends without clothing articles
  const { count: trendsNoArticles } = await supabase
    .from('trends')
    .select('*', { count: 'exact', head: true })
    .or('clothing_articles.is.null,clothing_articles.eq.{}');
  
  const { count: totalTrends } = await supabase
    .from('trends')
    .select('*', { count: 'exact', head: true });
  
  console.log(`\nTrends without clothing articles: ${trendsNoArticles} out of ${totalTrends} (${(trendsNoArticles/totalTrends*100).toFixed(1)}%)`);
  
  // 4. Find non-fashion trends
  const { data: allTrends } = await supabase
    .from('trends')
    .select('trend_id, trend_name, trend_description')
    .limit(500);
  
  const nonFashionTrends = allTrends?.filter(t => !isFashionTrend(t.trend_name, t.trend_description)) || [];
  
  console.log(`\n=== NON-FASHION TRENDS ===`);
  console.log(`Found ${nonFashionTrends.length} non-fashion trends out of ${allTrends?.length || 0} analyzed\n`);
  
  nonFashionTrends.slice(0, 10).forEach(t => {
    console.log(`- "${t.trend_name}" (ID: ${t.trend_id})`);
  });
  
  // 5. Show the solution
  console.log('\n\n=== SOLUTION PLAN ===\n');
  console.log('1. DELETE non-fashion trends from the trends table');
  console.log('2. DELETE all recommendations that have no clothing article matches');
  console.log('3. UPDATE trend scraping to validate fashion trends before inserting');
  console.log('4. UPDATE recommendation generation to enforce strict clothing article matching');
  console.log('5. POPULATE missing clothing articles for products and trends');
  
  // Return data for fixing
  return {
    nonFashionTrendIds: nonFashionTrends.map(t => t.trend_id),
    productsNoArticles,
    trendsNoArticles
  };
}

function isFashionTrend(name, description) {
  if (!name) return false; // Handle undefined/null names
  
  const nonFashionKeywords = [
    'retail strategy', 'omnichannel', 'marketing strategy', 'business model',
    'technology platform', 'digital transformation', 'sales channel',
    'customer journey', 'supply chain', 'inventory management',
    'e-commerce platform', 'social media strategy', 'influencer marketing',
    'data analytics', 'customer experience', 'retail technology',
    'relatable fashion style' // Too vague
  ];
  
  const text = `${name} ${description || ''}`.toLowerCase();
  
  // Check if it contains non-fashion keywords
  const hasNonFashionKeywords = nonFashionKeywords.some(keyword => text.includes(keyword));
  
  // Check if it's too vague
  const isVague = name.match(/^(relatable|general|basic|simple|modern|contemporary)\s+(fashion|style|trend)$/i);
  
  return !hasNonFashionKeywords && !isVague;
}

analyzeAndFixIssues().catch(console.error); 