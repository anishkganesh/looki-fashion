import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface MarisaProduct {
  idProduct: string
  styleId: string
  title: string
  lowestPrice: {
    value: number
    currencyIso: string
  }
  colors: Array<{
    name: string
    hexadecimal: string
  }>
  images: Array<{
    url: string
  }>
}

interface MarisaAPIResponse {
  products: MarisaProduct[]
  totalNumberOfResults: string
  currentPage: string
}

// Helper function to generate random revenue data
function generateRevenueData() {
  const baseRevenue = Math.random() * 50000 + 5000 // $5,000 to $55,000
  const units = Math.floor(baseRevenue / (Math.random() * 200 + 50)) // Random price per unit
  
  return {
    revenue_last_30d: Math.round(baseRevenue),
    revenue_last_90d: Math.round(baseRevenue * 2.5),
    units_sold_last_30d: units,
    units_sold_last_90d: Math.round(units * 2.5),
    conversion_rate: Math.random() * 0.05 + 0.01, // 1% to 6%
    inventory_turnover: Math.random() * 3 + 0.5, // 0.5 to 3.5
    sell_through_rate: Math.random() * 0.7 + 0.1, // 10% to 80%
    margin_percentage: Math.random() * 0.4 + 0.2, // 20% to 60%
  }
}

// Helper function to extract category from product name
function extractCategory(productName: string): string {
  const name = productName.toLowerCase()
  
  if (name.includes('calça') || name.includes('jeans') || name.includes('legging')) return 'bottoms/pants'
  if (name.includes('blusa') || name.includes('camisa') || name.includes('camiseta') || name.includes('top')) return 'tops/shirts'
  if (name.includes('vestido')) return 'dresses'
  if (name.includes('saia')) return 'bottoms/skirts'
  if (name.includes('casaco') || name.includes('jaqueta') || name.includes('blazer')) return 'outerwear/jackets'
  if (name.includes('short')) return 'bottoms/shorts'
  if (name.includes('macacão') || name.includes('macaquinho')) return 'jumpsuits'
  if (name.includes('conjunto')) return 'sets'
  
  return 'apparel/other'
}

async function fetchMarisaProducts(page: number = 0, pageSize: number = 100): Promise<MarisaAPIResponse> {
  const url = `https://api.marisa.com.br/marisaomniwebservices/v2/marisa/products/category/roupas/marketplace?currentPage=${page}&pageSize=${pageSize}&sort=newOnStore&query=%3AnewOnStore%3Amarketplace%3Afalse`
  
  const response = await fetch(url, {
    headers: {
      'Cookie': 'az_asm=zVKnDJzmEkPSuZbXc4Lc0/E/2cMwoDGjlGBkDktnWWmaLh1IuRUt+SlwmljSRytBqc4Ea0Ww4VeW2utM; az_botm=4705375d8326c4624041c3c97647f452'
    }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.statusText}`)
  }
  
  return response.json()
}

async function syncMarisaProducts(brandId: number, limit: number = 2000) {
  console.log(`Starting Marisa product sync for brand ${brandId}...`)
  
  let totalSynced = 0
  let page = 0
  const pageSize = 100
  const productsToSync: any[] = []
  
  try {
    // Fetch products until we reach the limit
    while (totalSynced < limit) {
      console.log(`Fetching page ${page + 1}...`)
      const response = await fetchMarisaProducts(page, pageSize)
      
      if (!response.products || response.products.length === 0) {
        console.log('No more products to fetch')
        break
      }
      
      // Transform Marisa products to our format
      const transformedProducts = response.products.map(product => {
        const revenueData = generateRevenueData()
        const category = extractCategory(product.title)
        
        return {
          brand_id: brandId,
          variant_sku: product.idProduct,
          product_name: product.title.trim(),
          category: category,
          category_hierarchy: `apparel/${category}`,
          current_price: product.lowestPrice.value,
          original_price: product.lowestPrice.value * (1 + Math.random() * 0.3), // Random markup
          currency: product.lowestPrice.currencyIso,
          current_inventory_level: Math.floor(Math.random() * 500 + 50), // 50-550 units
          low_stock_threshold: 20,
          color: product.colors?.[0]?.name || 'N/A',
          size: 'Various',
          material: 'Cotton blend', // Default as not provided by API
          is_active: true,
          images: product.images?.map(img => img.url) || [],
          attributes: {
            colors: product.colors?.map(c => ({ name: c.name, hex: c.hexadecimal })) || [],
            style_id: product.styleId,
            marisa_id: product.idProduct
          },
          demographics: {
            gender: product.title.toLowerCase().includes('feminina') ? 'female' : 
                   product.title.toLowerCase().includes('masculina') ? 'male' : 'unisex',
            age_range: '18-45'
          },
          ...revenueData,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      })
      
      productsToSync.push(...transformedProducts)
      totalSynced += transformedProducts.length
      page++
      
      // Stop if we've reached the limit
      if (totalSynced >= limit) {
        productsToSync.splice(limit) // Trim to exact limit
        break
      }
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log(`Fetched ${productsToSync.length} products. Starting database sync...`)
    
    // Insert products in batches
    const batchSize = 50
    let inserted = 0
    
    for (let i = 0; i < productsToSync.length; i += batchSize) {
      const batch = productsToSync.slice(i, i + batchSize)
      
      const { data, error } = await supabase
        .from('products')
        .upsert(batch, {
          onConflict: 'brand_id,variant_sku',
          ignoreDuplicates: false
        })
        .select()
      
      if (error) {
        console.error(`Error inserting batch ${i / batchSize + 1}:`, error)
        continue
      }
      
      inserted += data?.length || 0
      console.log(`Inserted batch ${i / batchSize + 1} (${inserted}/${productsToSync.length} products)`)
      
      // Add delay between batches
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    console.log(`\nSync completed! Total products synced: ${inserted}`)
    
    // Update brand's last sync time
    await supabase
      .from('brands')
      .update({ 
        last_catalog_sync: new Date().toISOString(),
        catalog_source: 'marisa_api'
      })
      .eq('brand_id', brandId)
    
  } catch (error) {
    console.error('Error during sync:', error)
    throw error
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2)
  const brandId = args[0] ? parseInt(args[0]) : null
  const limit = args[1] ? parseInt(args[1]) : 2000
  
  if (!brandId) {
    console.error('Please provide a brand ID as the first argument')
    console.error('Usage: npm run sync-marisa <brand_id> [limit]')
    console.error('Example: npm run sync-marisa 1 2000')
    process.exit(1)
  }
  
  console.log(`Syncing Marisa products for brand ${brandId} (limit: ${limit})...`)
  
  try {
    await syncMarisaProducts(brandId, limit)
    console.log('Sync completed successfully!')
  } catch (error) {
    console.error('Sync failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

export { syncMarisaProducts }