import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { uploadId, brandId } = await request.json()
    
    if (!uploadId || !brandId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Update status to enriching
    await supabase
      .from('catalog_uploads')
      .update({ status: 'processing' })
      .eq('id', uploadId)
    
    // Get products that need enrichment
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .eq('brand_id', brandId)
      .eq('margin_percentage', 0)
      .limit(50) // Process in batches
    
    if (productsError || !products) {
      throw new Error('Failed to fetch products')
    }
    
    // Get brand info for context
    const { data: brand } = await supabase
      .from('brands')
      .select('brand_name, category, description')
      .eq('brand_id', brandId)
      .single()
    
    let enrichedCount = 0
    const errors: any[] = []
    
    // Process products in batches of 5 to avoid rate limits
    for (let i = 0; i < products.length; i += 5) {
      const batch = products.slice(i, i + 5)
      
      // Update progress status in catalog_uploads table
      await supabase
        .from('catalog_uploads')
        .update({ 
          status: 'processing',
          error_message: `Enriching products: ${i + 1}-${Math.min(i + 5, products.length)} of ${products.length}`
        })
        .eq('id', uploadId)
      
      await Promise.all(batch.map(async (product) => {
        try {
          // Generate enriched data using OpenAI
          const enrichmentPrompt = `
            You are a fashion retail analyst. Analyze this product and generate realistic data.
            
            Brand: ${brand?.brand_name}
            Product: ${product.product_name}
            SKU: ${product.product_code}
            Price: ${product.currency} ${product.current_price}
            Original Price: ${product.currency} ${product.original_price}
            Category: ${brand?.category}
            
            Generate the following in JSON format:
            1. seo_title: An SEO-optimized product title (max 60 chars)
            2. description: A compelling product description if missing (150-200 words)
            3. estimated_margin_percentage: Realistic margin % for this product type (0-100)
            4. estimated_inventory_velocity: Monthly sales velocity estimate (1-100)
            5. estimated_days_of_supply: Typical days of inventory (1-365)
            6. competitor_price_index: Price compared to market (0.5-2.0, where 1.0 is average)
            7. promotion_responsiveness: How well it responds to promotions (0-1)
            8. trend_alignment_keywords: List of 5-10 current fashion trends this aligns with
            9. target_customer_segment: Primary customer segment
            10. seasonality: Peak selling season
            
            Base estimates on typical fashion retail metrics for this category and price point.
          `
          
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a fashion retail analyst providing realistic estimates.' },
              { role: 'user', content: enrichmentPrompt }
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' }
          })
          
          const enrichedData = JSON.parse(response.choices[0].message.content!)
          
          // Update product with enriched data
          const updateData: any = {
            margin_percentage: enrichedData.estimated_margin_percentage || 30,
            inventory_velocity: enrichedData.estimated_inventory_velocity || 10,
            days_of_supply: enrichedData.estimated_days_of_supply || 30,
            competitor_price_index: enrichedData.competitor_price_index || 1.0,
            promotion_responsiveness: enrichedData.promotion_responsiveness || 0.5,
            updated_at: new Date().toISOString()
          }
          
          // Update product
          await supabase
            .from('products')
            .update(updateData)
            .eq('product_id', product.product_id)
          
          // Add enriched attributes
          const attributes = [
            { name: 'seo_title', value: enrichedData.seo_title },
            { name: 'ai_description', value: enrichedData.description || product.description },
            { name: 'target_customer', value: enrichedData.target_customer_segment },
            { name: 'seasonality', value: enrichedData.seasonality }
          ]
          
          for (const attr of attributes) {
            if (attr.value) {
              // Check if attribute exists
              const { data: existing } = await supabase
                .from('product_attributes')
                .select('id')
                .eq('product_id', product.product_id)
                .eq('attribute_name', attr.name)
                .single()
              
              if (!existing) {
                await supabase
                  .from('product_attributes')
                  .insert({
                    product_id: product.product_id,
                    attribute_name: attr.name,
                    attribute_value: attr.value,
                    attribute_type: 'ai_generated'
                  })
              }
            }
          }
          
          // Process trend keywords
          if (enrichedData.trend_alignment_keywords) {
            for (const keyword of enrichedData.trend_alignment_keywords) {
              await supabase
                .from('product_attributes')
                .insert({
                  product_id: product.product_id,
                  attribute_name: 'trend_keyword',
                  attribute_value: keyword,
                  attribute_type: 'ai_generated'
                })
            }
          }
          
          enrichedCount++
        } catch (error: any) {
          console.error(`Error enriching product ${product.product_code}:`, error)
          errors.push({
            product_id: product.product_id,
            product_code: product.product_code,
            error: error.message
          })
        }
      }))
      
      // Add delay to avoid rate limits
      if (i + 5 < products.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    // Update catalog status
    await supabase
      .from('catalog_uploads')
      .update({ 
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .eq('id', uploadId)
    
    return NextResponse.json({
      success: true,
      enrichedCount,
      totalProducts: products.length,
      errors
    })
    
  } catch (error: any) {
    console.error('Enrichment error:', error)
    return NextResponse.json(
      { error: error.message || 'Enrichment failed' },
      { status: 500 }
    )
  }
} 