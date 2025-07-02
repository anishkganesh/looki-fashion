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

    // First, try to fetch just the products without joins to isolate the issue
    console.log('Fetching products for brand_id:', userData.brand_id)
    
    let products = []
    let count = 0
    
    try {
      // Fetch all products without joins since the related tables don't exist
      const { data: fetchedProducts, error: productsError, count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('brand_id', userData.brand_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(3000) // Increase limit to get all products
      
      if (productsError) {
        console.error('Error fetching products:', productsError)
        throw productsError
      }
      
      console.log(`Found ${productCount} products for brand ${userData.brand_id}`)
      
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
      count: count || 0
    })
  } catch (error) {
    console.error('Error in catalog products API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
} 