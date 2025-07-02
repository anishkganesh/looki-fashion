import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { determineProductDemographics, generateInventoryMetrics, generateStyleAttributes, generateMaterialAttributes } from '@/lib/product-demographics'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Marisa API types
interface MarisaAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface MarisaPrice {
  currencyIso: string
  value: number
}

interface MarisaBrand {
  uid: string
  name: string
}

interface MarisaSeller {
  companyName: string
  fantasyName: string
}

interface MarisaCategory {
  code: string
}

interface MarisaProduct {
  code: string
  name: string
  brand: MarisaBrand
  price: MarisaPrice
  selectedColorName: string
  selectedSizeName: string
  seller: MarisaSeller
  categories: MarisaCategory[]
  url: string
}

interface MarisaProductsResponse {
  results: MarisaProduct[]
  pagination: {
    totalResults: number
    pageSize: number
    currentPage: number
    totalPages: number
  }
}

// Cache for Marisa access token
let cachedToken: { token: string; expiresAt: number } | null = null

async function getMarisaAccessToken(): Promise<string> {
  // Check if we have a valid cached token
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token
  }

  const authUrl = 'https://api.marisa.com.br/authorizationserver/oauth/token'
  
  const authData = new URLSearchParams({
    client_id: process.env.MARISA_API_CLIENT_ID || 'marisa_sellable_products_api',
    client_secret: process.env.MARISA_API_CLIENT_SECRET || 'SQ9*e2Z@',
    grant_type: 'password',
    username: process.env.MARISA_API_USERNAME || 'marisa.api.products.sellable@marisa.com.br',
    password: process.env.MARISA_API_PASSWORD || 'k8nDWLqPzIEt7Adb'
  })

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: authData
  })

  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.status}`)
  }

  const data: MarisaAuthResponse = await response.json()
  
  // Cache the token with a buffer of 5 minutes before expiry
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 300) * 1000
  }
  
  return data.access_token
}

async function fetchMarisaProducts(accessToken: string, page: number = 0, pageSize: number = 100): Promise<MarisaProductsResponse> {
  const productsUrl = 'https://api.marisa.com.br/marisaomniwebservices/v2/marisa/sellable/products'
  
  const url = new URL(productsUrl)
  url.searchParams.append('page', page.toString())
  url.searchParams.append('pageSize', pageSize.toString())

  console.log(`Fetching URL: ${url.toString()}`)

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error(`API Error Response:`, {
      status: response.status,
      statusText: response.statusText,
      error: errorText
    })
    throw new Error(`Failed to fetch products: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  
  // Validate response structure
  if (!data.results || !Array.isArray(data.results)) {
    console.error('Invalid API response structure:', data)
    throw new Error('Invalid API response: missing results array')
  }
  
  return data
}

function generateChecksum(product: MarisaProduct): string {
  const data = `${product.code}|${product.name}|${product.price.value}|${product.selectedColorName}|${product.selectedSizeName}|${product.categories.map(c => c.code).join(',')}`
  return crypto.createHash('md5').update(data).digest('hex')
}

// Default fields that are AI enhanced (not from API)
const AI_ENHANCED_FIELDS = [
  'revenue_last_30d',
  'units_sold_last_30d',
  'conversion_rate',
  'return_rate',
  'inventory_velocity',
  'days_of_supply',
  'margin_percentage',
  'competitor_price_index',
  'promotion_responsiveness',
  'current_inventory_level'
]

