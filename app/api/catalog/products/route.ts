import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's brand
    const { data: userData, error: userError } = await supabase
      .from('usr')
      .select('brand_id')
      .eq('email', user.email)
      .single()

    if (userError || !userData?.brand_id) {
      return NextResponse.json({ error: 'User brand not found' }, { status: 404 })
    }

    // Fetch products with categories, colors, and images
    const { data: products, error, count } = await supabase
      .from('products')
      .select(`
        *,
        product_categories (
          category_name,
          category_path
        ),
        product_colors (
          color_name,
          is_primary
        ),
        product_images (
          image_url,
          is_primary,
          image_order
        )
      `, { count: 'exact' })
      .eq('brand_id', userData.brand_id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching products:', error)
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    // Transform data
    const transformedProducts = products?.map(product => ({
      ...product,
      category: product.product_categories?.[0]?.category_name || 'Uncategorized',
      color: product.product_colors?.find((c: any) => c.is_primary)?.color_name || 
             product.product_colors?.[0]?.color_name || 'N/A',
      images: product.product_images
        ?.sort((a: any, b: any) => a.image_order - b.image_order)
        ?.map((img: any) => img.image_url) || []
    })) || []

    return NextResponse.json({ 
      success: true, 
      products: transformedProducts,
      count: count || 0
    })
  } catch (error) {
    console.error('Error in catalog products API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 