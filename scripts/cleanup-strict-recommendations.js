const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to check if clothing articles are similar (STRICT MATCHING)
function areArticlesSimilar(article1, article2) {
  // Direct match is always allowed
  if (article1 === article2) return true
  
  // Define VERY strict similarity groups - only truly similar items
  const strictSimilarityGroups = [
    // Denim/Jeans group
    ['jeans', 'denim'],
    
    // Basic tops group (shirts, blouses, but NOT jackets)
    ['shirts', 'blouses'],
    
    // T-shirts and casual tops
    ['t-shirts', 'tees', 'tanks'],
    
    // Bottom pants group
    ['pants', 'trousers'],
    
    // Footwear group
    ['shoes', 'sneakers', 'footwear'],
    
    // Shorts group
    ['shorts', 'bermudas'],
    
    // Skirts group
    ['skirts', 'mini-skirts', 'maxi-skirts'],
    
    // Dresses group
    ['dresses', 'gowns'],
    
    // Underwear group
    ['underwear', 'lingerie', 'bras', 'panties'],
    
    // Socks group
    ['socks', 'hosiery'],
    
    // Accessories group
    ['accessories', 'jewelry', 'bags', 'belts']
  ]
  
  // Check if both articles belong to the same strict group
  for (const group of strictSimilarityGroups) {
    if (group.includes(article1.toLowerCase()) && group.includes(article2.toLowerCase())) {
      return true
    }
  }
  
  // No match found - these are different clothing categories
  return false
}

async function cleanupBadRecommendations() {
  console.log('Starting cleanup of recommendations with strict matching criteria...\n');
  
  try {
    // Fetch all recommendations with their product and trend data
    const { data: recommendations, error } = await supabase
      .from('recommendations')
      .select(`
        recommendation_id,
        product_id,
        matched_trend_id,
        products!inner(product_name, clothing_articles),
        trends!inner(trend_identifier, clothing_articles)
      `)
      .eq('is_active', true);
    
    if (error) {
      console.error('Error fetching recommendations:', error);
      return;
    }
    
    console.log(`Found ${recommendations.length} active recommendations to check\n`);
    
    const toDelete = [];
    let checked = 0;
    
    for (const rec of recommendations) {
      checked++;
      
      const productArticles = rec.products.clothing_articles || [];
      const trendArticles = rec.trends.clothing_articles || [];
      
      // Check if there's any valid match using strict criteria
      let hasValidMatch = false;
      
      if (productArticles.length > 0 && trendArticles.length > 0) {
        hasValidMatch = productArticles.some(pa => 
          trendArticles.some(ta => 
            pa === ta || areArticlesSimilar(pa, ta)
          )
        );
      }
      
      if (!hasValidMatch) {
        toDelete.push({
          id: rec.recommendation_id,
          product: rec.products.product_name,
          trend: rec.trends.trend_identifier,
          productArticles,
          trendArticles
        });
      }
      
      if (checked % 100 === 0) {
        console.log(`Checked ${checked}/${recommendations.length} recommendations...`);
      }
    }
    
    console.log(`\nFound ${toDelete.length} recommendations to delete due to strict matching:\n`);
    
    // Show sample of what will be deleted
    const sampleSize = Math.min(10, toDelete.length);
    for (let i = 0; i < sampleSize; i++) {
      const rec = toDelete[i];
      console.log(`- ${rec.product} (${rec.productArticles.join(', ')}) ← ${rec.trend} (${rec.trendArticles.join(', ')})`);
    }
    
    if (toDelete.length > sampleSize) {
      console.log(`... and ${toDelete.length - sampleSize} more`);
    }
    
    if (toDelete.length === 0) {
      console.log('No recommendations need to be deleted. All are valid!');
      return;
    }
    
    // Delete invalid recommendations in batches
    console.log(`\nDeleting ${toDelete.length} invalid recommendations...`);
    const batchSize = 100;
    let deleted = 0;
    
    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = toDelete.slice(i, i + batchSize);
      const ids = batch.map(r => r.id);
      
      const { error: deleteError } = await supabase
        .from('recommendations')
        .delete()
        .in('recommendation_id', ids);
      
      if (deleteError) {
        console.error(`Error deleting batch ${i}-${i + batch.length}:`, deleteError);
      } else {
        deleted += batch.length;
        console.log(`Deleted ${deleted}/${toDelete.length} recommendations...`);
      }
    }
    
    console.log(`\nCleanup complete! Deleted ${deleted} invalid recommendations.`);
    
    // Verify cleanup
    const { data: remainingRecs } = await supabase
      .from('recommendations')
      .select('recommendation_id')
      .eq('is_active', true);
    
    console.log(`Remaining active recommendations: ${remainingRecs?.length || 0}`);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the cleanup
cleanupBadRecommendations(); 