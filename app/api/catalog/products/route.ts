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

    // Get brand_id from query params
    const searchParams = request.nextUrl.searchParams
    const brandIdParam = searchParams.get('brand_id')
    
    let brandId: number
    let userBrandId: number | null = null
    
    // Always get user's brand for context
    const { data: userData, error: userError } = await supabase
      .from('usr')
      .select('brand_id')
      .eq('email', user.email)
      .single()
    
    if (userData?.brand_id) {
      userBrandId = userData.brand_id
    }
    
    if (brandIdParam && brandIdParam !== 'all') {
      // Use the brand from query params
      brandId = parseInt(brandIdParam)
    } else {
      // Default to showing all brands
      brandId = 0 // Will fetch all brands
    }

    // First, try to fetch just the products without joins to isolate the issue
    console.log('Fetching products for brand_id:', brandId === 0 ? 'all' : brandId)
    
    let products = []
    let count = 0
    
    try {
      // Fetch all products without joins since the related tables don't exist
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
      
      // Apply brand filter only if not fetching all brands
      if (brandId !== 0) {
        query = query.eq('brand_id', brandId)
      }
      
      const { data: fetchedProducts, error: productsError, count: productCount } = await query
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3000) // Increase limit to get all products
      
      if (productsError) {
        console.error('Error fetching products:', productsError)
        throw productsError
      }
      
      console.log(`Found ${productCount} products for brand ${brandId === 0 ? 'all' : brandId}`)
      
      products = fetchedProducts || []
      count = productCount || 0
      
    } catch (queryError) {
      console.error('Database query error:', queryError)
      return NextResponse.json({ 
        error: 'Database query failed', 
        details: queryError instanceof Error ? queryError.message : 'Unknown error'
      }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      products: products || [],
      count: count || 0,
      userBrandId: userBrandId
    })
  } catch (error) {
    console.error('Error in catalog products API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 