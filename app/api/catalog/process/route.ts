import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Papa from 'papaparse'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const { uploadId, fileUrl, userId } = await request.json()
    
    if (!uploadId || !fileUrl || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Get user's brand
    const { data: userData, error: userError } = await supabase
      .from('usr')
      .select('brand_id')
      .eq('id', parseInt(userId))
      .single()
    
    if (userError || !userData?.brand_id) {
      console.error('User brand error:', userError)
      return NextResponse.json(
        { error: 'User brand not found' },
        { status: 400 }
      )
    }
    
    const userBrandId = userData.brand_id
    
    // Fetch the CSV file
    const response = await fetch(fileUrl)
    const csvText = await response.text()
    
    // Parse CSV
    const parseResult = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_')
    })
    
    if (parseResult.errors.length > 0) {
      console.error('CSV parsing errors:', parseResult.errors)
      return NextResponse.json(
        { error: 'Failed to parse CSV file' },
        { status: 400 }
      )
    }
    
    const parsedProducts = parseResult.data as any[]
    
    // Clear existing products for this brand (optional)
    await supabase
      .from('products')
      .delete()
      .eq('brand_id', userBrandId)
    
    // Process products in batches for better performance
    const batchSize = 10
    const productBatches = []
    
    for (let i = 0; i < parsedProducts.length; i += batchSize) {
      productBatches.push(parsedProducts.slice(i, i + batchSize))
    }
    
    let totalInserted = 0
    let totalUpdated = 0
    
    // Process each batch
    for (const batch of productBatches) {
      const productsToInsert = []
      
      for (const product of batch) {
        // Prepare product data
        const productData = {
          brand_id: userBrandId,
          product_code: product.product_code || product.sku || `SKU-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          product_name: product.product_name || product.name || 'Unknown Product',
          current_price: parseFloat(product.current_price || product.price || '0'),
          original_price: parseFloat(product.original_price || product.price || '0'),
          discount_percentage: parseInt(product.discount_percentage || '0'),
          currency: product.currency || 'USD',
          stock_status: product.stock_status || 'InStock',
          current_inventory_level: parseInt(product.current_inventory_level || product.inventory || '100'),
          description: product.description || null,
          is_active: true
        }
        
        productsToInsert.push(productData)
      }
    
      // Batch insert products
      const { data: insertedProducts, error: insertError } = await supabase
        .from('products')
        .insert(productsToInsert)
        .select()
    
      if (insertError) {
        console.error('Product insert error:', insertError)
        continue
      }
    
      if (insertedProducts) {
        totalInserted += insertedProducts.length
    
        // Process related data for inserted products
        const categoriesToInsert: any[] = []
        const attributesToInsert: any[] = []
        const colorsToInsert: any[] = []
        const imagesToInsert: any[] = []
    
        insertedProducts.forEach((insertedProduct, index) => {
          const originalProduct = batch[index]
          
          // Categories
          if (originalProduct.category) {
            categoriesToInsert.push({
              product_id: insertedProduct.product_id,
              category_level: 1,
              category_name: originalProduct.category,
              category_path: originalProduct.category
            })
          }
    
          // Attributes
          const attributeFields = ['material', 'gender', 'season', 'size_range']
          attributeFields.forEach(field => {
            if (originalProduct[field]) {
              const value = Array.isArray(originalProduct[field]) 
                ? originalProduct[field].join(', ') 
                : originalProduct[field]
              
              attributesToInsert.push({
                product_id: insertedProduct.product_id,
                attribute_name: field,
                attribute_value: value,
                attribute_type: field
              })
            }
          })
    
          // Colors
          if (originalProduct.color && originalProduct.color !== 'N/A') {
            colorsToInsert.push({
              product_id: insertedProduct.product_id,
              color_name: originalProduct.color,
              is_primary: true
            })
          }
    
          // Images
          if (originalProduct.images && Array.isArray(originalProduct.images)) {
            originalProduct.images.forEach((imageUrl: string, imgIndex: number) => {
              imagesToInsert.push({
                product_id: insertedProduct.product_id,
                image_url: imageUrl,
                image_order: imgIndex,
                is_primary: imgIndex === 0
              })
            })
          }
        })
    
        // Batch insert related data
        const insertPromises = []
        
        if (categoriesToInsert.length > 0) {
          insertPromises.push(
            supabase.from('product_categories').insert(categoriesToInsert)
          )
        }
        
        if (attributesToInsert.length > 0) {
          insertPromises.push(
            supabase.from('product_attributes').insert(attributesToInsert)
          )
        }
        
        if (colorsToInsert.length > 0) {
          insertPromises.push(
            supabase.from('product_colors').insert(colorsToInsert)
          )
        }
        
        if (imagesToInsert.length > 0) {
          insertPromises.push(
            supabase.from('product_images').insert(imagesToInsert)
          )
        }
    
        await Promise.all(insertPromises)
      }
    }
    
    // Update catalog upload record
    await supabase
      .from('catalog_uploads')
      .update({
        status: 'completed',
        products_imported: totalInserted,
        products_updated: totalUpdated,
        processed_at: new Date().toISOString()
      })
      .eq('id', parseInt(uploadId))
    
    // Update brand catalog status
    await supabase
      .from('brands')
      .update({ 
        has_catalog_integrated: true,
        catalog_integrated_at: new Date().toISOString()
      })
      .eq('brand_id', userBrandId)
    
    // Generate recommendations automatically with correct brand ID
    try {
      const recommendationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/recommendations/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ brand_id: userBrandId })
      })
    
      if (!recommendationResponse.ok) {
        console.error('Failed to generate recommendations:', await recommendationResponse.text())
      } else {
        const recResult = await recommendationResponse.json()
        console.log('Recommendations generated:', recResult)
      }
    } catch (recError) {
      console.error('Error generating recommendations:', recError)
    }
    
    return NextResponse.json({
      success: true,
      productsImported: totalInserted,
      productsUpdated: totalUpdated
    })
    
  } catch (error: any) {
    console.error('Processing error:', error)
    return NextResponse.json(
      { error: error.message || 'Processing failed' },
      { status: 500 }
    )
  }
} 