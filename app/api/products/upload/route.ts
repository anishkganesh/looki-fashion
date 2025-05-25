import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'
import FirecrawlApp from '@mendable/firecrawl-js'
import OpenAI from 'openai'

const firecrawl = new FirecrawlApp({ 
  apiKey: process.env.FIRECRAWL_API_KEY! 
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

interface ProductData {
  product_code?: string
  product_name?: string
  current_price?: number
  original_price?: number
  description?: string
  category?: string
  colors?: string[]
  sizes?: string[]
  materials?: string[]
  [key: string]: any
}

interface EnrichedProduct {
  product: ProductData
  aiGenerated: {
    description?: string
    attributes?: Record<string, string>
    categories?: string[]
    colors?: string[]
    trendAlignments?: Array<{
      trend_id: number
      alignment_score: number
      factors: string[]
    }>
  }
  confidence: number
}

export async function POST(request: NextRequest) {
  try {
    const { products, fieldMappings, brandId, enableAI, confidenceThreshold } = await request.json()
    
    if (!products || !Array.isArray(products)) {
      return NextResponse.json(
        { success: false, error: 'Invalid products data' },
        { status: 400 }
      )
    }
    
    const results = {
      totalProducts: products.length,
      newProducts: 0,
      updatedProducts: 0,
      aiEnriched: 0,
      errors: [] as string[]
    }
    
    // Get current trends for alignment calculation
    const { data: trends } = await supabaseService
      .from('trends')
      .select('trend_id, trend_identifier, trend_category, trend_description')
      .eq('trend_type', 'signal')
      .order('momentum_score', { ascending: false })
      .limit(50)
    
    for (const rawProduct of products) {
      try {
        // Map fields based on user's mapping
        const mappedProduct = mapProductFields(rawProduct, fieldMappings)
        
        // Enrich with AI if enabled
        let enrichedData: EnrichedProduct | null = null
        if (enableAI) {
          enrichedData = await enrichProductWithAI(mappedProduct, trends || [], confidenceThreshold)
          if (enrichedData && enrichedData.confidence >= confidenceThreshold) {
            results.aiEnriched++
          }
        }
        
        // Merge AI data with mapped data
        const finalProduct = mergeProductData(mappedProduct, enrichedData, confidenceThreshold)
        
        // Check if product exists
        const { data: existing } = await supabaseService
          .from('products')
          .select('product_id')
          .eq('brand_id', brandId)
          .eq('product_code', finalProduct.product_code)
          .maybeSingle()
        
        if (existing) {
          // Update existing product
          const { error: updateError } = await supabaseService
            .from('products')
            .update({
              ...finalProduct,
              updated_at: new Date().toISOString()
            })
            .eq('product_id', existing.product_id)
          
          if (updateError) throw updateError
          results.updatedProducts++
          
          // Update related tables
          await updateProductRelatedData(existing.product_id, finalProduct, enrichedData)
        } else {
          // Insert new product
          const { data: newProduct, error: insertError } = await supabaseService
            .from('products')
            .insert({
              brand_id: brandId,
              ...finalProduct,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single()
          
          if (insertError) throw insertError
          if (!newProduct) throw new Error('Failed to create product')
          
          results.newProducts++
          
          // Insert related data
          await insertProductRelatedData(newProduct.product_id, finalProduct, enrichedData)
        }
        
      } catch (error: any) {
        console.error('Error processing product:', error)
        results.errors.push(`Product ${rawProduct.product_code || 'unknown'}: ${error.message}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      results
    })
    
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

function mapProductFields(rawProduct: any, fieldMappings: Record<string, string>): ProductData {
  const mapped: ProductData = {}
  
  // Apply field mappings
  for (const [targetField, sourceField] of Object.entries(fieldMappings)) {
    if (sourceField && rawProduct[sourceField] !== undefined) {
      mapped[targetField] = rawProduct[sourceField]
    }
  }
  
  // Ensure required fields
  mapped.product_code = mapped.product_code || generateProductCode()
  mapped.product_name = mapped.product_name || 'Unnamed Product'
  mapped.current_price = parseFloat(String(mapped.current_price || 0))
  mapped.original_price = mapped.original_price ? parseFloat(String(mapped.original_price)) : mapped.current_price
  
  return mapped
}

async function enrichProductWithAI(
  product: ProductData, 
  trends: any[],
  confidenceThreshold: number
): Promise<EnrichedProduct | null> {
  try {
    const prompt = `Analyze this fashion product and provide enrichment data:

Product: ${JSON.stringify(product, null, 2)}

Current Fashion Trends: ${trends.slice(0, 10).map(t => t.trend_identifier).join(', ')}

Please provide:
1. Enhanced product description (if missing or brief)
2. Product attributes (material, style, occasion, season, etc.)
3. Detailed category hierarchy (e.g., "Women > Dresses > Cocktail Dresses")
4. Color analysis (identify all colors mentioned)
5. Trend alignments (which current trends does this product align with and why)

Return as JSON with structure:
{
  "description": "enhanced description",
  "attributes": { "key": "value" },
  "categories": ["level1", "level2", "level3"],
  "colors": ["color1", "color2"],
  "trendAlignments": [
    {
      "trendIdentifier": "trend-name",
      "alignmentScore": 0.0-1.0,
      "factors": ["reason1", "reason2"]
    }
  ],
  "confidence": 0.0-1.0
}`

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000
    })
    
    const aiData = JSON.parse(response.choices[0].message.content || '{}')
    
    // Map trend identifiers to IDs
    const trendAlignments = aiData.trendAlignments?.map((alignment: any) => {
      const trend = trends.find(t => 
        t.trend_identifier.toLowerCase() === alignment.trendIdentifier.toLowerCase()
      )
      return trend ? {
        trend_id: trend.trend_id,
        alignment_score: alignment.alignmentScore,
        factors: alignment.factors
      } : null
    }).filter(Boolean) || []
    
    return {
      product,
      aiGenerated: {
        description: aiData.description,
        attributes: aiData.attributes,
        categories: aiData.categories,
        colors: aiData.colors,
        trendAlignments
      },
      confidence: aiData.confidence || 0.8
    }
  } catch (error) {
    console.error('AI enrichment error:', error)
    return null
  }
}

function mergeProductData(
  mapped: ProductData, 
  enriched: EnrichedProduct | null,
  confidenceThreshold: number
): ProductData {
  if (!enriched || enriched.confidence < confidenceThreshold) {
    return mapped
  }
  
  const merged = { ...mapped }
  
  // Use AI description if original is missing or brief
  if (!merged.description || merged.description.length < 50) {
    merged.description = enriched.aiGenerated.description
  }
  
  // Merge colors
  if (enriched.aiGenerated.colors && enriched.aiGenerated.colors.length > 0) {
    merged.colors = [...new Set([...(merged.colors || []), ...enriched.aiGenerated.colors])]
  }
  
  return merged
}

async function updateProductRelatedData(
  productId: number,
  product: ProductData,
  enriched: EnrichedProduct | null
) {
  // Update categories
  if (enriched?.aiGenerated.categories) {
    await supabaseService
      .from('product_categories')
      .delete()
      .eq('product_id', productId)
    
    const categories = enriched.aiGenerated.categories.map((cat, index) => ({
      product_id: productId,
      category_level: index + 1,
      category_name: cat,
      category_path: enriched.aiGenerated.categories!.slice(0, index + 1).join(' > ')
    }))
    
    await supabaseService
      .from('product_categories')
      .insert(categories)
  }
  
  // Update attributes
  if (enriched?.aiGenerated.attributes) {
    await supabaseService
      .from('product_attributes')
      .delete()
      .eq('product_id', productId)
    
    const attributes = Object.entries(enriched.aiGenerated.attributes).map(([name, value]) => ({
      product_id: productId,
      attribute_name: name,
      attribute_value: value,
      attribute_type: 'ai_generated'
    }))
    
    await supabaseService
      .from('product_attributes')
      .insert(attributes)
  }
  
  // Update colors
  if (product.colors && product.colors.length > 0) {
    await supabaseService
      .from('product_colors')
      .delete()
      .eq('product_id', productId)
    
    const colors = product.colors.map((color, index) => ({
      product_id: productId,
      color_name: color,
      is_primary: index === 0
    }))
    
    await supabaseService
      .from('product_colors')
      .insert(colors)
  }
  
  // Update trend alignments
  if (enriched?.aiGenerated.trendAlignments) {
    await supabaseService
      .from('product_trend_alignments')
      .delete()
      .eq('product_id', productId)
    
    const alignments = enriched.aiGenerated.trendAlignments.map(alignment => ({
      product_id: productId,
      trend_id: alignment.trend_id,
      alignment_score: alignment.alignment_score,
      alignment_factors: { factors: alignment.factors },
      calculated_at: new Date().toISOString()
    }))
    
    await supabaseService
      .from('product_trend_alignments')
      .insert(alignments)
  }
}

async function insertProductRelatedData(
  productId: number,
  product: ProductData,
  enriched: EnrichedProduct | null
) {
  // Same logic as update but for new products
  await updateProductRelatedData(productId, product, enriched)
}

function generateProductCode(): string {
  return `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
} 