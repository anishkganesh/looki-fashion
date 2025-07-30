const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Clothing patterns for extraction
const CLOTHING_PATTERNS = {
  'dresses': /\b(dress|vestido|vestidos)\b/i,
  'shirts': /\b(shirt|camisa|camisas|camiseta)\b/i,
  'blouses': /\b(blouse|blusa|blusas|top|tops)\b/i,
  'pants': /\b(pant|pants|calça|calças|trouser)\b/i,
  'jeans': /\b(jean|jeans|denim)\b/i,
  'skirts': /\b(skirt|saia|saias)\b/i,
  'shorts': /\b(short|shorts|bermuda)\b/i,
  'jackets': /\b(jacket|jaqueta|casaco|blazer)\b/i,
  'coats': /\b(coat|sobretudo|casaco)\b/i,
  'sweaters': /\b(sweater|suéter|pulôver|moletom)\b/i,
  'hoodies': /\b(hoodie|moletom com capuz)\b/i,
  'leggings': /\b(legging|leggings|calça legging)\b/i,
  'underwear': /\b(underwear|calcinha|calcinhas|cueca|sutiã|sutia|lingerie)\b/i,
  'socks': /\b(sock|socks|meia|meias)\b/i,
  'accessories': /\b(accessory|accessories|acessório|sunglasses|óculos|cinto|belt)\b/i,
  'swimwear': /\b(swimwear|biquíni|bikini|maiô|swimsuit)\b/i,
  'activewear': /\b(activewear|sportswear|fitness|gym)\b/i,
  'sleepwear': /\b(sleepwear|pijama|pajama|camisola)\b/i
};

function extractClothingArticles(productName, description, category) {
  const articles = new Set();
  const fullText = `${productName} ${description} ${category}`.toLowerCase();
  
  // Check each pattern
  for (const [article, pattern] of Object.entries(CLOTHING_PATTERNS)) {
    if (pattern.test(fullText)) {
      // Map some articles to more standard categories
      if (article === 'underwear' || article === 'socks') {
        articles.add(article);
      } else if (article === 'accessories') {
        articles.add('accessories');
      } else if (article === 'swimwear' || article === 'activewear' || article === 'sleepwear') {
        // These are categories, not specific clothing articles
        if (fullText.includes('legging')) articles.add('leggings');
        else if (fullText.includes('short')) articles.add('shorts');
        else if (fullText.includes('top') || fullText.includes('blusa')) articles.add('tops');
        else if (fullText.includes('biquíni') || fullText.includes('bikini')) articles.add('swimwear');
      } else {
        articles.add(article);
      }
    }
  }
  
  // Special handling for Portuguese terms
  if (/\b(calcinhas?|cuecas?|sutiãs?|sutias?)\b/i.test(fullText)) {
    articles.add('underwear');
  }
  if (/\b(meias?)\b/i.test(fullText) && !/\bmeia[\s-]calça/i.test(fullText)) {
    articles.add('socks');
  }
  if (/\bmeia[\s-]calça/i.test(fullText)) {
    articles.add('hosiery');
  }
  
  return Array.from(articles);
}

async function populateClothingArticles() {
  console.log('Fetching Marisa products with empty clothing articles...\n');
  
  try {
    // Fetch products with empty clothing articles
    const { data: products, error } = await supabase
      .from('products')
      .select('product_id, product_name, description, category_hierarchy')
      .eq('brand_id', 13)
      .eq('is_active', true)
      .or('clothing_articles.is.null,clothing_articles.eq.{}');
    
    if (error) {
      console.error('Error fetching products:', error);
      return;
    }
    
    console.log(`Found ${products.length} products to update\n`);
    
    let updated = 0;
    const batchSize = 50;
    
    // Process in batches
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const updates = [];
      
      for (const product of batch) {
        const articles = extractClothingArticles(
          product.product_name || '',
          product.description || '',
          product.category_hierarchy || ''
        );
        
        if (articles.length > 0) {
          updates.push({
            product_id: product.product_id,
            clothing_articles: articles
          });
        }
      }
      
      if (updates.length > 0) {
        // Update products
        for (const update of updates) {
          const { error: updateError } = await supabase
            .from('products')
            .update({ clothing_articles: update.clothing_articles })
            .eq('product_id', update.product_id);
          
          if (updateError) {
            console.error(`Error updating product ${update.product_id}:`, updateError);
          } else {
            updated++;
          }
        }
        
        console.log(`Progress: ${Math.min(i + batchSize, products.length)}/${products.length} processed, ${updated} updated`);
      }
    }
    
    console.log(`\nCompleted! Updated ${updated} products with clothing articles.`);
    
    // Verify the update
    const { data: verifyData } = await supabase
      .from('products')
      .select('product_id')
      .eq('brand_id', 13)
      .eq('is_active', true)
      .not('clothing_articles', 'is', null)
      .gt('cardinality(clothing_articles)', 0);
    
    console.log(`\nVerification: ${verifyData?.length || 0} products now have clothing articles.`);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run the script
populateClothingArticles(); 