// Increase timeout for large imports
export const maxDuration = 300 // 5 minutes

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    const { importProgressId, brandId, resumeFromPage = 0, productLimit } = await request.json()
    
    if (!importProgressId || !brandId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Get import progress record
    const { data: importProgress } = await supabase
      .from('catalog_import_progress')
      .select('*')
      .eq('id', importProgressId)
      .single()

    // Update import status to processing
    await supabase
      .from('catalog_import_progress')
      .update({ 
        status: 'processing',
        updated_at: new Date().toISOString()
      })
      .eq('id', importProgressId)

    // Get Marisa access token
    const accessToken = await getMarisaAccessToken()

    // First, get the total number of products - use larger page size per API docs
    const pageSize = 500 // API supports up to 500 per page
    const initialData = await fetchMarisaProducts(accessToken, 0, pageSize)
    let totalProducts = initialData.pagination.totalResults
    
    console.log(`Total products available in API: ${totalProducts}`)
    
    // Apply product limit if specified
    if (productLimit && productLimit > 0) {
      totalProducts = Math.min(totalProducts, productLimit)
    }
    
    const totalPages = Math.ceil(totalProducts / pageSize)
    console.log(`Will process ${totalPages} pages with ${pageSize} products per page`)

    // Update total products count
    await supabase
      .from('catalog_import_progress')
      .update({ 
        total_products: totalProducts,
        updated_at: new Date().toISOString()
      })
      .eq('id', importProgressId)

    // Get existing products for comparison
    const { data: existingProducts } = await supabase
      .from('products')
      .select('product_id, product_code, variant_sku, api_checksum')
      .eq('brand_id', brandId)

    const existingProductMap = new Map(
      existingProducts?.map(p => [`${p.product_code}-${p.variant_sku}`, p]) || []
    )

    let processedCount = resumeFromPage * pageSize
    let successCount = 0
    let failedCount = 0
    let createdCount = 0
    let updatedCount = 0
    let skippedCount = 0

    // Process products page by page
    for (let page = resumeFromPage; page < totalPages; page++) {
      try {
        // Check if import was paused or cancelled
        const { data: progressCheck } = await supabase
          .from('catalog_import_progress')
          .select('status')
          .eq('id', importProgressId)
          .single()

        if (progressCheck?.status === 'paused' || progressCheck?.status === 'failed') {
          console.log(`Import ${progressCheck.status}, stopping at page ${page}`)
          break
        }

        // Fetch products for this page with smaller batch
        console.log(`\n=== Fetching page ${page + 1}/${totalPages} ===`)
        console.log(`Expected products on this page: ${Math.min(pageSize, totalProducts - (page * pageSize))}`)
        
        const productsData = await fetchMarisaProducts(accessToken, page, pageSize)
        let products = productsData.results
        
        console.log(`API Response for page ${page}:`, {
          receivedProducts: products.length,
          pagination: productsData.pagination,
          firstProduct: products[0]?.code,
          lastProduct: products[products.length - 1]?.code
        })

        // If we have a product limit, ensure we don't exceed it
        if (productLimit && productLimit > 0) {
          const remainingProducts = totalProducts - processedCount
          if (remainingProducts < products.length) {
            products = products.slice(0, remainingProducts)
          }
        }

        // Deduplicate products by variant SKU before processing
        const seenSkus = new Set<string>()
        const uniqueProducts = products.filter(product => {
          // Normalize color and size to avoid duplicates
          const normalizedColor = (product.selectedColorName || 'DEFAULT').trim().toUpperCase()
          const normalizedSize = (product.selectedSizeName || 'U').trim().toUpperCase()
          const variantSku = `${product.code}-${normalizedColor}-${normalizedSize}`
          
          if (seenSkus.has(variantSku)) {
            console.log(`Skipping duplicate SKU: ${variantSku}`)
            return false
          }
          seenSkus.add(variantSku)
          return true
        })
        
        console.log(`Unique products after deduplication: ${uniqueProducts.length} (from ${products.length})`)

        // Process products in batches - increased for efficiency
        const batchSize = 200 // Increased batch size for faster processing
        for (let i = 0; i < uniqueProducts.length; i += batchSize) {
          const batch = uniqueProducts.slice(i, i + batchSize)
          console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(uniqueProducts.length/batchSize)} on page ${page + 1}`)
          const productUpserts = []

          for (const product of batch) {
            try {
              const checksum = generateChecksum(product)
              // Normalize color and size to match deduplication
              const normalizedColor = (product.selectedColorName || 'DEFAULT').trim().toUpperCase()
              const normalizedSize = (product.selectedSizeName || 'U').trim().toUpperCase()
              const variantSku = `${product.code}-${normalizedColor}-${normalizedSize}`
              const existingProduct = existingProductMap.get(`${product.code}-${variantSku}`)
              
              // Always update products - no skipping to ensure all products are imported
              // This ensures we get all 529k+ products from the API

              // Generate demographics and metrics
              const demographics = determineProductDemographics(
                product.name,
                product.categories.map(c => c.code).join('/'),
                product.price.value,
                product.selectedColorName,
                product.selectedSizeName
              )
              
              const inventoryMetrics = generateInventoryMetrics(
                product.name,
                product.categories.map(c => c.code).join('/'),
                product.price.value
              )
              
              // Ensure all required fields have values
              const productData: any = {
                brand_id: brandId,
                product_code: product.code || `MARISA-${Date.now()}-${i}`,
                variant_sku: variantSku,
                api_source: 'marisa_api',
                
                // Basic info from API - with fallbacks
                product_name: product.name || 'Produto sem nome',
                description: product.name 
                  ? `${product.name} - ${product.selectedColorName || 'Cor padrão'} - Tamanho: ${product.selectedSizeName || 'U'}`
                  : 'Produto importado da API Marisa',
                category_hierarchy: product.categories?.length > 0 
                  ? product.categories.map(c => c.code || 'geral').join('/') 
                  : 'geral/sem-categoria',
                
                // Variant attributes - with defaults
                color: product.selectedColorName || 'Padrão',
                size: product.selectedSizeName || 'U',
                
                // Pricing (from API) - with validation
                current_price: product.price?.value > 0 ? product.price.value : 99.99,
                original_price: product.price?.value > 0 ? product.price.value : 99.99,
                discount_percentage: 0, // Marisa API doesn't provide original price
                currency: product.price?.currencyIso || 'BRL',
                
                // Inventory - using generated metrics
                stock_status: 'InStock',
                current_inventory_level: Math.max(1, Math.floor(inventoryMetrics.current_inventory_level)),
                inventory_velocity: Math.max(0.1, inventoryMetrics.inventory_velocity),
                days_of_supply: Math.max(1, Math.floor(inventoryMetrics.days_of_supply)),
                
                // Sales metrics - using generated metrics with validation
                revenue_last_30d: Math.max(0, inventoryMetrics.revenue_last_30d),
                units_sold_last_30d: Math.max(0, Math.floor(inventoryMetrics.units_sold_last_30d)),
                conversion_rate: Math.max(0.1, Math.min(100, inventoryMetrics.conversion_rate)),
                return_rate: Math.max(0, Math.min(100, inventoryMetrics.return_rate)),
                
                // Financial metrics - with reasonable defaults
                margin_percentage: 35.0,
                competitor_price_index: 1.0,
                promotion_responsiveness: 1.2,
                
                // Complex attributes - ensure they're valid JSON
                images: [],
                style_attributes: generateStyleAttributes(
                  product.name,
                  product.categories?.map(c => c.code || 'geral').join('/') || 'geral',
                  product.selectedColorName || 'Padrão',
                  `${product.name} - ${product.selectedColorName || 'Cor padrão'}`
                ),
                material_attributes: generateMaterialAttributes(
                  product.name,
                  product.categories?.map(c => c.code || 'geral').join('/') || 'geral',
                  product.price?.value > 0 ? product.price.value : 99.99,
                  `${product.name} - ${product.brand?.name || 'Marisa'}`
                ),
                target_demographics: demographics || {
                  target_age_min: 18,
                  target_age_max: 65,
                  target_gender: 'unisex',
                  target_locations: ['Brazil'],
                  target_income_level: 'medium',
                  target_lifestyle: ['general'],
                  target_interests: ['fashion']
                },
                
                // API metadata
                api_data: {
                  brand: product.brand || {},
                  seller: product.seller || {},
                  url: product.url ? `https://www.marisa.com.br${product.url}` : null,
                  categories: product.categories || []
                },
                api_checksum: checksum,
                last_api_sync: new Date().toISOString(),
                
                // Track AI enhanced fields
                ai_enhanced_fields: AI_ENHANCED_FIELDS,
                
                is_active: true,
                created_at: existingProduct ? undefined : new Date().toISOString(),
                updated_at: new Date().toISOString()
              }

              if (existingProduct) {
                // Update existing product
                productData['product_id'] = existingProduct.product_id
                updatedCount++
              } else {
                // New product
                createdCount++
              }

              productUpserts.push(productData)

            } catch (error) {
              // This should never happen with our comprehensive fallbacks
              console.error(`Unexpected error processing product ${product.code}:`, error)
              // Continue processing other products
            }
          }

          // Bulk upsert products
          if (productUpserts.length > 0) {
            const { error: upsertError } = await supabase
              .from('products')
              .upsert(productUpserts, {
                onConflict: 'brand_id,product_code,variant_sku',
                ignoreDuplicates: false
              })
              .select()

            if (upsertError) {
              console.error('Bulk upsert error:', upsertError)
              console.error('Failed batch sample:', productUpserts[0])
              
              // Try individual inserts as fallback
              for (const product of productUpserts) {
                try {
                  const { error: singleError } = await supabase
                    .from('products')
                    .upsert(product, {
                      onConflict: 'brand_id,product_code,variant_sku',
                      ignoreDuplicates: false
                    })
                  
                  if (singleError) {
                    console.error('Single product insert failed:', singleError, product.variant_sku)
                    failedCount++
                  } else {
                    successCount++
                  }
                } catch (e) {
                  console.error('Single product insert exception:', e)
                  failedCount++
                }
              }
            } else {
              // Bulk upsert succeeded
              successCount += productUpserts.length
            }
          }

          processedCount += batch.length
        }

        // Update progress after processing all batches on this page
          await supabase
            .from('catalog_import_progress')
            .update({
              processed_products: processedCount,
              successful_products: successCount,
              failed_products: failedCount,
              current_page: page,
              updated_at: new Date().toISOString(),
              metadata: {
                created_count: createdCount,
                updated_count: updatedCount,
                skipped_count: skippedCount,
                ai_enhanced_fields: AI_ENHANCED_FIELDS
              }
            })
            .eq('id', importProgressId)
        
        // Add small delay between pages to avoid rate limiting
        if (page < totalPages - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }

      } catch (error) {
        console.error(`Error processing page ${page}:`, error)
        
        // Update progress with error
        await supabase
          .from('catalog_import_progress')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            updated_at: new Date().toISOString()
          })
          .eq('id', importProgressId)

        return NextResponse.json(
          { error: 'Import failed', details: error instanceof Error ? error.message : 'Unknown error' },
          { status: 500 }
        )
      }
    }

    // Log final summary
    console.log('\n=== IMPORT SUMMARY ===')
    console.log(`Total products in API: ${totalProducts}`)
    console.log(`Total pages processed: ${totalPages}`)
    console.log(`Products processed: ${processedCount}`)
    console.log(`Successful imports: ${successCount}`)
    console.log(`Failed imports: ${failedCount}`)
    console.log(`Created: ${createdCount}`)
    console.log(`Updated: ${updatedCount}`)
    console.log(`Skipped: ${skippedCount}`)
    console.log('====================\n')

    // Mark import as completed
    await supabase
      .from('catalog_import_progress')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {
          ...importProgress?.metadata,
          created_count: createdCount,
          updated_count: updatedCount,
          skipped_count: skippedCount,
          ai_enhanced_fields: AI_ENHANCED_FIELDS,
          data_coverage: {
            from_api: ['product_name', 'price', 'color', 'size', 'category'],
            ai_enhanced: AI_ENHANCED_FIELDS,
            coverage_percentage: Math.round((5 / (5 + AI_ENHANCED_FIELDS.length)) * 100)
          },
          import_summary: {
            total_api_products: totalProducts,
            pages_processed: totalPages,
            products_per_page: pageSize,
            final_processed_count: processedCount
          }
        }
      })
      .eq('id', importProgressId)

    return NextResponse.json({
      success: true,
      processed: processedCount,
      successful: successCount,
      failed: failedCount,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount
    })

  } catch (error) {
    console.error('Bulk import error:', error)
    return NextResponse.json(
      { error: 'Import failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}