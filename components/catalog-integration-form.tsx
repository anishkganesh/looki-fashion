"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Package,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Sparkles,
  Database,
  Image as ImageIcon,
  Info
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"

interface ProductPreview {
  sku: string
  name: string
  price: number
  category: string
  color: string
  imageCount: number
}

interface ImportSummary {
  totalProducts: number
  totalImages: number
  categories: string[]
  priceRange: { min: number; max: number }
  timestamp: string
}

export function CatalogIntegrationForm() {
  const { user } = useAuth()
  const [isIntegrating, setIsIntegrating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState("")
  const [productPreviews, setProductPreviews] = useState<ProductPreview[]>([])
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10
  
  const [alert, setAlert] = useState<{
    type: "success" | "error" | "info" | null;
    message: string;
  }>({ type: null, message: "" })

  // Calculate pagination
  const totalPages = Math.ceil(productPreviews.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentProducts = productPreviews.slice(startIndex, endIndex)

  const handleIntegrateData = async () => {
    setAlert({ type: null, message: "" })
    setIsIntegrating(true)
    setProgress(0)
    setProgressText("Initializing Adidas catalog integration...")
    setProductPreviews([])
    setImportSummary(null)

    try {
      // Get user's brand_id
      const { data: userData, error: userError } = await supabase
        .from('usr')
        .select('brand_id')
        .eq('email', user!.email)
        .single()

      if (userError || !userData || !userData.brand_id) {
        throw new Error('User is not associated with a brand')
      }

      const brandId = userData.brand_id

      setProgress(10)
      setProgressText("Clearing existing product data...")

      // Clear existing products for this brand
      await supabase
        .from('products')
        .delete()
        .eq('brand_id', brandId)

      setProgress(20)
      setProgressText("Fetching Adidas product catalog...")

      // Fetch the CSV data
      const response = await fetch('/api/catalog/adidas')
      if (!response.ok) {
        throw new Error('Failed to fetch Adidas catalog')
      }

      const products = await response.json()
      
      setProgress(30)
      setProgressText(`Processing ${products.length} products...`)

      // Process products
      const previews: ProductPreview[] = []
      const categories = new Set<string>()
      let minPrice = Infinity
      let maxPrice = 0
      let totalImages = 0

      for (let i = 0; i < products.length; i++) {
        const product = products[i]
        
        // Update progress
        const currentProgress = 30 + (i / products.length) * 60
        setProgress(currentProgress)
        setProgressText(`Processing product ${i + 1} of ${products.length}: ${product.name}`)

        try {
          // Parse price
          const price = parseFloat(product.selling_price) || 0
          const originalPrice = product.original_price ? parseFloat(product.original_price) : price
          
          minPrice = Math.min(minPrice, price)
          maxPrice = Math.max(maxPrice, price)

          // Insert product
          const { data: newProduct, error: productError } = await supabase
            .from('products')
            .insert({
              brand_id: brandId,
              product_code: product.sku,
              product_name: product.name,
              current_price: price,
              original_price: originalPrice,
              discount_percentage: originalPrice > price ? Math.round((1 - price / originalPrice) * 100) : 0,
              currency: product.currency || 'USD',
              stock_status: product.availability || 'InStock',
              current_inventory_level: product.availability === 'InStock' ? 100 : 0,
              is_active: true,
              // Analytics fields with defaults
              revenue_last_30d: 0,
              units_sold_last_30d: 0,
              conversion_rate: 0,
              return_rate: 0,
              margin_percentage: 35, // Default margin for Adidas
              inventory_velocity: 0,
              days_of_supply: 30,
              competitor_price_index: 1.0,
              promotion_responsiveness: 0
            })
            .select()
            .single()

          if (productError || !newProduct) {
            console.error('Error inserting product:', productError)
            continue
          }

          const productId = newProduct.product_id

          // Process categories from breadcrumbs
          if (product.breadcrumbs) {
            categories.add(product.breadcrumbs)
            await supabase
              .from('product_categories')
              .insert({
                product_id: productId,
                category_level: 1,
                category_name: product.category || 'Uncategorized',
                category_path: product.breadcrumbs
              })
          }

          // Process color
          if (product.color) {
            await supabase
              .from('product_colors')
              .insert({
                product_id: productId,
                color_name: product.color,
                is_primary: true
              })
          }

          // Process images
          if (product.images) {
            const imageUrls = product.images.split('~').filter((url: string) => url.trim())
            totalImages += imageUrls.length

            for (let j = 0; j < imageUrls.length; j++) {
              await supabase
                .from('product_images')
                .insert({
                  product_id: productId,
                  image_url: imageUrls[j].trim(),
                  image_order: j,
                  is_primary: j === 0
                })
            }

            // Add preview
            if (i < products.length) { // Show all products, not just first 10
              previews.push({
                sku: product.sku,
                name: product.name,
                price: price,
                category: product.category || 'Uncategorized',
                color: product.color || 'N/A',
                imageCount: imageUrls.length
              })
            }
          }

          // Store additional attributes
          const attributes = [
            { name: 'description', value: product.description },
            { name: 'url', value: product.url },
            { name: 'source', value: product.source },
            { name: 'average_rating', value: product.average_rating },
            { name: 'reviews_count', value: product.reviews_count },
            { name: 'crawled_at', value: product.crawled_at }
          ]

          for (const attr of attributes) {
            if (attr.value) {
              await supabase
                .from('product_attributes')
                .insert({
                  product_id: productId,
                  attribute_name: attr.name,
                  attribute_value: attr.value.toString(),
                  attribute_type: 'catalog'
                })
            }
          }

        } catch (error) {
          console.error(`Error processing product ${product.sku}:`, error)
        }
      }

      setProgress(95)
      setProgressText("Finalizing import...")

      // Set import summary
      setImportSummary({
        totalProducts: products.length,
        totalImages: totalImages,
        categories: Array.from(categories),
        priceRange: { min: minPrice, max: maxPrice },
        timestamp: new Date().toISOString()
      })

      setProductPreviews(previews)
      setProgress(100)
      setProgressText("Import completed!")
      
      // Update brand's catalog integration status
      await supabase
        .from('brands')
        .update({ 
          has_catalog_integrated: true,
          catalog_integrated_at: new Date().toISOString()
        })
        .eq('brand_id', brandId)
      
      setAlert({
        type: "success",
        message: `Successfully imported ${products.length} Adidas products into your brand catalog with ${totalImages} images!`
      })

    } catch (error: any) {
      console.error('Integration error:', error)
      setAlert({
        type: "error",
        message: error.message || "Failed to integrate Adidas catalog"
      })
    } finally {
      setIsIntegrating(false)
      setTimeout(() => {
        setProgress(0)
        setProgressText("")
      }, 2000)
    }
  }

  return (
    <div className="space-y-6">
      {alert.type && (
        <Alert 
          variant={alert.type === "success" ? "success" : alert.type === "error" ? "destructive" : "info"}
        >
          {alert.type === "success" && <CheckCircle className="h-4 w-4" />}
          {alert.type === "error" && <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Adidas Product Catalog Integration
          </CardTitle>
          <CardDescription>
            Import Adidas product catalog into your brand's inventory for analysis and benchmarking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-black flex items-center justify-center">
                <span className="text-white font-bold text-lg">⚡</span>
              </div>
              <div>
                <h3 className="font-semibold">Adidas API</h3>
                <p className="text-sm text-muted-foreground">Official product data feed</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Package className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Products</p>
                <p className="text-lg font-semibold">23 Sample</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Images</p>
                <p className="text-lg font-semibold">High Quality</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Database className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Import Type</p>
                <p className="text-lg font-semibold">Demo Data</p>
              </div>
            </div>
          </div>

          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              This will import sample Adidas products into your brand's catalog for demonstration and analysis purposes.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleIntegrateData} 
            disabled={isIntegrating}
            className="w-full"
            size="lg"
          >
            {isIntegrating ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Integrating Data...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Integrate Data
              </>
            )}
          </Button>

          {isIntegrating && (
            <div className="space-y-2">
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground text-center">
                {progressText}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {importSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Import Summary
            </CardTitle>
            <CardDescription>
              Successfully imported Adidas products into your brand catalog
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-xl font-semibold">{importSummary.totalProducts}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Images</p>
                <p className="text-xl font-semibold">{importSummary.totalImages}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Categories</p>
                <p className="text-xl font-semibold">{importSummary.categories.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Price Range</p>
                <p className="text-xl font-semibold">
                  ${importSummary.priceRange.min} - ${importSummary.priceRange.max}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">Categories Imported:</h4>
              <div className="flex flex-wrap gap-2">
                {importSummary.categories.slice(0, 10).map((category, index) => (
                  <Badge key={index} variant="secondary">
                    {category}
                  </Badge>
                ))}
                {importSummary.categories.length > 10 && (
                  <Badge variant="outline">
                    +{importSummary.categories.length - 10} more
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {productPreviews.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Product Preview
            </CardTitle>
            <CardDescription>
              Sample of imported Adidas products
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Images</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentProducts.map((product, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{product.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3 text-muted-foreground" />
                        {product.price.toFixed(2)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{product.category}</Badge>
                    </TableCell>
                    <TableCell>{product.color}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <ImageIcon className="h-3 w-3 text-muted-foreground" />
                        {product.imageCount}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {startIndex + 1}-{Math.min(endIndex, productPreviews.length)} of {productPreviews.length} products
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 