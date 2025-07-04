const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Marisa API credentials
const MARISA_API_CLIENT_ID = process.env.MARISA_API_CLIENT_ID || 'marisa_sellable_products_api';
const MARISA_API_CLIENT_SECRET = process.env.MARISA_API_CLIENT_SECRET || 'SQ9*e2Z@';
const MARISA_API_USERNAME = process.env.MARISA_API_USERNAME || 'marisa.api.products.sellable@marisa.com.br';
const MARISA_API_PASSWORD = process.env.MARISA_API_PASSWORD || 'k8nDWLqPzIEt7Adb';

// Keywords to filter out undergarments and non-clothing items
const UNDERGARMENT_KEYWORDS = [
  'calcinha', 'cueca', 'sutiã', 'sutia', 'lingerie', 'intima', 'íntima',
  'underwear', 'panty', 'panties', 'bra', 'brief', 'boxer',
  'cinta', 'modelador', 'corpete', 'espartilho', 'camisola',
  'baby doll', 'babydoll', 'negligê', 'neglige', 'pijama', 'pyjama',
  'meia', 'meias', 'socks', 'hosiery', 'tights', 'pantyhose',
  'fio-40', 'fio-20', 'fio-10', 'meia-calca'
];

// Keywords for clothing we want to include
const CLOTHING_KEYWORDS = [
  'vestido', 'blusa', 'camisa', 'camiseta', 'calça', 'jeans', 'saia',
  'shorts', 'bermuda', 'jaqueta', 'casaco', 'blazer', 'cardigan',
  'moletom', 'regata', 'cropped', 'body', 'macacão', 'jardineira',
  'kimono', 'poncho', 'colete', 'suéter', 'tricot', 'malha'
];

// Function to check if product is undergarment or non-clothing
function isUndergarment(product) {
  const searchText = `${product.name} ${product.categories.map(c => c.code).join(' ')}`.toLowerCase();
  return UNDERGARMENT_KEYWORDS.some(keyword => searchText.includes(keyword));
}

// Function to check if product is clothing
function isClothing(product) {
  const searchText = `${product.name} ${product.categories.map(c => c.code).join(' ')}`.toLowerCase();
  // If it contains clothing keywords, it's likely clothing
  // If it doesn't contain any clothing keywords and doesn't contain undergarment keywords, we'll include it
  return CLOTHING_KEYWORDS.some(keyword => searchText.includes(keyword)) || 
         !UNDERGARMENT_KEYWORDS.some(keyword => searchText.includes(keyword));
}

// Function to get Marisa access token
async function getMarisaAccessToken() {
  const authUrl = 'https://api.marisa.com.br/authorizationserver/oauth/token';
  
  const authData = new URLSearchParams({
    client_id: MARISA_API_CLIENT_ID,
    client_secret: MARISA_API_CLIENT_SECRET,
    grant_type: 'password',
    username: MARISA_API_USERNAME,
    password: MARISA_API_PASSWORD
  });

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: authData
  });

  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

// Function to fetch Marisa products
async function fetchMarisaProducts(accessToken, page = 0, pageSize = 500) {
  const productsUrl = 'https://api.marisa.com.br/marisaomniwebservices/v2/marisa/sellable/products';
  
  const url = new URL(productsUrl);
  url.searchParams.append('page', page.toString());
  url.searchParams.append('pageSize', pageSize.toString());

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.status}`);
  }

  return response.json();
}

// Function to save products to Supabase
async function saveProductsToSupabase(products, brandId) {
  let successCount = 0;
  let failedCount = 0;
  
  // Process each product individually to avoid duplicate conflicts
  for (const product of products) {
    const variantSku = `${product.code}-${product.selectedColorName || 'DEFAULT'}-${product.selectedSizeName || 'U'}`;
    
    const productData = {
      brand_id: brandId,
      product_code: product.code,
      variant_sku: variantSku,
      api_source: 'marisa_api',
      product_name: product.name,
      description: `${product.name} - ${product.selectedColorName || 'Cor padrão'} - Tamanho: ${product.selectedSizeName || 'U'}`,
      category_hierarchy: product.categories.map(c => c.code).join('/'),
      color: product.selectedColorName || 'Padrão',
      size: product.selectedSizeName || 'U',
      current_price: product.price.value,
      original_price: product.price.value,
      discount_percentage: 0,
      currency: product.price.currencyIso,
      stock_status: 'InStock',
      current_inventory_level: 100, // Default value
      images: [],
      api_data: {
        brand: product.brand,
        seller: product.seller,
        url: `https://www.marisa.com.br${product.url}`,
        categories: product.categories
      },
      is_active: true,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('products')
      .upsert(productData, {
        onConflict: 'brand_id,product_code,variant_sku',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      failedCount++;
    } else {
      successCount++;
    }
  }

  return { success: successCount, failed: failedCount };
}

