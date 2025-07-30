const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function analyzeRecommendations() {
  // Get recommendations with high scores
  const { data: recs, error } = await supabase
    .from('recommendations')
    .select('recommendation_id, product_id, matched_trend_id, alignment_score, confidence_score, brand_id, recommendation_reasons')
    .eq('is_active', true)
    .not('matched_trend_id', 'is', null)
    .order('alignment_score', { ascending: false })
    .limit(200);
  
  if (error) {
    console.log('Error fetching recommendations:', error);
    return;
  }
  
  console.log(`Analyzing ${recs?.length || 0} recommendations...\n`);
  
  if (!recs?.length) {
    console.log('No recommendations found!');
    return;
  }
  
  // Get unique product and trend IDs
  const productIds = [...new Set(recs.map(r => r.product_id))];
  const trendIds = [...new Set(recs.map(r => r.matched_trend_id))];
  
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
  
  // Analyze matches
  const badMatches = [];
  const goodMatches = [];
  
  recs.forEach(r => {
    const product = productMap.get(r.product_id);
    const trend = trendMap.get(r.matched_trend_id);
    
    if (product && trend) {
      const productArticles = product.clothing_articles || [];
      const trendArticles = trend.clothing_articles || [];
      const hasArticleMatch = productArticles.length > 0 && trendArticles.length > 0 && 
                             productArticles.some(pa => trendArticles.includes(pa));
      
      // Check if it's a fashion trend
      const trendNameLower = trend.trend_name.toLowerCase();
      const trendDescLower = (trend.trend_description || '').toLowerCase();
      
      const nonFashionKeywords = [
        'retail strategy', 'omnichannel', 'marketing strategy', 'business model',
        'technology platform', 'digital transformation', 'sales channel',
        'customer journey', 'supply chain', 'inventory management',
        'e-commerce platform', 'social media strategy', 'influencer marketing',
        'data analytics', 'customer experience', 'retail technology'
      ];
      
      const isNonFashion = nonFashionKeywords.some(keyword => 
        trendNameLower.includes(keyword) || trendDescLower.includes(keyword)
      );
      
      const isVague = /^(relatable|general|basic|simple|modern|contemporary)\s+(fashion|style|trend)$/i.test(trend.trend_name);
      
      const issues = [];
      if (!hasArticleMatch && productArticles.length > 0 && trendArticles.length > 0) {
        issues.push('Article mismatch');
      }
      if (isNonFashion) issues.push('Non-fashion trend');
      if (isVague) issues.push('Vague trend name');
      if (productArticles.length === 0) issues.push('No product articles');
      if (trendArticles.length === 0) issues.push('No trend articles');
      
      // Check for specific bad matches from the image
      const isBadMatch = 
        (product.product_name.includes('Blouse') && trend.trend_name.includes('Jacket')) ||
        (product.product_name.includes('Jeans') && trend.trend_name.includes('Retail Strategy')) ||
        (trend.trend_name === 'Relatable Fashion Style');
      
      if (isBadMatch) issues.push('Known bad match');
      
      const match = {
        recommendationId: r.recommendation_id,
        product: product.product_name,
        productId: product.product_id,
        trend: trend.trend_name,
        trendId: trend.trend_id,
        productArticles,
        trendArticles,
        alignmentScore: r.alignment_score,
        confidenceScore: r.confidence_score,
        brandId: r.brand_id,
        reasons: r.recommendation_reasons,
        issues
      };
      
      if (issues.length > 0) {
        badMatches.push(match);
      } else {
        goodMatches.push(match);
      }
    }
  });
  
  // Sort bad matches by score (highest first to see worst offenders)
  badMatches.sort((a, b) => b.alignmentScore - a.alignmentScore);
  
  // Show bad matches
  console.log('=== BAD MATCHES ===');
  console.log(`Found ${badMatches.length} problematic recommendations:\n`);
  
  badMatches.slice(0, 30).forEach((match, i) => {
    console.log(`${i + 1}. [ID: ${match.recommendationId}] "${match.product}" → "${match.trend}"`);
    console.log(`   Scores: Alignment ${match.alignmentScore}%, Confidence ${match.confidenceScore}%`);
    console.log(`   Product: [${match.productArticles.join(', ') || 'NONE'}]`);
    console.log(`   Trend: [${match.trendArticles.join(', ') || 'NONE'}]`);
    console.log(`   Issues: ${match.issues.join(', ')}`);
    if (match.reasons) {
      console.log(`   Reasons: ${match.reasons.split('\n')[0]}...`);
    }
    console.log('');
  });
  
  // Show some good matches for comparison
  console.log('\n=== GOOD MATCHES (for comparison) ===');
  console.log(`Found ${goodMatches.length} valid recommendations:\n`);
  
  goodMatches.slice(0, 5).forEach((match, i) => {
    console.log(`${i + 1}. "${match.product}" → "${match.trend}"`);
    console.log(`   Alignment: ${match.alignmentScore}%`);
    console.log(`   Product: [${match.productArticles.join(', ')}]`);
    console.log(`   Trend: [${match.trendArticles.join(', ')}]\n`);
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
  Object.entries(issueCount)
    .sort((a, b) => b[1] - a[1])
    .forEach(([issue, count]) => {
      console.log(`- ${issue}: ${count} occurrences`);
    });
  
  // Show specific bad trend examples
  const badTrendNames = [...new Set(badMatches.map(m => m.trend))];
  console.log('\nMost common bad trends:');
  const trendCounts = {};
  badMatches.forEach(m => {
    trendCounts[m.trend] = (trendCounts[m.trend] || 0) + 1;
  });
  Object.entries(trendCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([trend, count]) => {
      console.log(`- "${trend}": ${count} bad matches`);
    });
}

analyzeRecommendations().catch(console.error); 