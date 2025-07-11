interface MarisaAuthResponse {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
}

interface MarisaProduct {
  code: string
  name: string
  description?: string
  price: {
    currencyIso: string
    value: number
  }
  originalPrice?: number
  discount?: number
  selectedColorName?: string
  selectedSizeName?: string
  categories?: Array<{
    code: string
  }>
  brand?: {
    name: string
    uid: string
  }
  seller?: {
    companyName: string
    fantasyName: string
  }
  url?: string
  stock?: number
  available?: boolean
  [key: string]: any // For additional fields we discover
}

interface MarisaProductsResponse {
  pagination: {
    currentPage: number
    pageSize: number
    totalPages: number
    totalResults: number
  }
  results: MarisaProduct[]
}

interface MarisaSalesRequest {
  products: Array<{ code: string }>
}

interface MarisaSalesResponse {
  [code: string]: {
    unitsSold: number
    revenue: number
    lastUpdated: string
  }
}

class MarisaAPI {
  private baseUrl = 'https://api.marisa.com.br'
  private clientId = 'marisa_sellable_products_api'
  private clientSecret = 'SQ9*e2Z@'
  private username = 'marisa.api.products.sellable@marisa.com.br'
  private password = 'k8nDWLqPzIEt7Adb'
  
  private accessToken: string | null = null
  private tokenExpiry: Date | null = null

  // Get OAuth token
  private async authenticate(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken
    }

    try {
      const response = await fetch(`${this.baseUrl}/authorizationserver/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'password',
          username: this.username,
          password: this.password,
        }),
      })

      if (!response.ok) {
        throw new Error(`Authentication failed: ${response.status} ${response.statusText}`)
      }

      const data: MarisaAuthResponse = await response.json()
      this.accessToken = data.access_token
      // Set expiry to 5 minutes before actual expiry for safety
      this.tokenExpiry = new Date(Date.now() + (data.expires_in - 300) * 1000)
      
      return data.access_token
    } catch (error) {
      console.error('Marisa API authentication error:', error)
      throw error
    }
  }

  // Fetch products with pagination
  async fetchProducts(page: number = 0, pageSize: number = 500): Promise<MarisaProductsResponse> {
    const token = await this.authenticate()
    
    try {
      const response = await fetch(
        `${this.baseUrl}/marisaomniwebservices/v2/marisa/sellable/products?page=${page}&pageSize=${pageSize}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      
      // Log the actual structure to understand it
      console.log('Raw API response structure:', {
        hasResults: !!data.results,
        hasPagination: !!data.pagination,
        hasContent: !!data.content,
        topLevelKeys: Object.keys(data),
        resultsLength: data.results?.length || 0,
        contentLength: data.content?.length || 0
      })
      
      // The API might return data in different formats, let's handle both
      let formattedResponse: MarisaProductsResponse
      
      if (data.pagination && data.results) {
        // Expected format
        formattedResponse = data
      } else if (data.content) {
        // Alternative format (Spring Boot style)
        formattedResponse = {
          pagination: {
            currentPage: data.number || page,
            pageSize: data.size || pageSize,
            totalPages: data.totalPages || 1,
            totalResults: data.totalElements || data.content.length
          },
          results: data.content
        }
      } else if (Array.isArray(data)) {
        // Direct array response
        formattedResponse = {
          pagination: {
            currentPage: page,
            pageSize: pageSize,
            totalPages: 1,
            totalResults: data.length
          },
          results: data
        }
      } else {
        // Unknown format, log it
        console.log('Unknown API response format:', JSON.stringify(data).substring(0, 500))
        formattedResponse = {
          pagination: {
            currentPage: page,
            pageSize: pageSize,
            totalPages: 1,
            totalResults: 0
          },
          results: []
        }
      }
      
      console.log('Formatted response:', {
        totalResults: formattedResponse.pagination.totalResults,
        resultsCount: formattedResponse.results.length,
        firstProduct: formattedResponse.results[0]
      })
      
      return formattedResponse
    } catch (error) {
      console.error('Marisa API fetch products error:', error)
      throw error
    }
  }

  // Fetch all products (handles pagination)
  async fetchAllProducts(limit?: number, startPage: number = 0): Promise<MarisaProduct[]> {
    let allProducts: MarisaProduct[] = []
    let page = startPage
    const pageSize = 500 // Use max page size for efficiency
    let hasMore = true
    
    // If limit is specified, use it. Otherwise fetch all
    const maxProducts = limit || Infinity
    
    console.log(`Starting to fetch ${limit ? `up to ${limit}` : 'all'} products from Marisa API starting at page ${startPage}...`)
    
    while (hasMore && allProducts.length < maxProducts) {
      const response = await this.fetchProducts(page, pageSize)
      
      if (response.results && response.results.length > 0) {
        allProducts = allProducts.concat(response.results)
        console.log(`Fetched page ${page + 1}/${response.pagination.totalPages} - Total products so far: ${allProducts.length}`)
      }
      
      page++
      hasMore = page < response.pagination.totalPages && allProducts.length < maxProducts
      
      // Add small delay to avoid rate limiting
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    // Trim to exact limit if specified
    if (limit && allProducts.length > limit) {
      allProducts = allProducts.slice(0, limit)
    }
    
    console.log(`Finished fetching. Total products: ${allProducts.length}`)
    return allProducts
  }

  // Fetch sales data for products
  async fetchProductSales(productCodes: string[]): Promise<MarisaSalesResponse> {
    const token = await this.authenticate()
    const salesData: MarisaSalesResponse = {}
    
    // API allows max 100 codes at a time
    const batchSize = 100
    
    for (let i = 0; i < productCodes.length; i += batchSize) {
      const batch = productCodes.slice(i, i + batchSize)
      const request: MarisaSalesRequest = {
        products: batch.map(code => ({ code }))
      }
      
      try {
        const response = await fetch(
          `${this.baseUrl}/marisaomniwebservices/v2/marisa/sellable/products/sales`,
          {
            method: 'POST', // Changed from GET to POST since we're sending a body
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(request),
          }
        )

        if (!response.ok) {
          console.error(`Failed to fetch sales for batch: ${response.status}`)
          continue
        }

        const batchData = await response.json()
        Object.assign(salesData, batchData)
      } catch (error) {
        console.error('Error fetching sales batch:', error)
      }
    }
    
    return salesData
  }
}

// Export singleton instance
export const marisaAPI = new MarisaAPI()

// Export types
export type { MarisaProduct, MarisaProductsResponse, MarisaSalesResponse } 