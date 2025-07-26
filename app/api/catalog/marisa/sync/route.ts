import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Function to generate random revenue data
function generateRevenueData() {
  const baseRevenue = Math.floor(Math.random() * 50000) + 5000 // 5k-55k
  const unitsSold = Math.floor(Math.random() * 200) + 20 // 20-220 units
  
  return {
    revenue_last_30d: baseRevenue,
    revenue_last_7d: Math.floor(baseRevenue * 0.25),
    units_sold_last_30d: unitsSold,
    units_sold_last_7d: Math.floor(unitsSold * 0.25),
    inventory_velocity: Math.random() * 10 + 1, // 1-11
    conversion_rate: Math.random() * 0.05 + 0.01, // 1-6%
    profit_margin: Math.random() * 0.3 + 0.2 // 20-50%
  }
}

// Function to extract clothing articles from product title
function extractClothingArticles(title: string): string[] {
  const articles: string[] = []
  const titleLower = title.toLowerCase()
  
  // Check for various clothing types
  if (titleLower.includes('calça') || titleLower.includes('pant')) {
    if (titleLower.includes('jeans') || titleLower.includes('denim')) {
      articles.push('jeans')
    } else if (titleLower.includes('legging')) {
      articles.push('leggings')
    } else {
      articles.push('pants')
    }
  }
  if (titleLower.includes('blusa') || titleLower.includes('regata') || titleLower.includes('top')) {
    articles.push('shirts')
  }
  if (titleLower.includes('vestido') || titleLower.includes('dress')) {
    articles.push('dresses')
  }
  if (titleLower.includes('saia') || titleLower.includes('skirt')) {
    articles.push('skirts')
  }
  if (titleLower.includes('short')) {
    articles.push('shorts')
  }
  if (titleLower.includes('jaqueta') || titleLower.includes('jacket')) {
    articles.push('jackets')
  }
  if (titleLower.includes('casaco') || titleLower.includes('coat')) {
    articles.push('coats')
  }
  if (titleLower.includes('moletom') || titleLower.includes('sweatshirt')) {
    articles.push('hoodies')
  }
  
  return articles.length > 0 ? articles : ['general']
}

// Function to determine category hierarchy from title
function getCategoryHierarchy(title: string): string {
  const titleLower = title.toLowerCase()
  
  if (titleLower.includes('calça')) {
    if (titleLower.includes('jeans')) return 'Women > Bottoms > Jeans'
    if (titleLower.includes('legging')) return 'Women > Bottoms > Leggings'
    return 'Women > Bottoms > Pants'
  }
  if (titleLower.includes('blusa') || titleLower.includes('regata')) {
    return 'Women > Tops > Shirts'
  }
  if (titleLower.includes('vestido')) {
    return 'Women > Dresses > Casual Dresses'
  }
  if (titleLower.includes('saia')) {
    return 'Women > Bottoms > Skirts'
  }
  if (titleLower.includes('short')) {
    return 'Women > Bottoms > Shorts'
  }
  if (titleLower.includes('jaqueta')) {
    return 'Women > Outerwear > Jackets'
  }
  if (titleLower.includes('casaco')) {
    return 'Women > Outerwear > Coats'
  }
  if (titleLower.includes('moletom')) {
    return 'Women > Tops > Hoodies'
  }
  
  return 'Women > General > Other'
}

export async function POST(request: NextRequest) {
  try {
    const { brandId } = await request.json()
    
    if (!brandId || brandId !== 13) {
      return NextResponse.json({ error: 'Invalid brand ID' }, { status: 400 })
    }
    
    console.log('Starting Marisa product sync...')
    
    // Fetch products from Marisa API (limit to 2000 as requested)
    const pageSize = 100
    const maxPages = 20 // 20 pages * 100 = 2000 products
    let allProducts: any[] = []
    
    for (let page = 0; page < maxPages; page++) {
      const response = await fetch(
        `https://api.marisa.com.br/marisaomniwebservices/v2/marisa/products/category/roupas/marketplace?currentPage=${page}&pageSize=${pageSize}&sort=newOnStore&query=%3AnewOnStore%3Amarketplace%3Afalse`,
        {
          headers: {
            'Cookie': 'az_asm=zVKnDJzmEkPSuZbXc4Lc0/E/2cMwoDGjlGBkDktnWWmaLh1IuRUt+SlwmljSRytBqc4Ea0Ww4VeW2utM; az_botm=4705375d8326c4624041c3c97647f452'
          }
        }
      )
      
      if (!response.ok) {
        console.error(`Failed to fetch page ${page}:`, response.status)
        break
      }
      
      const data = await response.json()
      if (!data.products || data.products.length === 0) {
        break
      }
      
      allProducts = allProducts.concat(data.products)
      console.log(`Fetched page ${page + 1}, total products: ${allProducts.length}`)
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    console.log(`Total products fetched: ${allProducts.length}`)
    
    // Transform Marisa products to our format
    const transformedProducts = allProducts.map(product => {
      const revenueData = generateRevenueData()
      const clothingArticles = extractClothingArticles(product.title)
      const categoryHierarchy = getCategoryHierarchy(product.title)
      
      return {
        brand_id: 13,
        product_name: product.title,
        product_code: product.idProduct,
        variant_sku: product.styleId || product.idProduct,
        category_hierarchy: categoryHierarchy,
        clothing_articles: clothingArticles,
        current_price: product.lowestPrice?.value || 0,
        original_price: product.lowestPrice?.fromPrice || product.lowestPrice?.value || 0,
        currency: product.lowestPrice?.currencyIso || 'BRL',
        current_inventory_level: Math.floor(Math.random() * 500) + 50, // 50-550 units
        is_active: true,
        images: product.images?.map((img: any) => img.url) || [],
        color: product.colors?.[0]?.name || null,
        material_attributes: {
          colors: product.colors?.map((c: any) => c.name) || []
        },
        target_demographics: {
          target_gender: 'women',
          target_age_min: 18,
          target_age_max: 65,
          target_income_level: 'medium'
        },
        ...revenueData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    })
    
    // Upsert products in batches
    const batchSize = 100
    let inserted = 0
    let updated = 0
    let errors = 0
    
    for (let i = 0; i < transformedProducts.length; i += batchSize) {
      const batch = transformedProducts.slice(i, i + batchSize)
      
      try {
        const { data, error } = await supabase
          .from('products')
          .upsert(batch, {
            onConflict: 'brand_id,product_code',
            ignoreDuplicates: false
          })
          .select()
        
        if (error) {
          console.error('Batch upsert error:', error)
          errors += batch.length
        } else {
          // Count inserts vs updates (simplified - assumes all successful)
          inserted += data?.length || 0
        }
      } catch (error) {
        console.error('Batch processing error:', error)
        errors += batch.length
      }
      
      console.log(`Processed ${i + batch.length} / ${transformedProducts.length} products`)
    }
    
    // Clean up old products (optional - mark as inactive instead of deleting)
    const currentProductCodes = transformedProducts.map(p => p.product_code)
    const { error: deactivateError } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('brand_id', 13)
      .not('product_code', 'in', `(${currentProductCodes.join(',')})`)
    
    if (deactivateError) {
      console.error('Error deactivating old products:', deactivateError)
    }
    
    return NextResponse.json({
      success: true,
      summary: {
        totalProducts: transformedProducts.length,
        inserted: inserted,
        updated: 0, // Simplified for now
        errors: errors,
        deactivated: 0 // Would need to count this
      }
    })
    
  } catch (error: any) {
    console.error('Marisa sync error:', error)
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    )
  }
}