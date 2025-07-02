import { NextRequest, NextResponse } from 'next/server'

interface MarisaAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
}

interface MarisaPrice {
  currencyIso: string
  value: number
}

interface MarisaBrand {
  uid: string
  name: string
}

interface MarisaSeller {
  companyName: string
  fantasyName: string
}

interface MarisaCategory {
  code: string
}

interface MarisaProduct {
  code: string
  name: string
  brand: MarisaBrand
  price: MarisaPrice
  selectedColorName: string
  selectedSizeName: string
  seller: MarisaSeller
  categories: MarisaCategory[]
  url: string
}

interface MarisaProductsResponse {
  results: MarisaProduct[]
  pagination: {
    totalResults: number
    pageSize: number
    currentPage: number
    totalPages: number
  }
}

async function getMarisaAccessToken(): Promise<string> {
  const authUrl = 'https://api.marisa.com.br/authorizationserver/oauth/token'
  
  const authData = new URLSearchParams({
    client_id: process.env.MARISA_API_CLIENT_ID || 'marisa_sellable_products_api',
    client_secret: process.env.MARISA_API_CLIENT_SECRET || 'SQ9*e2Z@',
    grant_type: 'password',
    username: process.env.MARISA_API_USERNAME || 'marisa.api.products.sellable@marisa.com.br',
    password: process.env.MARISA_API_PASSWORD || 'k8nDWLqPzIEt7Adb'
  })

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    },
    body: authData
  })

  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.status}`)
  }

  const data: MarisaAuthResponse = await response.json()
  return data.access_token
}

async function fetchMarisaProducts(accessToken: string, page: number = 0, pageSize: number = 1000): Promise<MarisaProductsResponse> {
  const productsUrl = 'https://api.marisa.com.br/marisaomniwebservices/v2/marisa/sellable/products'
  
  const url = new URL(productsUrl)
  url.searchParams.append('page', page.toString())
  url.searchParams.append('pageSize', pageSize.toString())

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.status}`)
  }

  return response.json()
}

export async function GET(request: NextRequest) {
  try {
    // Get access token
    const accessToken = await getMarisaAccessToken()
    
    // Fetch products (first 1000 for demo)
    const productsData = await fetchMarisaProducts(accessToken, 0, 1000)
    
    // Transform Marisa products to match our expected format
    const transformedProducts = productsData.results.map(product => ({
      // Basic product info
      url: `https://www.marisa.com.br${product.url}`,
      name: product.name,
      sku: product.code,
      selling_price: product.price.value.toString(),
      original_price: "", // Marisa API doesn't provide original price in this endpoint
      currency: product.price.currencyIso,
      availability: "InStock", // Assuming all returned products are in stock
      color: product.selectedColorName,
      category: product.categories[0]?.code || "Uncategorized",
      
      // Source info
      source: product.seller.fantasyName,
      source_website: "https://www.marisa.com.br",
      
      // Categories as breadcrumbs
      breadcrumbs: product.categories.map(cat => cat.code).join('/'),
      
      // Additional fields
      description: `${product.name} - ${product.selectedColorName} - Tamanho: ${product.selectedSizeName}`,
      brand: product.brand.name,
      
      // No images in the API response
      images: "",
      
      // Metadata
      country: "BRA",
      language: "pt",
      average_rating: "",
      reviews_count: "",
      crawled_at: new Date().toISOString(),
      
      // Marisa-specific fields stored as metadata
      size: product.selectedSizeName,
      seller_company: product.seller.companyName,
      seller_fantasy: product.seller.fantasyName,
      brand_uid: product.brand.uid,
      total_products_available: productsData.pagination.totalResults
    }))

    return NextResponse.json(transformedProducts)
    
  } catch (error) {
    console.error('Error fetching Marisa products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch Marisa products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 