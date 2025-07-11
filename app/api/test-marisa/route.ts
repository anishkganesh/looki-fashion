import { NextRequest, NextResponse } from 'next/server'
import { marisaAPI } from '@/lib/marisa-api'

export async function GET(request: NextRequest) {
  try {
    console.log('Testing Marisa API...')
    console.log('Environment check:', {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    })
    
    // Test fetching first page of products
    const productsResponse = await marisaAPI.fetchProducts(0, 10) // Just 10 products for testing
    
    console.log('Marisa API Response:', {
      totalElements: productsResponse.pagination.totalResults,
      totalPages: productsResponse.pagination.totalPages,
      currentPage: productsResponse.pagination.currentPage,
      pageSize: productsResponse.pagination.pageSize,
      productsCount: productsResponse.results?.length || 0
    })
    
    // Log first product structure in detail
    if (productsResponse.results && productsResponse.results.length > 0) {
      const firstProduct = productsResponse.results[0]
      console.log('First product structure:', JSON.stringify(firstProduct, null, 2))
      
      // Log all field names
      console.log('Product fields:', Object.keys(firstProduct))
      
      // Test sales API with first few product codes
      const productCodes = productsResponse.results.slice(0, 3).map(p => p.code || p.id || '')
      if (productCodes.length > 0 && productCodes[0]) {
        console.log('Testing sales API with codes:', productCodes)
        const salesData = await marisaAPI.fetchProductSales(productCodes)
        console.log('Sales data:', salesData)
      }
    }
    
    return NextResponse.json({
      success: true,
      totalProducts: productsResponse.pagination.totalResults,
      sampleProducts: productsResponse.results?.slice(0, 3) || [],
      productFields: productsResponse.results?.[0] ? Object.keys(productsResponse.results[0]) : []
    })
    
  } catch (error: any) {
    console.error('Marisa API test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to test Marisa API'
    }, { status: 500 })
  }
} 