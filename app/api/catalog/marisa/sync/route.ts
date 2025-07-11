import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { marisaAPI, MarisaProduct } from '@/lib/marisa-api'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Map Marisa product fields to our database schema
function mapMarisaProductToDb(marisaProduct: MarisaProduct, brandId: number) {
  // Extract price value from the price object
  const priceValue = marisaProduct.price?.value || 99.99
  const mockUnits = Math.floor(Math.random() * 50) + 10 // 10-60 units
  const mockRevenue = priceValue * mockUnits
  
  // Extract category from categories array
  const categories = marisaProduct.categories || []
  const categoryHierarchy = categories.map((c: any) => c.code).join('/')
  const primaryCategory = categories[0]?.code || 'general'
  
  return {
    // Use Marisa's product code as our SKU
    variant_sku: marisaProduct.code,
    product_code: marisaProduct.code,
    product_name: marisaProduct.name || 'Unknown Product',
    product_description: `${marisaProduct.name} - ${marisaProduct.selectedColorName} - ${marisaProduct.selectedSizeName}`,
    description: `${marisaProduct.name} - ${marisaProduct.selectedColorName} - ${marisaProduct.selectedSizeName}`,
    
    // Pricing - extract from price object
    current_price: priceValue,
    original_price: priceValue, // No discount info in this API
    discount_percentage: 0,
    currency: marisaProduct.price?.currencyIso || 'BRL',
    
    // Category hierarchy
    category_hierarchy: categoryHierarchy || 'general',
    product_type: primaryCategory,
    
    // Attributes - use the actual field names
    color: marisaProduct.selectedColorName || '',
    size: marisaProduct.selectedSizeName || '',
    
    // Inventory - generate mock data since not provided
    current_inventory_level: 100 + Math.floor(Math.random() * 400), // 100-500 units
    stock_status: 'InStock',
    
    // Mock revenue data for tracking
    revenue_last_7d: mockRevenue * 0.25, // 25% of monthly revenue
    units_sold_last_7d: Math.floor(mockUnits * 0.25),
    conversion_rate_last_7d: 2.5 + Math.random() * 2, // 2.5-4.5%
    revenue_last_30d: mockRevenue,
    units_sold_last_30d: mockUnits,
    conversion_rate: 2.5 + Math.random() * 2, // 2.5-4.5%
    
    // Brand
    brand_id: brandId,
    
    // Additional fields
    product_url: marisaProduct.url ? `https://www.marisa.com.br${marisaProduct.url}` : '',
    material: '', // Not provided in API
    
    // Metadata
    external_id: marisaProduct.code,
    source: 'marisa_api',
    last_synced: new Date().toISOString(),
    
    // Status
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check for service role key
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured')
      return NextResponse.json({ 
        success: false,
        error: 'Server configuration error: Missing service role key' 
      }, { status: 500 })
    }
    
    const { brandId } = await request.json()
    
    if (!brandId) {
      return NextResponse.json({ 
        success: false,
        error: 'Brand ID is required' 
      }, { status: 400 })
    }
    
    console.log('Starting Marisa product sync for brand:', brandId)
    
    // Fetch products from Marisa API - limit to 2000 for performance
    let marisaProducts: MarisaProduct[] = []
    let uniqueProducts: MarisaProduct[] = []
    
    try {
      console.log('Calling Marisa API to fetch products (limited to 2000)...')
      
      // Start from a random page to get different products each time
      // With 591k products and 500 per page, we have about 1183 pages
      const randomStartPage = Math.floor(Math.random() * 100) // Random page between 0-99 for more variety
      console.log(`Starting from page ${randomStartPage} to get variety...`)
      
      // Fetch limited products with random start
      marisaProducts = await marisaAPI.fetchAllProducts(2000, randomStartPage)
      
      // Don't filter by brand - all products are sold by Marisa store
      console.log(`Fetched ${marisaProducts.length} products from Marisa API`)
      
      // Deduplicate products by code (SKU) - API sometimes returns duplicates
      const uniqueProductsMap = new Map<string, MarisaProduct>()
      marisaProducts.forEach(product => {
        if (!uniqueProductsMap.has(product.code)) {
          uniqueProductsMap.set(product.code, product)
        }
      })
      
      uniqueProducts = Array.from(uniqueProductsMap.values())
      console.log(`After deduplication: ${uniqueProducts.length} unique products`)
      
      // Log first few products to see variety
      if (uniqueProducts.length > 0) {
        console.log('Sample products:')
        uniqueProducts.slice(0, 3).forEach((p, i) => {
          console.log(`Product ${i + 1}: ${p.name} - Brand: ${p.brand?.name} - Price: R$${p.price?.value}`)
        })
      }
    } catch (apiError: any) {
      console.error('Marisa API error:', apiError)
      return NextResponse.json({
        success: false,
        error: `Failed to fetch from Marisa API: ${apiError.message}`
      }, { status: 500 })
    }
    
    if (uniqueProducts.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          totalProducts: 0,
          inserted: 0,
          updated: 0,
          deleted: 0,
          errors: 0
        }
      })
    }
    
    // Get existing products to determine what needs to be inserted vs updated
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('product_id, variant_sku')
      .eq('brand_id', brandId)
    
    if (fetchError) {
      console.error('Error fetching existing products:', fetchError)
    }
    
    const existingSkuMap = new Map(
      existingProducts?.map(p => [p.variant_sku, p.product_id]) || []
    )
    
    console.log(`Found ${existingProducts?.length || 0} existing products in database`)
    
    console.log(`Processing ${uniqueProducts.length} unique products...`)
    
    // Map products to database format - use only fields that exist in the schema
    const mappedProducts = uniqueProducts.map(p => {
      const priceValue = p.price?.value || 99.99
      const mockUnits = Math.floor(Math.random() * 50) + 10
      const mockRevenue = priceValue * mockUnits
      
      return {
        // Required fields
        brand_id: brandId,
        product_code: p.code,
        variant_sku: p.code,
        product_name: p.name || 'Unknown Product',
        
        // Pricing
        current_price: priceValue,
        original_price: priceValue,
        discount_percentage: 0,
        currency: p.price?.currencyIso || 'BRL',
        
        // Stock
        stock_status: 'InStock',
        current_inventory_level: 100 + Math.floor(Math.random() * 400),
        
        // Revenue tracking fields
        revenue_last_7d: mockRevenue * 0.25,
        units_sold_last_7d: Math.floor(mockUnits * 0.25),
        conversion_rate_last_7d: 2.5 + Math.random() * 2,
        revenue_last_30d: mockRevenue,
        units_sold_last_30d: mockUnits,
        conversion_rate: 2.5 + Math.random() * 2,
        
        // Text fields
        description: `${p.name} - ${p.selectedColorName || 'Default'} - ${p.selectedSizeName || 'U'}`,
        category_hierarchy: p.categories?.map((c: any) => c.code).join('/') || 'general',
        color: p.selectedColorName || '',
        size: p.selectedSizeName || '',
        
        // Additional metrics (required by schema)
        inventory_velocity: 2.5 + Math.random() * 2.5,
        days_of_supply: Math.floor(30 + Math.random() * 60),
        return_rate: Math.random() * 5, // 0-5% return rate
        margin_percentage: 35 + Math.random() * 15, // 35-50% margin
        competitor_price_index: 0.9 + Math.random() * 0.3, // 0.9-1.2
        promotion_responsiveness: 1 + Math.random() * 0.5, // 1.0-1.5
        
        // JSON fields
        images: [] as any[], // No images from API
        style_attributes: {} as any,
        material_attributes: {} as any,
        target_demographics: {
          gender: p.name?.toLowerCase().includes('feminina') ? 'female' : 'unisex',
          age_group: 'adult'
        },
        api_data: {
          brand: p.brand,
          categories: p.categories,
          seller: p.seller,
          url: p.url
        },
        ai_enhanced_fields: ['inventory_velocity', 'days_of_supply', 'return_rate', 'margin_percentage'],
        
        // Metadata
        api_source: 'marisa_api',
        api_checksum: p.code, // Use product code as checksum
        last_api_sync: new Date().toISOString(),
        source: 'marisa_api',
        external_id: p.code,
        last_synced: new Date().toISOString(),
        is_active: true,
        updated_at: new Date().toISOString()
      }
    })
    
    console.log('First mapped product:', JSON.stringify(mappedProducts[0], null, 2))
    
    let inserted = 0
    let updated = 0
    let deleted = 0
    let errors = 0
    
    // Process in batches using upsert
    const batchSize = 50
    for (let i = 0; i < mappedProducts.length; i += batchSize) {
      const batch = mappedProducts.slice(i, i + batchSize)
      
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(mappedProducts.length/batchSize)}`)
      
      const { data, error } = await supabase
        .from('products')
        .upsert(batch, {
          onConflict: 'brand_id,product_code,variant_sku',
          ignoreDuplicates: false
        })
        .select('product_id')
      
      if (error) {
        console.error('Batch upsert error:', error)
        errors += batch.length
      } else {
        // Since upsert doesn't tell us what was inserted vs updated,
        // we'll count them all as successful operations
        inserted += data?.length || 0
      }
    }
    
    console.log(`Sync completed: ${inserted} successful, ${errors} errors`)
    
    // Handle deletions - remove products that are no longer in Marisa API
    const marisaSkus = new Set(uniqueProducts.map(p => p.code || p.sku || p.id))
    const toDelete = existingProducts?.filter(p => !marisaSkus.has(p.variant_sku)) || []
    
    if (toDelete.length > 0) {
      console.log(`Removing ${toDelete.length} products no longer in Marisa catalog`)
      
      // First, get product IDs to delete
      const productIdsToDelete = toDelete.map(p => p.product_id)
      
      // Delete related recommendations first to avoid foreign key constraint
      const { error: recDeleteError } = await supabase
        .from('recommendations')
        .delete()
        .in('product_id', productIdsToDelete)
      
      if (recDeleteError) {
        console.error('Error deleting related recommendations:', recDeleteError)
      }
      
      // Also delete from applied_actions_tracking if it exists
      const { error: trackingDeleteError } = await supabase
        .from('applied_actions_tracking')
        .delete()
        .in('product_id', productIdsToDelete)
      
      if (trackingDeleteError) {
        console.error('Error deleting tracking records:', trackingDeleteError)
      }
      
      // Now delete the products
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .in('product_id', productIdsToDelete)
      
      if (deleteError) {
        console.error('Delete error:', deleteError)
        errors += toDelete.length
      } else {
        deleted = toDelete.length
      }
    }
    
    // Update brand to mark catalog as integrated
    await supabase
      .from('brands')
      .update({ has_catalog_integrated: true })
      .eq('brand_id', brandId)
    
    console.log('Marisa sync complete:', { inserted, updated, deleted, errors })
    
    // Update revenue tracking for existing tracked products
    console.log('Updating revenue tracking...')
    
    // Get all active tracking records for Marisa
    const { data: trackingRecords, error: trackingError } = await supabase
      .from('applied_actions_tracking')
      .select(`
        *,
        products!inner(
          product_id,
          variant_sku,
          external_id,
          source,
          current_price
        )
      `)
      .eq('brand_id', brandId)
      .eq('is_active', true)
      .eq('products.source', 'marisa_api')
    
    if (!trackingError && trackingRecords && trackingRecords.length > 0) {
      const productCodes = trackingRecords.map(r => r.products.external_id).filter(Boolean)
      
      if (productCodes.length > 0) {
        try {
          const salesData = await marisaAPI.fetchProductSales(productCodes)
          let revenueUpdated = 0
          
          // Update each tracking record with sales data
          for (const record of trackingRecords) {
            const code = record.products.external_id
            const sales = salesData[code]
            
            if (sales) {
              // Calculate metrics
              const currentRevenue = sales.revenue || 0
              const currentUnits = sales.unitsSold || 0
              const price = record.products.current_price || 0
              const conversionRate = price > 0 && currentUnits > 0 ? (currentRevenue / (price * currentUnits)) * 100 : 0
              
              // Calculate changes from baseline
              const revenueChange = currentRevenue - record.baseline_revenue
              const revenueChangePercentage = record.baseline_revenue > 0 
                ? (revenueChange / record.baseline_revenue) * 100 
                : 0
              
              const unitsChange = currentUnits - record.baseline_units_sold
              const unitsChangePercentage = record.baseline_units_sold > 0
                ? (unitsChange / record.baseline_units_sold) * 100
                : 0
              
              // Update tracking record
              const { error: updateError } = await supabase
                .from('applied_actions_tracking')
                .update({
                  current_revenue: currentRevenue,
                  current_units_sold: currentUnits,
                  current_conversion_rate: conversionRate,
                  revenue_change_amount: revenueChange,
                  revenue_change_percentage: revenueChangePercentage,
                  units_change_amount: unitsChange,
                  units_change_percentage: unitsChangePercentage,
                  peak_revenue_increase_percentage: Math.max(
                    revenueChangePercentage,
                    record.peak_revenue_increase_percentage || 0
                  ),
                  peak_revenue_date: revenueChangePercentage > (record.peak_revenue_increase_percentage || 0)
                    ? new Date().toISOString().split('T')[0]
                    : record.peak_revenue_date,
                  last_updated: new Date().toISOString()
                })
                .eq('tracking_id', record.tracking_id)
              
              if (!updateError) {
                revenueUpdated++
                
                // Create daily snapshot
                const today = new Date().toISOString().split('T')[0]
                
                // Calculate brand average (simplified - in production, query actual data)
                const brandAvgRevenue = currentRevenue * 0.8 // Placeholder
                const revenueVsBrandAvg = brandAvgRevenue > 0
                  ? ((currentRevenue - brandAvgRevenue) / brandAvgRevenue) * 100
                  : 0
                
                await supabase
                  .from('revenue_snapshots')
                  .upsert({
                    tracking_id: record.tracking_id,
                    snapshot_date: today,
                    daily_revenue: currentRevenue,
                    daily_units_sold: currentUnits,
                    daily_conversion_rate: conversionRate,
                    revenue_vs_baseline_percentage: revenueChangePercentage,
                    units_vs_baseline_percentage: unitsChangePercentage,
                    brand_avg_revenue: brandAvgRevenue,
                    revenue_vs_brand_avg_percentage: revenueVsBrandAvg
                  }, {
                    onConflict: 'tracking_id,snapshot_date'
                  })
              }
            }
          }
          
          console.log(`Updated revenue tracking for ${revenueUpdated} products`)
        } catch (error) {
          console.error('Error updating revenue tracking:', error)
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      summary: {
        totalProducts: uniqueProducts.length,
        inserted,
        updated,
        deleted,
        errors
      }
    })
    
  } catch (error: any) {
    console.error('Marisa sync error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to sync Marisa products'
    }, { status: 500 })
  }
} 