// Function to format price in BRL
function formatPrice(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

// Function to truncate text
function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Function to display products in table
function displayProductsTable(products) {
  console.log('\n' + '='.repeat(150));
  console.log('MARISA PRODUCTS CATALOG');
  console.log('='.repeat(150));
  
  // Header
  console.log(
    'SKU'.padEnd(15) + '│' +
    'Name'.padEnd(40) + '│' +
    'Price'.padEnd(12) + '│' +
    'Color'.padEnd(15) + '│' +
    'Size'.padEnd(8) + '│' +
    'Category'.padEnd(25) + '│' +
    'Brand'.padEnd(15) + '│' +
    'Stock'.padEnd(10)
  );
  console.log('─'.repeat(150));
  
  // Rows
  products.forEach(product => {
    console.log(
      truncate(product.code, 14).padEnd(15) + '│' +
      truncate(product.name, 39).padEnd(40) + '│' +
      formatPrice(product.price.value).padEnd(12) + '│' +
      truncate(product.selectedColorName || 'N/A', 14).padEnd(15) + '│' +
      truncate(product.selectedSizeName || 'N/A', 7).padEnd(8) + '│' +
      truncate(product.categories[0]?.code || 'N/A', 24).padEnd(25) + '│' +
      truncate(product.brand.name, 14).padEnd(15) + '│' +
      'InStock'.padEnd(10)
    );
  });
  
  console.log('='.repeat(150));
}

// Main function
async function main() {
  console.log('🚀 Starting Marisa Products Import Test...\n');
  
  try {
    // Import node-fetch dynamically
    const { default: fetch } = await import('node-fetch');
    global.fetch = fetch;
    // Check environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase credentials in environment variables');
      process.exit(1);
    }
    
    // Get or create Marisa brand
    let brandId;
    
    // First check if Marisa brand exists
    const { data: existingBrand } = await supabase
      .from('brands')
      .select('brand_id')
      .eq('brand_name', 'Marisa Lojas')
      .single();
    
    if (existingBrand) {
      brandId = existingBrand.brand_id;
      console.log(`📦 Using existing Marisa brand ID: ${brandId}`);
    } else {
      // Create Marisa brand if it doesn't exist
      const { data: newBrand, error: brandError } = await supabase
        .from('brands')
        .insert({
          brand_name: 'Marisa Lojas',
          brand_code: 'MARISA',
          description: 'Brazilian fashion retail chain',
          category: 'fashion',
          website: 'https://www.marisa.com.br',
          founded_year: 1948,
          country: 'BR',
          is_active: true,
          has_catalog_integrated: true,
          catalog_integrated_at: new Date().toISOString(),
          target_age_min: 18,
          target_age_max: 65,
          target_gender: 'female',
          target_locations: ['Brazil', 'São Paulo', 'Rio de Janeiro'],
          target_income_level: 'medium',
          target_lifestyle: ['fashion', 'casual', 'trendy'],
          target_interests: ['fashion', 'clothing', 'style']
        })
        .select()
        .single();
      
      if (brandError) {
        console.error('❌ Error creating Marisa brand:', brandError);
        process.exit(1);
      }
      
      brandId = newBrand.brand_id;
      console.log(`📦 Created new Marisa brand with ID: ${brandId}`);
    }
    
    // Get access token
    console.log('🔐 Authenticating with Marisa API...');
    const accessToken = await getMarisaAccessToken();
    console.log('✅ Authentication successful\n');
    
    // Fetch products
    console.log('📥 Fetching products from Marisa API...');
    const pageSize = 500;
    const targetProducts = 2000; // 2k products for testing
    const maxPages = Math.ceil(targetProducts / pageSize);
    
    let allProducts = [];
    let totalFetched = 0;
    
    console.log(`📊 Target: ${targetProducts.toLocaleString()} products (${maxPages} pages)`);
    console.log('⏳ Fetching all products...\n');
    
    for (let page = 0; page < maxPages && totalFetched < targetProducts; page++) {
      process.stdout.write(`\r📄 Fetching page ${page + 1}/${maxPages}... (${totalFetched.toLocaleString()} products so far)`);
      
      try {
        const response = await fetchMarisaProducts(accessToken, page, pageSize);
        
        // Add ALL products without any filtering
        allProducts = allProducts.concat(response.results);
        totalFetched += response.results.length;
        
        // Stop if no more pages
        if (response.results.length < pageSize) {
          console.log(`\n   Reached end of catalog at page ${page + 1}`);
          break;
        }
      } catch (error) {
        console.error(`\n❌ Error on page ${page + 1}:`, error.message);
        break;
      }
    }
    
    console.log('\n'); // New line after progress
    
    console.log(`\n✅ Fetched ${totalFetched.toLocaleString()} total products\n`);
    
    // Skip saving to Supabase for this test
    console.log('⏭️  Skipping database save for this test run');
    
    // Display ALL products in table
    console.log(`\n📊 Displaying ALL ${allProducts.length} products:`);
    displayProductsTable(allProducts);
    
    // Summary statistics
    console.log('\n📈 Product Catalog Summary:');
    console.log(`   Total products in Marisa API: ${totalFetched.toLocaleString()}`);
    console.log(`   Pages fetched: ${Math.ceil(totalFetched / pageSize)}`);
    console.log(`   Average products per page: ${Math.round(totalFetched / Math.ceil(totalFetched / pageSize))}`);
    
    // Price statistics
    let totalPrice = 0;
    let minPrice = Infinity;
    let maxPrice = 0;
    
    allProducts.forEach(product => {
      const price = product.price.value;
      totalPrice += price;
      minPrice = Math.min(minPrice, price);
      maxPrice = Math.max(maxPrice, price);
    });
    
    console.log('\n💰 Price Statistics:');
    console.log(`   Average price: ${formatPrice(totalPrice / allProducts.length)}`);
    console.log(`   Minimum price: ${formatPrice(minPrice)}`);
    console.log(`   Maximum price: ${formatPrice(maxPrice)}`);
    console.log(`   Price range: ${formatPrice(maxPrice - minPrice)}`);
    
    // Category breakdown
    const categories = {};
    const brands = {};
    
    allProducts.forEach(product => {
      const category = product.categories[0]?.code || 'Uncategorized';
      categories[category] = (categories[category] || 0) + 1;
      
      const brand = product.brand.name;
      brands[brand] = (brands[brand] || 0) + 1;
    });
    
    console.log('\n📂 Top 20 Categories:');
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .forEach(([category, count], index) => {
        const percentage = ((count / totalFetched) * 100).toFixed(1);
        console.log(`   ${(index + 1).toString().padStart(2)}. ${category.padEnd(30)} ${count.toString().padStart(6).toLocaleString()} products (${percentage}%)`);
      });
    
    console.log('\n🏷️  Top Brands:');
    Object.entries(brands)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([brand, count], index) => {
        const percentage = ((count / totalFetched) * 100).toFixed(1);
        console.log(`   ${(index + 1).toString().padStart(2)}. ${brand.padEnd(20)} ${count.toString().padStart(6).toLocaleString()} products (${percentage}%)`);
      });
    
    console.log('\n✨ Marisa product catalog analysis completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main(); 