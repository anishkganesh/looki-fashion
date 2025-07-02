import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { determineProductDemographics, generateInventoryMetrics, generateStyleAttributes, generateMaterialAttributes } from '@/lib/product-demographics'
import crypto from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

function generateProductCode(name: string, index: number): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const hash = crypto.createHash('md5').update(name).digest('hex').substring(0, 4).toUpperCase()
  return `MAN-${timestamp}-${hash}-${index.toString().padStart(3, '0')}`
}

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    const { brandId, data, productLimit } = await request.json()
    
    if (!brandId || !data) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Extract products using GPT-3.5-turbo
    const prompt = `Extract product information from the following data. Return a JSON array of products with these fields:
    - name (string, required)
    - price (number, required)
    - currency (string, default "USD")
    - color (string, optional)
    - size (string, optional)
    - sku (string, optional)
    - description (string, optional)
    - category (string, optional)
    - brand (string, optional)
    - availability (string, optional)
    - image (string, optional - URL)
    
    The data might be HTML, JSON, or plain text. Extract as many products as you can find.
    
    Data:
    ${data.substring(0, 10000)} // Increased limit for better extraction
    
    Return ONLY a valid JSON array, no other text.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a product data extraction expert. Extract product information and return only valid JSON. Be thorough and extract all available product details.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 3000
    })

    const responseText = completion.choices[0].message.content || '[]'
    
    // Parse the response
    let products = []
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        products = JSON.parse(jsonMatch[0])
      } else {
        products = JSON.parse(responseText)
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse extracted products' },
        { status: 400 }
      )
    }

    // Apply product limit if specified
    if (productLimit && productLimit > 0) {
      products = products.slice(0, productLimit)
    }

    let importedCount = 0
    const productUpserts = []

    // Process each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      
      if (!product.name || !product.price) {
        continue // Skip invalid products
      }

      const productName = String(product.name)
      const productPrice = parseFloat(product.price) || 99.99
      const productCode = product.sku || generateProductCode(productName, i)
      const variantSku = `${productCode}-${(product.color || 'DEFAULT').toUpperCase()}-${(product.size || 'U').toUpperCase()}`
      const category = product.category || 'general/uncategorized'
      
      // Generate all required fields using the demographic functions
      const demographics = determineProductDemographics(
        productName,
        category,
        productPrice,
        product.color || 'Default',
        product.size || 'U'
      )
      
      const inventoryMetrics = generateInventoryMetrics(
        productName,
        category,
        productPrice
      )

      const productData = {
        brand_id: brandId,
        product_code: productCode,
        variant_sku: variantSku,
        api_source: 'manual_import',
        
        // Basic info
        product_name: productName,
        description: product.description || `${productName} - Manually imported product`,
        category_hierarchy: category,
        
        // Variant attributes
        color: product.color || 'Default',
        size: product.size || 'U',
        
        // Pricing
        current_price: productPrice,
        original_price: productPrice,
        discount_percentage: 0,
        currency: product.currency || 'USD',
        
        // Inventory
        stock_status: product.availability === 'OutOfStock' ? 'OutOfStock' : 'InStock',
        current_inventory_level: Math.max(1, Math.floor(inventoryMetrics.current_inventory_level)),
        inventory_velocity: inventoryMetrics.inventory_velocity,
        days_of_supply: Math.floor(inventoryMetrics.days_of_supply),
        
        // Sales metrics
        revenue_last_30d: inventoryMetrics.revenue_last_30d,
        units_sold_last_30d: Math.floor(inventoryMetrics.units_sold_last_30d),
        conversion_rate: inventoryMetrics.conversion_rate,
        return_rate: inventoryMetrics.return_rate,
        
        // Financial metrics
        margin_percentage: 35.0,
        competitor_price_index: 1.0,
        promotion_responsiveness: 1.2,
        
        // Complex attributes
        images: product.image ? [product.image] : [],
        style_attributes: generateStyleAttributes(
          productName,
          category,
          product.color || 'Default',
          product.description
        ),
        material_attributes: generateMaterialAttributes(
          productName,
          category,
          productPrice,
          product.description
        ),
        target_demographics: demographics,
        
        // Metadata
        api_data: {
          source: 'manual_import',
          imported_at: new Date().toISOString(),
          raw_data: product
        },
        api_checksum: crypto.createHash('md5').update(`${productName}${productPrice}${productCode}`).digest('hex'),
        last_api_sync: new Date().toISOString(),
        
        ai_enhanced_fields: [
          'target_demographics',
          'inventory_velocity',
          'days_of_supply',
          'revenue_last_30d',
          'units_sold_last_30d',
          'conversion_rate',
          'return_rate',
          'style_attributes',
          'material_attributes'
        ],
        
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      productUpserts.push(productData)
    }

    // Bulk insert products
    if (productUpserts.length > 0) {
      const { error: upsertError } = await supabase
        .from('products')
        .upsert(productUpserts, {
          onConflict: 'brand_id,product_code,variant_sku',
          ignoreDuplicates: false
        })

      if (upsertError) {
        console.error('Bulk upsert error:', upsertError)
        throw new Error('Failed to import products')
      }

      importedCount = productUpserts.length
    }

    // Update brand catalog status if this is the first import
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('brand_id', brandId)

    if (count && count > 0) {
      await supabase
        .from('brands')
        .update({ has_catalog_integrated: true })
        .eq('brand_id', brandId)
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
      total: products.length
    })

  } catch (error) {
    console.error('Manual import error:', error)
    return NextResponse.json(
      { error: 'Import failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 