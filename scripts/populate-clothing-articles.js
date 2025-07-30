const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Clothing article extraction patterns
const CLOTHING_PATTERNS = {
  // Tops
  'shirts': /\b(shirt|blouse|top|tee|t-shirt|polo|henley|tunic|cami|camisole|tank)\b/i,
  't-shirts': /\b(t-shirt|tee|graphic tee|v-neck|crew neck|scoop neck)\b/i,
  'blouses': /\b(blouse|silk top|chiffon|button-up|button down)\b/i,
  'sweaters': /\b(sweater|cardigan|pullover|jumper|knit|turtleneck)\b/i,
  'hoodies': /\b(hoodie|hooded|sweatshirt|fleece)\b/i,
  
  // Bottoms
  'pants': /\b(pant|trouser|chino|cargo|palazzo|jogger|sweatpant|track pant)\b/i,
  'jeans': /\b(jean|denim|skinny|straight|bootcut|flare|boyfriend|mom jean)\b/i,
  'shorts': /\b(short|bermuda|board short|bike short|athletic short)\b/i,
  'skirts': /\b(skirt|mini|midi|maxi|pencil|a-line|pleated|wrap skirt)\b/i,
  
  // Dresses
  'dresses': /\b(dress|gown|sundress|cocktail|evening|maxi dress|mini dress|shift)\b/i,
  
  // Outerwear
  'jackets': /\b(jacket|blazer|bomber|denim jacket|leather jacket|windbreaker|anorak)\b/i,
  'coats': /\b(coat|overcoat|trench|parka|peacoat|duffle)\b/i,
  
  // Footwear
  'shoes': /\b(shoe|sneaker|oxford|loafer|pump|heel|flat|sandal|boot|bootie)\b/i,
  'sneakers': /\b(sneaker|trainer|running shoe|athletic shoe|tennis shoe)\b/i,
  
  // Accessories
  'bags': /\b(bag|purse|handbag|tote|clutch|backpack|satchel|crossbody)\b/i,
  'accessories': /\b(belt|scarf|hat|cap|beanie|glove|tie|bow tie|watch|jewelry)\b/i,
  
  // Underwear
  'underwear': /\b(underwear|panty|brief|boxer|bra|lingerie|shapewear|thermal)\b/i,
  'swimwear': /\b(swimsuit|bikini|tankini|swim trunk|board short|one-piece)\b/i
};

function extractClothingArticles(text) {
  const articles = new Set();
  
  if (!text) return [];
  
  const lowerText = text.toLowerCase();
  
  // Check each pattern
  for (const [article, pattern] of Object.entries(CLOTHING_PATTERNS)) {
    if (pattern.test(lowerText)) {
      articles.add(article);
    }
  }
  
  return Array.from(articles);
}

async function populateProductArticles() {
  console.log('=== POPULATING PRODUCT CLOTHING ARTICLES ===\n');
  
  // Get products without clothing articles
  const { data: products } = await supabase
    .from('products')
    .select('product_id, product_name, category_hierarchy, description')
    .or('clothing_articles.is.null,clothing_articles.eq.{}')
    .limit(1000);
  
  console.log(`Found ${products?.length || 0} products without clothing articles\n`);
  
  let updated = 0;
  
  for (const product of products || []) {
    const text = `${product.product_name} ${product.category_hierarchy || ''} ${product.description || ''}`;
    const articles = extractClothingArticles(text);
    
    if (articles.length > 0) {
      const { error } = await supabase
        .from('products')
        .update({ clothing_articles: articles })
        .eq('product_id', product.product_id);
      
      if (!error) {
        updated++;
        console.log(`Updated "${product.product_name}" with: [${articles.join(', ')}]`);
      } else {
        console.error(`Error updating product ${product.product_id}:`, error);
      }
    }
  }
  
  console.log(`\nUpdated ${updated} products with clothing articles`);
}

async function populateTrendArticles() {
  console.log('\n\n=== POPULATING TREND CLOTHING ARTICLES ===\n');
  
  // Get trends without clothing articles
  const { data: trends } = await supabase
    .from('trends')
    .select('trend_id, trend_identifier, trend_description')
    .or('clothing_articles.is.null,clothing_articles.eq.{}')
    .limit(1000);
  
  console.log(`Found ${trends?.length || 0} trends without clothing articles\n`);
  
  let updated = 0;
  
  for (const trend of trends || []) {
    const text = `${trend.trend_identifier?.replace(/-/g, ' ')} ${trend.trend_description || ''}`;
    const articles = extractClothingArticles(text);
    
    if (articles.length > 0) {
      const { error } = await supabase
        .from('trends')
        .update({ clothing_articles: articles })
        .eq('trend_id', trend.trend_id);
      
      if (!error) {
        updated++;
        console.log(`Updated "${trend.trend_identifier}" with: [${articles.join(', ')}]`);
      } else {
        console.error(`Error updating trend ${trend.trend_id}:`, error);
      }
    }
  }
  
  console.log(`\nUpdated ${updated} trends with clothing articles`);
}

async function main() {
  try {
    await populateProductArticles();
    await populateTrendArticles();
    
    console.log('\n\n=== POPULATION COMPLETE ===');
    
    // Show final stats
    const { count: productsWithArticles } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .not('clothing_articles', 'is', null)
      .not('clothing_articles', 'eq', {});
    
    const { count: trendsWithArticles } = await supabase
      .from('trends')
      .select('*', { count: 'exact', head: true })
      .not('clothing_articles', 'is', null)
      .not('clothing_articles', 'eq', {});
    
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    const { count: totalTrends } = await supabase
      .from('trends')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\nProducts with articles: ${productsWithArticles} / ${totalProducts} (${(productsWithArticles/totalProducts*100).toFixed(1)}%)`);
    console.log(`Trends with articles: ${trendsWithArticles} / ${totalTrends} (${(trendsWithArticles/totalTrends*100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main(); 