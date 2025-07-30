const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function analyzeRecommendations() {
  // Get all recommendations
  const { data: recs, count } = await supabase
    .from('recommendations')
    .select('recommendation_id, product_id, trend_id, match_score, brand_id, primary_reason', { count: 'exact' })
    .eq('is_active', true)
    .order('match_score', { ascending: false })
    .limit(100);
  
  console.log(`Total active recommendations: ${count}`);
  console.log(`Analyzing top ${recs?.length || 0} by match score...\n`);
  
  if (!recs?.length) {
    console.log('No recommendations found!');
    return;
  }
  
  // Get unique product and trend IDs
  const productIds = [...new Set(recs.map(r => r.product_id))];
  const trendIds = [...new Set(recs.map(r => r.trend_id))];
  
  // Get details
  const { data: products } = await supabase
    .from('products')
    .select('product_id, product_name, clothing_articles, brand_id')
    .in('product_id', productIds);
    
  const { data: trends } = await supabase
    .from('trends')
    .select('trend_id, trend_name, clothing_articles, trend_description')
    .in('trend_id', trendIds);
  
  const productMap = new Map(products?.map(p => [p.product_id, p]) || []);
  const trendMap = new Map(trends?.map(t => [t.trend_id, t]) || []);
  
  // Analyze bad matches
  const badMatches = [];
  const goodMatches = [];
  
  recs.forEach(r => {
    const product = productMap.get(r.product_id);
    const trend = trendMap.get(r.trend_id);
    
    if (product && trend) {
      const productArticles = product.clothing_articles || [];
      const trendArticles = trend.clothing_articles || [];
      const hasArticleMatch = productArticles.some(pa => trendArticles.includes(pa));
      
      // Check if it's a fashion trend
      const trendNameLower = trend.trend_name.toLowerCase();
      const trendDescLower = (trend.trend_description || '').toLowerCase();
      
      const nonFashionKeywords = [
        'strategy', 'retail', 'omnichannel', 'marketing', 'business',
        'technology', 'digital', 'platform', 'channel', 'commerce',
        'supply chain', 'inventory', 'e-commerce', 'social media',
        'analytics', 'customer experience'
      ];
      
      const isNonFashion = nonFashionKeywords.some(keyword => 
        trendNameLower.includes(keyword) || trendDescLower.includes(keyword)
      );
      
      const isVague = /^(relatable|general|basic|simple|modern|contemporary)\s+(fashion|style|trend)$/i.test(trend.trend_name);
      
      const issues = [];
      if (!hasArticleMatch) issues.push('No article match');
      if (isNonFashion) issues.push('Non-fashion trend');
      if (isVague) issues.push('Vague trend name');
      if (productArticles.length === 0) issues.push('No product articles');
      if (trendArticles.length === 0) issues.push('No trend articles');
      
      const match = {
        product: product.product_name,
        trend: trend.trend_name,
        productArticles,
        trendArticles,
        score: r.match_score,
        reason: r.primary_reason,
        brandId: r.brand_id,
        issues
      };
      
      if (issues.length > 0) {
        badMatches.push(match);
      } else {
        goodMatches.push(match);
      }
    }
  });
  
  // Show bad matches
  console.log('=== BAD MATCHES ===');
  console.log(`Found ${badMatches.length} problematic recommendations:\n`);
  
  badMatches.slice(0, 20).forEach((match, i) => {
    console.log(`${i + 1}. "${match.product}" → "${match.trend}"`);
    console.log(`   Score: ${match.score}%, Brand: ${match.brandId}`);
    console.log(`   Product: [${match.productArticles.join(', ') || 'NONE'}]`);
    console.log(`   Trend: [${match.trendArticles.join(', ') || 'NONE'}]`);
    console.log(`   Issues: ${match.issues.join(', ')}`);
    console.log(`   Reason: ${match.reason || 'N/A'}\n`);
  });
  
  // Show some good matches for comparison
  console.log('\n=== GOOD MATCHES (for comparison) ===');
  console.log(`Found ${goodMatches.length} valid recommendations:\n`);
  
  goodMatches.slice(0, 5).forEach((match, i) => {
    console.log(`${i + 1}. "${match.product}" → "${match.trend}"`);
    console.log(`   Score: ${match.score}%`);
    console.log(`   Product: [${match.productArticles.join(', ')}]`);
    console.log(`   Trend: [${match.trendArticles.join(', ')}]`);
    console.log(`   Reason: ${match.reason || 'N/A'}\n`);
  });
  
  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total analyzed: ${recs.length}`);
  console.log(`Bad matches: ${badMatches.length} (${(badMatches.length / recs.length * 100).toFixed(1)}%)`);
  console.log(`Good matches: ${goodMatches.length} (${(goodMatches.length / recs.length * 100).toFixed(1)}%)`);
  
  // Group issues
  const issueCount = {};
  badMatches.forEach(match => {
    match.issues.forEach(issue => {
      issueCount[issue] = (issueCount[issue] || 0) + 1;
    });
  });
  
  console.log('\nIssue breakdown:');
  Object.entries(issueCount).forEach(([issue, count]) => {
    console.log(`- ${issue}: ${count} occurrences`);
  });
}

analyzeRecommendations().catch(console.error); 