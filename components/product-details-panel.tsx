"use client"

import * as React from "react"
import { useState, useEffect } from "react"
import { X, Package as PackageIcon, DollarSign, Hash, Palette, Image as ImageIcon, Plus, Sparkles, ExternalLink, BookmarkIcon, FileDownIcon, MessageSquare, StarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { createClient } from "@supabase/supabase-js"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface Product {
  product_id: number
  product_code: string
  product_name: string
  brand_id: number
  current_price: number
  original_price?: number
  currency?: string
  current_inventory_level: number
  stock_status: string
  category?: string
  subcategory?: string
  gender?: string
  color?: string
  size?: string
  material?: string
  season?: string
  created_at: string
  updated_at: string
  images?: string[]
  attributes?: {
    average_rating?: number
    description?: string
    reviews_count?: number
    [key: string]: any
  }
}

interface ProductDetailsPanelProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProductDetailsPanel({ product, open, onOpenChange }: ProductDetailsPanelProps) {
  const [imageError, setImageError] = React.useState(false)
  const [productAttributes, setProductAttributes] = React.useState<any>(null)
  const [generatingImage, setGeneratingImage] = React.useState(false)
  const [generatedImage, setGeneratedImage] = React.useState<string | null>(null)
  
  const supabase = React.useMemo(
    () => createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  // Fetch product attributes
  React.useEffect(() => {
    if (product?.product_id) {
      const fetchAttributes = async () => {
        const { data } = await supabase
          .from('product_attributes')
          .select('*')
          .eq('product_id', product.product_id)
          .single()
        
        if (data) {
          setProductAttributes(data)
        }
      }
      fetchAttributes()
    }
  }, [product?.product_id, supabase])

  const handleAddToChat = () => {
    const context = `Product: ${product?.product_name}
SKU: ${product?.product_code}
Price: ${product?.currency || '$'} ${product?.current_price}
${product?.original_price ? `Original Price: ${product?.currency || '$'} ${product?.original_price.toFixed(2)}` : ''}
Category: ${product?.category || 'N/A'}
Subcategory: ${product?.subcategory || 'N/A'}
Gender: ${product?.gender || 'N/A'}
Color: ${product?.color || 'N/A'}
Size: ${product?.size || 'N/A'}
Material: ${product?.material || 'N/A'}
Season: ${product?.season || 'N/A'}
Stock: ${product?.stock_status} (${product?.current_inventory_level} units)
${productAttributes?.description ? `Description: ${productAttributes.description}` : ''}
${productAttributes?.url ? `Product URL: ${productAttributes.url}` : ''}`

    // Dispatch event to add context to chat
    window.dispatchEvent(new CustomEvent('addChatContext', { 
      detail: { context } 
    }))
    
    // Close the panel
    onOpenChange(false)
    
    // Open the chat sidebar
    window.dispatchEvent(new CustomEvent('openChat', { 
      detail: { view: 'sidebar' } 
    }))
    
    toast.success("Product added to chat context")
  }

  const handleGenerateImage = async () => {
    if (!product) return
    
    setGeneratingImage(true)
    try {
      const prompt = `Hyperrealistic professional B2B fashion photography of ${product.product_name}. ${product.attributes?.description || ''} Category: ${product.category || 'N/A'}. Luxury commercial product photography, pristine white background, ultra high-end quality, professional studio lighting, fashion magazine quality, premium brand aesthetic, photorealistic detail, 8K resolution, award-winning commercial photography.`
      
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt })
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate image')
      }
      
      const data = await response.json()
      
      if (data.url) {
        setGeneratedImage(data.url)
        toast.success('Image generated successfully')
      }
    } catch (error: any) {
      console.error('Error generating image:', error)
      toast.error('Failed to generate image: ' + error.message)
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleExport = () => {
    const exportData = {
      product,
      attributes: productAttributes,
      exportedAt: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `product-${product?.product_code}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Product data exported')
  }

  const handleAddToWatchlist = () => {
    // Placeholder for watchlist functionality
    toast.success('Added to watchlist')
  }

  if (!product) return null

  const hasImage = product.images && product.images.length > 0 && product.images[0] && !imageError

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[540px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5" />
            Product Details
          </SheetTitle>
          <SheetDescription>
            Complete information for {product.product_name}
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* Product Image and Basic Info */}
          <div className="flex gap-4">
            <div className="w-32 h-32 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
              {hasImage ? (
                <img 
                  src={product.images![0]} 
                  alt={product.product_name}
                  className="w-full h-full object-cover rounded-lg"
                  onError={() => setImageError(true)}
                />
              ) : (
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-lg">{product.product_name}</h3>
              <p className="text-sm text-muted-foreground">SKU: {product.product_code}</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">${product.current_price}</span>
                {product.original_price && product.original_price > product.current_price && (
                  <span className="text-sm text-muted-foreground line-through">
                    ${product.original_price}
                  </span>
                )}
              </div>
              {(productAttributes?.average_rating || product.attributes?.average_rating) && (
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[...Array(5)].map((_, i) => (
                      <StarIcon 
                        key={i} 
                        className={`h-4 w-4 ${
                          i < Math.floor(productAttributes?.average_rating || product.attributes?.average_rating || 0)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {(productAttributes?.average_rating || product.attributes?.average_rating || 0).toFixed(1)}
                    {(productAttributes?.reviews_count || product.attributes?.reviews_count) && (
                      <span> ({productAttributes?.reviews_count || product.attributes?.reviews_count} reviews)</span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Description */}
          {(productAttributes?.description || product.attributes?.description) && (
            <>
              <div>
                <h3 className="text-sm font-medium mb-2">Description</h3>
                <p className="text-sm text-muted-foreground">
                  {productAttributes?.description || product.attributes?.description}
                </p>
              </div>
              <Separator />
            </>
          )}

          {/* Product Attributes */}
          <div>
            <h3 className="text-sm font-medium mb-3">Product Information</h3>
            <div className="grid grid-cols-2 gap-4">
              {product.category && (
                <div>
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <p className="font-medium">{product.category}</p>
                </div>
              )}
              {product.subcategory && (
                <div>
                  <Label className="text-xs text-muted-foreground">Subcategory</Label>
                  <p className="font-medium">{product.subcategory}</p>
                </div>
              )}
              {product.gender && (
                <div>
                  <Label className="text-xs text-muted-foreground">Gender</Label>
                  <p className="font-medium capitalize">{product.gender}</p>
                </div>
              )}
              {product.color && (
                <div>
                  <Label className="text-xs text-muted-foreground">Color</Label>
                  <p className="font-medium capitalize">{product.color}</p>
                </div>
              )}
              {product.size && (
                <div>
                  <Label className="text-xs text-muted-foreground">Size</Label>
                  <p className="font-medium">{product.size}</p>
                </div>
              )}
              {product.material && (
                <div>
                  <Label className="text-xs text-muted-foreground">Material</Label>
                  <p className="font-medium">{product.material}</p>
                </div>
              )}
              {product.season && (
                <div>
                  <Label className="text-xs text-muted-foreground">Season</Label>
                  <p className="font-medium capitalize">{product.season}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Inventory Status */}
          <div>
            <h3 className="text-sm font-medium mb-3">Inventory Status</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Current Stock</Label>
                <p className="text-2xl font-semibold">{product.current_inventory_level} units</p>
              </div>
              <div>
                <Badge 
                  variant={product.stock_status === "InStock" ? "default" : "secondary"}
                  className="text-sm"
                >
                  {product.stock_status === "InStock" ? "In Stock" : product.stock_status}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Pricing Details */}
          <div>
            <h3 className="text-sm font-medium mb-3">Pricing Details</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Current Price</Label>
                <span className="font-medium">${product.current_price.toFixed(2)}</span>
              </div>
              {product.original_price && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Original Price</Label>
                  <span className="font-medium text-muted-foreground line-through">
                    ${product.original_price.toFixed(2)}
                  </span>
                </div>
              )}
              {product.original_price && product.original_price > product.current_price && (
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Discount</Label>
                  <Badge variant="destructive">
                    {((product.original_price - product.current_price) / product.original_price * 100).toFixed(0)}% OFF
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
} 