"use client"

import * as React from "react"
import { createClient } from "@supabase/supabase-js"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BookmarkIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  ColumnsIcon,
  FileDownIcon,
  ImageIcon,
  Loader2Icon,
  PlusIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  AlertCircleIcon,
  MoreVerticalIcon,
  MessageSquare,
  Database,
  Clock,
  StopCircle,
  PlayCircle,
  SearchIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  PackageIcon,
  StarIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import axios from "axios"
import { Checkbox } from "@/components/ui/checkbox"
import { InventoryActionsTable } from "@/components/inventory-actions-table"

interface Trend {
  trend_id: number
  trend_identifier: string
  trend_category: string
  trend_description?: string
  momentum_score: number
  velocity: number
  lifecycle_stage: string
  adoption_rate: number
  social_reach: number
  conversion_impact: number
  risk_score: number
  predicted_peak_date: string
  predicted_decline_date: string
  competitor_adoption: number
  seasonality_factor: number
  // Demographic fields
  target_age_min?: number
  target_age_max?: number
  target_gender?: string
  target_locations?: string[]
  target_income_level?: string
  target_lifestyle?: string[]
  target_interests?: string[]
  last_updated: string
  created_at: string
  watchlist?: boolean
  trend_type?: 'signal' | 'forecast'
}

const columns: ColumnDef<Trend>[] = [
  {
    accessorKey: "trend_identifier",
    header: "Trend Name",
    cell: ({ row, table }) => {
      const name = row.original.trend_identifier.replace(/-/g, ' ')
      const description = row.original.trend_description
      const isWatchlisted = row.original.watchlist
      return (
        <div 
          className="flex flex-col cursor-pointer hover:text-primary"
          onClick={() => (table.options.meta as any)?.onRowClick?.(row.original)}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium capitalize">{name}</span>
            {isWatchlisted && (
              <BookmarkIcon className="h-3 w-3 text-primary fill-primary" />
            )}
          </div>
          {description && (
            <span className="text-xs text-muted-foreground line-clamp-2 max-w-md">
              {description}
            </span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "trend_category",
    header: "Category",
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize">
        {row.original.trend_category}
      </Badge>
    ),
  },
  {
    accessorKey: "lifecycle_stage",
    header: "Status",
    cell: ({ row }) => {
      const stage = row.original.lifecycle_stage
      const getIcon = () => {
        switch (stage) {
          case 'emerging':
          case 'growing':
            return <TrendingUpIcon className="h-3 w-3" />
          case 'declining':
            return <TrendingDownIcon className="h-3 w-3" />
          case 'peak':
            return <MinusIcon className="h-3 w-3" />
          default:
            return null
        }
      }
      const getVariant = () => {
        switch (stage) {
          case 'emerging':
          case 'growing':
            return 'default'
          case 'peak':
            return 'secondary'
          case 'declining':
          case 'dormant':
            return 'outline'
          default:
            return 'outline'
        }
      }
      return (
        <Badge variant={getVariant()} className="capitalize gap-1">
          {getIcon()}
          {stage}
        </Badge>
      )
    },
  },
  {
    accessorKey: "momentum_score",
    header: "Momentum",
    cell: ({ row }) => {
      const score = row.original.momentum_score
      const color = score > 70 ? 'text-green-600' : score > 40 ? 'text-yellow-600' : 'text-red-600'
      return <span className={`font-medium ${color}`}>{score.toFixed(0)}</span>
    },
  },
  {
    accessorKey: "velocity",
    header: "Velocity",
    cell: ({ row }) => {
      const velocity = row.original.velocity
      return (
        <div className="flex items-center gap-1">
          {velocity > 10 ? (
            <TrendingUpIcon className="h-3 w-3 text-green-600" />
          ) : velocity < 5 ? (
            <TrendingDownIcon className="h-3 w-3 text-red-600" />
          ) : (
            <MinusIcon className="h-3 w-3 text-yellow-600" />
          )}
          <span>{velocity.toFixed(1)}</span>
        </div>
      )
    },
  },
  {
    accessorKey: "adoption_rate",
    header: "Adoption",
    cell: ({ row }) => {
      const rate = row.original.adoption_rate
      return <span>{(rate * 100).toFixed(0)}%</span>
    },
  },
  {
    accessorKey: "social_reach",
    header: "Social Reach",
    cell: ({ row }) => {
      const reach = row.original.social_reach
      const formatted = reach > 1000000 
        ? `${(reach / 1000000).toFixed(1)}M` 
        : reach > 1000 
        ? `${(reach / 1000).toFixed(0)}K`
        : reach.toString()
      return <span>{formatted}</span>
    },
  },
  {
    accessorKey: "risk_score",
    header: "Risk",
    cell: ({ row }) => {
      const risk = row.original.risk_score
      const percentage = (risk * 100).toFixed(0)
      return <span>{percentage}%</span>
    },
  },
  {
    accessorKey: "conversion_impact",
    header: "Impact",
    cell: ({ row }) => {
      const impact = row.original.conversion_impact
      const percentage = (impact * 100).toFixed(0)
      return <span>{percentage}%</span>
    },
  },
  {
    accessorKey: "created_at",
    header: "Added",
    cell: ({ row }) => {
      const date = new Date(row.original.created_at)
      const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
      return (
        <div className="text-sm text-muted-foreground">
          {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}
        </div>
      )
    },
  },
  {
    accessorKey: "last_updated",
    header: "Last Updated",
    cell: ({ row }) => {
      const date = new Date(row.original.last_updated)
      return <span className="text-sm text-muted-foreground">{date.toLocaleDateString()}</span>
    },
  },
]

function TrendDetailSheet({ trend, open, onOpenChange, onUpdateTrend }: { 
  trend: Trend | null, 
  open: boolean, 
  onOpenChange: (open: boolean) => void,
  onUpdateTrend: (trend: Trend) => void
}) {
  const router = useRouter()
  const [generatedImage, setGeneratedImage] = React.useState<string | null>(null)
  const [generatingImage, setGeneratingImage] = React.useState(false)
  const supabase = React.useMemo(
    () => createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )
  
  // Reset generated image when trend changes
  React.useEffect(() => {
    if (trend) {
      setGeneratedImage(null)
      setGeneratingImage(false)
    }
  }, [trend?.trend_id])
  
  if (!trend) return null

  const handleGenerateImage = async () => {
    setGeneratingImage(true)
    try {
      const trendName = trend.trend_identifier.replace(/-/g, ' ')
      const prompt = `Fashion photography showcasing ${trendName} trend. ${trend.trend_description || ''} Style: ${trend.trend_category}, ${trend.lifecycle_stage} trend. High fashion editorial photography, professional lighting, realistic.`
      
      const response = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
          model: 'dall-e-3',
          prompt: prompt.slice(0, 1000), // DALL-E 3 has a 1000 char limit
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          style: 'natural'
        },
        {
          headers: {
            'Authorization': `Bearer REDACTED_OPENAI_KEY`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      if (response.data && response.data.data && response.data.data[0]) {
        setGeneratedImage(response.data.data[0].url)
        toast.success('Image generated successfully')
      }
    } catch (error: any) {
      console.error('Error generating image:', error)
      toast.error('Failed to generate image: ' + (error.response?.data?.error?.message || error.message))
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleAddToWatchlist = async () => {
    try {
      const { error } = await supabase
        .from('trends')
        .update({ watchlist: !trend.watchlist })
        .eq('trend_id', trend.trend_id)
      
      if (error) {
        throw error
      }
      
      toast.success(trend.watchlist ? 'Removed from watchlist' : 'Added to watchlist')
      onUpdateTrend({ ...trend, watchlist: !trend.watchlist })
    } catch (error) {
      console.error('Error updating watchlist:', error)
      toast.error('Failed to update watchlist')
    }
  }

  const handleExport = () => {
    const data = JSON.stringify(trend, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trend-${trend.trend_identifier}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Trend data exported')
  }

  const handleAddContext = () => {
    // Format trend data as context
    const contextData = `Context from Trend: ${trend.trend_identifier.replace(/-/g, ' ')}\n` +
      `Category: ${trend.trend_category}\n` +
      `Lifecycle Stage: ${trend.lifecycle_stage}\n` +
      `Momentum Score: ${trend.momentum_score.toFixed(1)}\n` +
      `Velocity: ${trend.velocity.toFixed(1)}\n` +
      `Adoption Rate: ${(trend.adoption_rate * 100).toFixed(0)}%\n` +
      `Social Reach: ${trend.social_reach.toLocaleString()}\n` +
      `Risk Score: ${(trend.risk_score * 100).toFixed(0)}%\n` +
      `Conversion Impact: ${(trend.conversion_impact * 100).toFixed(0)}%\n` +
      `Description: ${trend.trend_description || 'N/A'}`;
    
    // Dispatch event to add context to chat
    window.dispatchEvent(new CustomEvent('addChatContext', { 
      detail: { context: contextData } 
    }));
    
    // Close the sheet
    onOpenChange(false);
    
    // Open the chat sidebar
    window.dispatchEvent(new CustomEvent('openChat', { 
      detail: { view: 'sidebar' } 
    }));
    
    toast.success('Context added to chat');
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[540px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="capitalize">{trend.trend_identifier.replace(/-/g, ' ')}</SheetTitle>
          <SheetDescription>
            {trend.trend_description}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={trend.watchlist ? "default" : "outline"} 
                    size="sm" 
                    onClick={handleAddToWatchlist}
                  >
                    <BookmarkIcon className={`h-4 w-4 ${trend.watchlist ? 'fill-current' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {trend.watchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <FileDownIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export Data</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleGenerateImage}
                    disabled={generatingImage}
                  >
                    {generatingImage ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Generate Image</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddContext}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add to Chat</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {generatedImage && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Generated Image</Label>
              <img 
                src={generatedImage} 
                alt={`${trend.trend_identifier} fashion trend`}
                className="w-full rounded-lg border"
                style={{ maxHeight: '400px', objectFit: 'cover' }}
              />
            </div>
          )}
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Category</Label>
              <p className="capitalize font-medium">{trend.trend_category}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Lifecycle Stage</Label>
              <p className="capitalize font-medium">{trend.lifecycle_stage}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Momentum Score</Label>
              <p className="font-medium">{trend.momentum_score.toFixed(1)}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Velocity</Label>
              <p className="font-medium">{trend.velocity.toFixed(1)}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Adoption Rate</Label>
              <p className="font-medium">{(trend.adoption_rate * 100).toFixed(0)}%</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Social Reach</Label>
              <p className="font-medium">{trend.social_reach.toLocaleString()}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Risk Score</Label>
              <p className="font-medium">{(trend.risk_score * 100).toFixed(0)}%</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Conversion Impact</Label>
              <p className="font-medium">{(trend.conversion_impact * 100).toFixed(0)}%</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Competitor Adoption</Label>
              <p className="font-medium">{(trend.competitor_adoption * 100).toFixed(0)}%</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Seasonality Factor</Label>
              <p className="font-medium">{(trend.seasonality_factor * 100).toFixed(0)}%</p>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <Label className="text-sm text-muted-foreground">Predicted Timeline</Label>
            <div className="mt-2 space-y-1">
              <p className="text-sm">Peak Date: <span className="font-medium">{new Date(trend.predicted_peak_date).toLocaleDateString()}</span></p>
              <p className="text-sm">Decline Date: <span className="font-medium">{new Date(trend.predicted_decline_date).toLocaleDateString()}</span></p>
            </div>
          </div>
          
          <Separator />
          
          <div>
            <Label className="text-sm text-muted-foreground mb-2">Demographics</Label>
            <div className="space-y-2 mt-2">
              {(trend.target_age_min || trend.target_age_max || trend.target_gender || 
                trend.target_locations || trend.target_income_level || 
                trend.target_lifestyle || trend.target_interests) ? (
                <>
                  <div>
                    <p className="text-sm font-medium">Age Range:</p>
                    <p className="text-sm text-muted-foreground">
                      {trend.target_age_min && trend.target_age_max 
                        ? `${trend.target_age_min}-${trend.target_age_max} years`
                        : 'All ages'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Gender:</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {trend.target_gender || 'All genders'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Locations:</p>
                    <p className="text-sm text-muted-foreground">
                      {trend.target_locations?.join(', ') || 'Global'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Income Level:</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {trend.target_income_level || 'All income levels'}
                    </p>
                  </div>
                  {trend.target_lifestyle && trend.target_lifestyle.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">Lifestyle:</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {trend.target_lifestyle.join(', ')}
                      </p>
                    </div>
                  )}
                  {trend.target_interests && trend.target_interests.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">Interests:</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {trend.target_interests.join(', ')}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No demographic data available</p>
              )}
            </div>
          </div>
          
          <Separator />
          
          <div className="text-sm text-muted-foreground">
            <p>Created: {new Date(trend.created_at).toLocaleString()}</p>
            <p>Last Updated: {new Date(trend.last_updated).toLocaleString()}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ProductDetailSheet({ product, open, onOpenChange }: { 
  product: any | null, 
  open: boolean, 
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [generatedImage, setGeneratedImage] = React.useState<string | null>(null)
  const [generatingImage, setGeneratingImage] = React.useState(false)
  
  // Reset generated image when product changes
  React.useEffect(() => {
    if (product) {
      setGeneratedImage(null)
      setGeneratingImage(false)
    }
  }, [product?.product_id])
  
  if (!product) return null

  const handleGenerateImage = async () => {
    setGeneratingImage(true)
    try {
      const prompt = `Product photography for ${product.product_name}. ${product.product_description || ''} Category: ${product.category}. Professional e-commerce photography, white background, high quality.`
      
      const response = await axios.post(
        'https://api.openai.com/v1/images/generations',
        {
          model: 'dall-e-3',
          prompt: prompt.slice(0, 1000),
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          style: 'natural'
        },
        {
          headers: {
            'Authorization': `Bearer REDACTED_OPENAI_KEY`,
            'Content-Type': 'application/json'
          }
        }
      )
      
      if (response.data && response.data.data && response.data.data[0]) {
        setGeneratedImage(response.data.data[0].url)
        toast.success('Image generated successfully')
      }
    } catch (error: any) {
      console.error('Error generating image:', error)
      toast.error('Failed to generate image: ' + (error.response?.data?.error?.message || error.message))
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleExport = () => {
    const data = JSON.stringify(product, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `product-${product.product_code}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Product data exported')
  }

  const handleAddContext = () => {
    // Format product data as context
    const contextData = `Context from Product: ${product.product_name}\n` +
      `SKU: ${product.product_code}\n` +
      `Category: ${product.category}\n` +
      `Price: $${product.current_price}\n` +
      `Stock Status: ${product.stock_status}\n` +
      `Inventory: ${product.current_inventory_level || 0} units\n` +
      `Color: ${product.color || 'N/A'}\n` +
      `Description: ${product.product_description || 'N/A'}`;
    
    // Dispatch event to add context to chat
    window.dispatchEvent(new CustomEvent('addChatContext', { 
      detail: { context: contextData } 
    }));
    
    // Close the sheet
    onOpenChange(false);
    
    // Open the chat sidebar
    window.dispatchEvent(new CustomEvent('openChat', { 
      detail: { view: 'sidebar' } 
    }));
    
    toast.success('Context added to chat');
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[540px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{product.product_name}</SheetTitle>
          <SheetDescription>
            SKU: {product.product_code}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" onClick={handleExport}>
                    <FileDownIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Export Data</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleGenerateImage}
                    disabled={generatingImage}
                  >
                    {generatingImage ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Generate Image</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddContext}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add to Chat</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => window.open(`https://www.adidas.com/us/search?q=${encodeURIComponent(product.product_code)}`, '_blank')}
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Product</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          
          {/* Product Images */}
          {(product.images && product.images.length > 0) || generatedImage ? (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Product Images</Label>
              <div className="grid grid-cols-2 gap-2">
                {generatedImage && (
                  <img 
                    src={generatedImage} 
                    alt="Generated product image"
                    className="w-full rounded-lg border object-cover aspect-square"
                  />
                )}
                {product.images?.map((image: string, index: number) => (
                  <img 
                    key={index}
                    src={image} 
                    alt={`${product.product_name} ${index + 1}`}
                    className="w-full rounded-lg border object-cover aspect-square"
                  />
                ))}
              </div>
            </div>
          ) : null}
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Category</Label>
              <p className="font-medium">{product.category}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Brand</Label>
              <p className="font-medium">{product.brand_name || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Current Price</Label>
              <p className="font-medium">
                {product.currency === 'USD' ? '$' : product.currency} {product.current_price?.toFixed(2)}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Original Price</Label>
              <div className="font-medium">
                {product.currency === 'USD' ? '$' : product.currency} {product.original_price?.toFixed(2)}
                {product.discount_percentage > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    -{product.discount_percentage}%
                  </Badge>
                )}
              </div>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Stock Status</Label>
              <div className="mt-1">
                <Badge 
                  variant={product.stock_status === "InStock" ? "default" : "secondary"}
                  className={product.stock_status === "InStock" ? "bg-green-500 text-white" : ""}
                >
                  {product.stock_status}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Inventory Level</Label>
              <p className="font-medium">{product.current_inventory_level || 0} units</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Color</Label>
              <p className="font-medium">{product.color || 'N/A'}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Material</Label>
              <p className="font-medium">{product.material || 'N/A'}</p>
            </div>
          </div>
          
          {product.size_range && product.size_range.length > 0 && (
            <>
              <Separator />
              <div>
                <Label className="text-sm text-muted-foreground">Available Sizes</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {product.size_range.map((size: string) => (
                    <Badge key={size} variant="secondary">
                      {size}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {product.product_description && (
            <>
              <Separator />
              <div>
                <Label className="text-sm text-muted-foreground">Description</Label>
                <p className="mt-2 text-sm">{product.product_description}</p>
              </div>
            </>
          )}
          
          <Separator />
          
          <div>
            <Label className="text-sm text-muted-foreground mb-2">Product Details</Label>
            <div className="space-y-2 mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Gender</span>
                <span className="font-medium">{product.gender || 'Unisex'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Season</span>
                <span className="font-medium">{product.season || 'All Season'}</span>
              </div>
            </div>
          </div>
          
          <Separator />
          
          <div className="text-sm text-muted-foreground">
            <p>Added: {new Date(product.created_at).toLocaleString()}</p>
            <p>Last Updated: {new Date(product.updated_at).toLocaleString()}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function DataTableTrends({ onTabChange, session }: { 
  onTabChange?: (tab: 'trends' | 'catalog' | 'inventory' | 'forecast') => void
  session?: any
}) {
  const [data, setData] = React.useState<Trend[]>([])
  const [loading, setLoading] = React.useState(true)
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'created_at', desc: true }
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [selectedTrend, setSelectedTrend] = React.useState<Trend | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'trends' | 'catalog' | 'inventory' | 'forecast'>('trends')
  const [searchQuery, setSearchQuery] = React.useState("")
  const [catalogProducts, setCatalogProducts] = React.useState<any[]>([])
  const [catalogLoading, setCatalogLoading] = React.useState(false)
  const [catalogSorting, setCatalogSorting] = React.useState<SortingState>([
    { id: 'created_at', desc: true }
  ])
  const [inventorySorting, setInventorySorting] = React.useState<SortingState>([
    { id: 'confidence_score', desc: true }
  ])
  const [userBrandId, setUserBrandId] = React.useState<number | null>(null)
  const [inventoryCount, setInventoryCount] = React.useState(0)
  const [productCount, setProductCount] = React.useState(0)
  const [generating, setGenerating] = React.useState(false)
  const [generationProgress, setGenerationProgress] = React.useState("")
  const inventoryTableRef = React.useRef<any>(null)

  const supabase = React.useMemo(
    () => createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  // Fetch user's brand ID and product count
  React.useEffect(() => {
    const fetchUserBrandId = async () => {
      if (!session?.user?.email) return
      
      try {
        const { data: userData, error: userError } = await supabase
          .from('usr')
          .select('brand_id')
          .eq('email', session.user.email)
          .single()
        
        if (userError) throw userError
        
        if (userData?.brand_id) {
          setUserBrandId(userData.brand_id)
          
          // Fetch product count
          const { count: prodCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', userData.brand_id)
            .eq('is_active', true)
          
          setProductCount(prodCount || 0)
        }
      } catch (error) {
        console.error('Error fetching user brand:', error)
      }
    }
    
    fetchUserBrandId()
  }, [session, supabase])

  // Fetch catalog products
  const fetchCatalogProducts = React.useCallback(async () => {
    try {
      setCatalogLoading(true)
      console.log('Fetching catalog products, session:', session)
      
      if (!session?.access_token) {
        console.error('No session found')
        setCatalogLoading(false)
        return
      }
      
      const response = await fetch('/api/catalog/products', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      console.log('Catalog response status:', response.status)
      
      if (response.ok) {
        const result = await response.json()
        console.log('Catalog products result:', result)
        
        // Fetch additional attributes for each product
        if (result.products && result.products.length > 0) {
          const productIds = result.products.map((p: any) => p.product_id)
          
          // Fetch product attributes
          const { data: attributes } = await supabase
            .from('product_attributes')
            .select('*')
            .in('product_id', productIds)
          
          // Fetch product colors
          const { data: colors } = await supabase
            .from('product_colors')
            .select('product_id, color_name')
            .in('product_id', productIds)
          
          // Fetch product categories for gender info
          const { data: categories } = await supabase
            .from('product_categories')
            .select('product_id, category_path')
            .in('product_id', productIds)
          
          // Map attributes to products
          const attributesMap = new Map()
          attributes?.forEach(attr => {
            if (!attributesMap.has(attr.product_id)) {
              attributesMap.set(attr.product_id, {})
            }
            // Store all attributes by name
            attributesMap.get(attr.product_id)[attr.attribute_name] = attr.attribute_value
          })
          
          const colorsMap = new Map()
          colors?.forEach(color => {
            if (!colorsMap.has(color.product_id)) {
              colorsMap.set(color.product_id, [])
            }
            colorsMap.get(color.product_id).push(color.color_name)
          })
          
          const categoriesMap = new Map()
          categories?.forEach(cat => {
            categoriesMap.set(cat.product_id, cat.category_path)
          })
          
          // Enhance products with additional data
          const enhancedProducts = result.products.map((product: any) => {
            const attrs = attributesMap.get(product.product_id) || {}
            const productColors = colorsMap.get(product.product_id) || []
            const categoryPath = categoriesMap.get(product.product_id) || ''
            
            // Extract gender from category path (e.g., "Women/Clothing" -> "Women")
            const gender = categoryPath.split('/')[0] || product.gender
            
            return {
              ...product,
              color: productColors.join(', ') || product.color || 'N/A',
              gender: gender || 'Unisex',
              average_rating: attrs.average_rating ? parseFloat(attrs.average_rating) : null,
              description: attrs.description || null,
              reviews_count: attrs.reviews_count ? parseInt(attrs.reviews_count) : null,
              attributes: attrs
            }
          })
          
          setCatalogProducts(enhancedProducts)
        } else {
          setCatalogProducts(result.products || [])
        }
      } else {
        const error = await response.text()
        console.error('Catalog fetch error:', error)
      }
    } catch (error) {
      console.error('Error fetching catalog products:', error)
    } finally {
      setCatalogLoading(false)
    }
  }, [session, supabase])

  // Debug catalog count
  React.useEffect(() => {
    console.log('Catalog count updated:', catalogProducts.length)
  }, [catalogProducts.length])

  // Fetch trends from API (bypasses RLS)
  const fetchTrends = React.useCallback(async () => {
    try {
      // Only show loading on initial load
      if (loading) {
        setLoading(true)
      }
      
      console.log('Fetching trends from API...')
      const response = await fetch('/api/trends', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      console.log('Response status:', response.status)
      const result = await response.json()
      console.log('Response data:', result)

      if (!response.ok || !result.success) {
        console.error('Error fetching trends:', result.error || 'Unknown error')
        toast.error('Failed to load trends: ' + (result.error || 'Unknown error'))
      } else {
        setData(result.trends || [])
        console.log('Loaded trends:', result.trends?.length || 0)
      }
    } catch (error) {
      console.error('Network error:', error)
      toast.error('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }, [loading])

  React.useEffect(() => {
    fetchTrends()
    if (session) {
      fetchCatalogProducts()
    }
    
    // Listen for refresh event from dashboard
    const handleRefreshEvent = () => {
      console.log('Refreshing trends table...')
      fetchTrends()
    }
    
    window.addEventListener('refreshTrends', handleRefreshEvent)
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('trends-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'trends' },
        (payload) => {
          console.log('Trend change:', payload)
          
          // Handle changes optimistically based on event type
          if (payload.eventType === 'UPDATE' && payload.new) {
            // Update the specific trend without refetching all data
            setData(prevData => prevData.map(trend => 
              trend.trend_id === payload.new.trend_id ? payload.new as Trend : trend
            ))
          } else if (payload.eventType === 'INSERT' && payload.new) {
            // Add new trend at the beginning and sort by last_updated
            setData(prevData => {
              const newData = [payload.new as Trend, ...prevData]
              // Sort by last_updated desc
              return newData.sort((a, b) => 
                new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
              )
            })
          } else if (payload.eventType === 'DELETE' && payload.old) {
            // Remove deleted trend
            setData(prevData => prevData.filter(trend => 
              trend.trend_id !== (payload.old as any).trend_id
            ))
          } else {
            // For other cases, refetch data
            fetchTrends()
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status)
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to trends changes')
        }
      })

    return () => {
      window.removeEventListener('refreshTrends', handleRefreshEvent)
      subscription.unsubscribe()
    }
  }, [supabase, fetchTrends, fetchCatalogProducts, session])

  // Fetch catalog products when session is available
  React.useEffect(() => {
    if (session && userBrandId) {
      console.log('Session and brand available, fetching catalog...')
      fetchCatalogProducts()
    }
  }, [session, userBrandId, fetchCatalogProducts])

  const handleUpdateTrend = React.useCallback((updatedTrend: Trend) => {
    // Update locally without refetching
    setData(prevData => prevData.map(trend => 
      trend.trend_id === updatedTrend.trend_id ? updatedTrend : trend
    ))
    setSelectedTrend(updatedTrend)
  }, [])

  // Get current sort label
  const getCurrentSortLabel = () => {
    if (sorting.length === 0) return 'Sort by'
    const sortField = sorting[0].id
    const sortMap: Record<string, string> = {
      'created_at': 'Created Date',
      'last_updated': 'Last Updated',
      'momentum_score': 'Momentum Score',
      'velocity': 'Velocity',
      'social_reach': 'Social Reach',
      'risk_score': 'Risk Score'
    }
    return sortMap[sortField] || 'Sort by'
  }

  // Filter data based on active tab
  const filteredData = React.useMemo(() => {
    console.log('Total data length:', data.length)
    console.log('Active tab:', activeTab)
    console.log('Sample trend type:', data[0]?.trend_type)
    
    if (activeTab === 'trends') {
      // Show all trends that are not explicitly forecast
      const filtered = data.filter(trend => trend.trend_type !== 'forecast')
      console.log('Filtered signal trends:', filtered.length)
      return filtered
    } else if (activeTab === 'forecast') {
      const filtered = data.filter(trend => trend.trend_type === 'forecast')
      console.log('Filtered forecast trends:', filtered.length)
      return filtered
    }
    return data
  }, [data, activeTab])

  // Calculate counts for each tab
  const signalCount = React.useMemo(() => 
    data.filter(trend => trend.trend_type !== 'forecast').length, 
    [data]
  )
  
  const forecastCount = React.useMemo(() => 
    data.filter(trend => trend.trend_type === 'forecast').length, 
    [data]
  )

  const table = useReactTable({
    data: filteredData,  // Use filtered data instead of raw data
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
    meta: {
      onRowClick: (trend: Trend) => {
        setSelectedTrend(trend)
        setSheetOpen(true)
      }
    }
  })

  // Update parent when tab changes
  const handleTabChange = (value: string) => {
    const tab = value as 'trends' | 'catalog' | 'inventory' | 'forecast'
    setActiveTab(tab)
    
    // Refresh catalog when switching to catalog tab
    if (tab === 'catalog' && session) {
      console.log('Switching to catalog tab, refreshing products...')
      fetchCatalogProducts()
    }
    
    if (onTabChange) {
      onTabChange(tab)
    }
  }

  // Fetch inventory actions count
  const fetchInventoryCount = React.useCallback(async () => {
    if (!userBrandId) return
    
    try {
      const { count, error } = await supabase
        .from('recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', userBrandId)
        .eq('is_active', true)
      
      if (!error && count !== null) {
        setInventoryCount(count)
      }
    } catch (error) {
      console.error('Error fetching inventory count:', error)
    }
  }, [userBrandId, supabase])

  React.useEffect(() => {
    if (userBrandId) {
      fetchInventoryCount()
    }
  }, [userBrandId, fetchInventoryCount])

  // Generate recommendations handler
  const handleGenerateRecommendations = React.useCallback(async () => {
    if (!userBrandId) return
    
    try {
      setGenerating(true)
      setGenerationProgress("Analyzing product catalog...")
      
      // Add delay to show progress
      setTimeout(() => setGenerationProgress("Identifying relevant fashion trends..."), 800)
      setTimeout(() => setGenerationProgress("Matching products with trends..."), 2000)
      setTimeout(() => setGenerationProgress("Calculating alignment scores..."), 3500)
      setTimeout(() => setGenerationProgress("Generating personalized recommendations..."), 5000)
      setTimeout(() => setGenerationProgress("Finalizing recommendations..."), 6500)
      
      const response = await fetch('/api/recommendations/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ brand_id: userBrandId })
      })

      if (!response.ok) {
        throw new Error('Failed to generate recommendations')
      }

      const result = await response.json()
      toast.success(`Generated ${result.recommendations_count} recommendations`)
      
      // Refresh inventory count
      await fetchInventoryCount()
      
      // Trigger refresh in inventory table
      if (inventoryTableRef.current?.fetchRecommendations) {
        inventoryTableRef.current.fetchRecommendations()
      }
    } catch (error) {
      console.error('Error generating recommendations:', error)
      toast.error('Failed to generate recommendations')
    } finally {
      setGenerating(false)
      setGenerationProgress("")
    }
  }, [userBrandId])

  // Get current catalog sort label
  const getCurrentCatalogSortLabel = () => {
    if (catalogSorting.length === 0) return 'Product Name'
    const sortField = catalogSorting[0].id
    const sortMap: Record<string, string> = {
      'product_name': 'Product Name',
      'product_code': 'SKU',
      'current_price': 'Price',
      'category': 'Category',
      'stock_status': 'Stock Status',
      'created_at': 'Date Added'
    }
    return sortMap[sortField] || 'Sort by'
  }

  // Get current inventory sort label
  const getCurrentInventorySortLabel = () => {
    if (inventorySorting.length === 0) return 'Confidence Score'
    const sortField = inventorySorting[0].id
    const sortMap: Record<string, string> = {
      'confidence_score': 'Confidence Score',
      'alignment_score': 'Match Score',
      'recommendation_action': 'Action Type',
      'product_name': 'Product Name',
      'trend_identifier': 'Trend Name'
    }
    return sortMap[sortField] || 'Sort by'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="text-muted-foreground">Loading trends...</div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Progress message for recommendations */}
        {generating && generationProgress && (
          <div className="text-sm text-muted-foreground animate-pulse">
            {generationProgress}
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="grid w-fit grid-cols-4">
              <TabsTrigger value="trends" className="flex items-center gap-2">
              Trend Signals
                {data.filter(t => t.trend_type !== 'forecast').length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {data.filter(t => t.trend_type !== 'forecast').length}
                </Badge>
              )}
            </TabsTrigger>
              <TabsTrigger value="catalog" className="flex items-center gap-2">
                Catalog Matches
                {catalogProducts.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {catalogProducts.length}
              </Badge>
                )}
            </TabsTrigger>
              <TabsTrigger value="inventory" className="flex items-center gap-2">
                Inventory Actions
                {inventoryCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {inventoryCount}
              </Badge>
                )}
            </TabsTrigger>
              <TabsTrigger value="forecast" className="flex items-center gap-2">
              Trend Forecasts
                {data.filter(t => t.trend_type === 'forecast').length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {data.filter(t => t.trend_type === 'forecast').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
              {/* Status Badges */}
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="gap-1">
                  <Database className="h-3 w-3" />
                  {data.length} trends
                </Badge>
                {productCount > 0 && (
                  <Badge variant="outline" className="gap-1">
                    <PackageIcon className="h-3 w-3" />
                    {productCount} products
                  </Badge>
                )}
              </div>
              
              {/* Universal Search Bar */}
              <div className="relative">
                <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={
                    activeTab === 'trends' ? "Search trends..." :
                    activeTab === 'catalog' ? "Search products..." :
                    activeTab === 'inventory' ? "Search inventory..." :
                    "Search forecasts..."
                  }
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    // For inventory tab, update the table filter
                    if (activeTab === 'inventory' && inventoryTableRef.current?.setSearchFilter) {
                      inventoryTableRef.current.setSearchFilter(e.target.value)
                    }
                  }}
                  className="pl-8 w-[300px]"
                />
              </div>
              {activeTab !== 'catalog' && activeTab !== 'inventory' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ColumnsIcon className="mr-2 h-4 w-4" />
                  <span className="hidden lg:inline">{getCurrentSortLabel()}</span>
                  <span className="lg:hidden">Sort</span>
                  <ChevronDownIcon className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => setSorting([{ id: 'created_at', desc: true }])}>
                  Created Date (Newest First)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSorting([{ id: 'last_updated', desc: true }])}>
                  Last Updated
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSorting([{ id: 'momentum_score', desc: true }])}>
                  Momentum Score
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSorting([{ id: 'velocity', desc: true }])}>
                  Velocity
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSorting([{ id: 'social_reach', desc: true }])}>
                  Social Reach
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSorting([{ id: 'risk_score', desc: false }])}>
                  Risk Score (Low to High)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
              )}
              {activeTab === 'catalog' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <ColumnsIcon className="mr-2 h-4 w-4" />
                      <span className="hidden lg:inline">{getCurrentCatalogSortLabel()}</span>
                      <span className="lg:hidden">Sort</span>
                      <ChevronDownIcon className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'product_name', desc: false }])}>
                      Product Name
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'product_code', desc: false }])}>
                      SKU
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'current_price', desc: false }])}>
                      Price (Low to High)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'current_price', desc: true }])}>
                      Price (High to Low)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'category', desc: false }])}>
                      Category
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'stock_status', desc: false }])}>
                      Stock Status
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'created_at', desc: true }])}>
                      Date Added (Newest First)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {activeTab === 'inventory' && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ColumnsIcon className="mr-2 h-4 w-4" />
                        <span className="hidden lg:inline">{getCurrentInventorySortLabel()}</span>
                        <span className="lg:hidden">Sort</span>
                        <ChevronDownIcon className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => {
                        setInventorySorting([{ id: 'confidence_score', desc: true }])
                        inventoryTableRef.current?.setSorting([{ id: 'confidence_score', desc: true }])
                      }}>
                        Confidence Score (High to Low)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setInventorySorting([{ id: 'alignment_score', desc: true }])
                        inventoryTableRef.current?.setSorting([{ id: 'alignment_score', desc: true }])
                      }}>
                        Match Score (High to Low)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setInventorySorting([{ id: 'recommendation_action', desc: false }])
                        inventoryTableRef.current?.setSorting([{ id: 'recommendation_action', desc: false }])
                      }}>
                        Action Type
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setInventorySorting([{ id: 'product_name', desc: false }])
                        inventoryTableRef.current?.setSorting([{ id: 'product_name', desc: false }])
                      }}>
                        Product Name (A-Z)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setInventorySorting([{ id: 'trend_identifier', desc: false }])
                        inventoryTableRef.current?.setSorting([{ id: 'trend_identifier', desc: false }])
                      }}>
                        Trend Name (A-Z)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    onClick={handleGenerateRecommendations}
                    disabled={generating}
                    size="sm"
                  >
                    {generating ? (
                      <>
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCwIcon className="mr-2 h-4 w-4" />
                        Generate Recommendations
                      </>
                    )}
                  </Button>
                </>
              )}
            <Button variant="outline" size="sm">
              <PlusIcon className="mr-2 h-4 w-4" />
              <span className="hidden lg:inline">Add Section</span>
            </Button>
          </div>
        </div>
        <div className="w-full">
          <TabsContent value="trends" className="flex flex-col gap-4 m-0 p-0">
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted font-sans">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody className="font-sans">
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        No trends found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between px-4">
              <div className="flex-1 text-sm text-muted-foreground">
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
                {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredData.length)} of {filteredData.length} trends
              </div>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                    <Label htmlFor="rows-per-page-trends" className="text-sm font-medium">
                    Rows per page
                  </Label>
                  <Select
                    value={`${table.getState().pagination.pageSize}`}
                    onValueChange={(value) => {
                      table.setPageSize(Number(value))
                    }}
                  >
                      <SelectTrigger className="w-20" id="rows-per-page-trends">
                      <SelectValue placeholder={table.getState().pagination.pageSize} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {[10, 20, 30, 40, 50].map((pageSize) => (
                        <SelectItem key={pageSize} value={`${pageSize}`}>
                          {pageSize}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-fit items-center justify-center text-sm font-medium">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronsLeftIcon className="h-4 w-4" />
                    <span className="sr-only">Go to first page</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    <span className="sr-only">Go to previous page</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                    <span className="sr-only">Go to next page</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronsRightIcon className="h-4 w-4" />
                    <span className="sr-only">Go to last page</span>
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="catalog" className="flex flex-col gap-4 m-0 p-0">
              {catalogLoading ? (
            <div className="flex items-center justify-center py-10 rounded-lg border">
                  <div className="text-muted-foreground">Loading catalog...</div>
            </div>
              ) : (
                <CatalogTable 
                  products={catalogProducts} 
                  searchQuery={searchQuery}
                  sorting={catalogSorting}
                  onSortingChange={setCatalogSorting}
                />
              )}
          </TabsContent>
          
          <TabsContent value="inventory" className="flex flex-col gap-4 m-0 p-0">
              {session?.user && userBrandId ? (
                <InventoryActionsTable 
                  ref={inventoryTableRef}
                  brandId={userBrandId} 
                  session={session}
                  onRecommendationsGenerated={fetchInventoryCount}
                />
              ) : (
            <div className="flex items-center justify-center py-10 rounded-lg border">
                  <div className="text-muted-foreground">
                    {!session?.user ? "Please log in to view inventory actions" : "Loading..."}
            </div>
                </div>
              )}
          </TabsContent>
          
          <TabsContent value="forecast" className="flex flex-col gap-4 m-0 p-0">
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-muted font-sans">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => {
                        return (
                          <TableHead key={header.id}>
                            {header.isPlaceholder
                              ? null
                              : flexRender(
                                  header.column.columnDef.header,
                                  header.getContext()
                                )}
                          </TableHead>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody className="font-sans">
                  {table.getRowModel().rows?.length ? (
                    table.getRowModel().rows.map((row) => (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={columns.length}
                        className="h-24 text-center"
                      >
                        No forecast trends found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between px-4">
              <div className="flex-1 text-sm text-muted-foreground">
                Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
                {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredData.length)} of {filteredData.length} forecast trends
              </div>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <Label htmlFor="rows-per-page-forecast" className="text-sm font-medium">
                    Rows per page
                  </Label>
                  <Select
                    value={`${table.getState().pagination.pageSize}`}
                    onValueChange={(value) => {
                      table.setPageSize(Number(value))
                    }}
                  >
                    <SelectTrigger className="w-20" id="rows-per-page-forecast">
                      <SelectValue placeholder={table.getState().pagination.pageSize} />
                    </SelectTrigger>
                    <SelectContent side="top">
                      {[10, 20, 30, 40, 50].map((pageSize) => (
                        <SelectItem key={pageSize} value={`${pageSize}`}>
                          {pageSize}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex w-fit items-center justify-center text-sm font-medium">
                  Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronsLeftIcon className="h-4 w-4" />
                    <span className="sr-only">Go to first page</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    <span className="sr-only">Go to previous page</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                    <span className="sr-only">Go to next page</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                  >
                    <ChevronsRightIcon className="h-4 w-4" />
                    <span className="sr-only">Go to last page</span>
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
      
      <TrendDetailSheet 
        trend={selectedTrend} 
        open={sheetOpen} 
        onOpenChange={setSheetOpen}
        onUpdateTrend={handleUpdateTrend}
        />
      </div>
    </>
  )
}

function CatalogTable({ products, searchQuery, sorting, onSortingChange }: { 
  products: any[]; 
  searchQuery: string;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
}) {
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = React.useState({})
  const [selectedProduct, setSelectedProduct] = React.useState<any>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 20,
  })

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "product_code",
      header: "SKU",
      cell: ({ row }) => (
        <div className="font-mono text-sm">{row.getValue("product_code")}</div>
      ),
    },
    {
      accessorKey: "product_name",
      header: "Product",
      cell: ({ row, table }) => {
        const product = row.original
        
        return (
          <div 
            className="flex items-center gap-3 cursor-pointer hover:text-primary"
            onClick={() => (table.options.meta as any)?.onRowClick?.(row.original)}
          >
            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="max-w-[300px]">
              <div className="font-medium truncate">{product.product_name}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {product.color && product.color !== 'N/A' && (
                  <span>Color: {product.color}</span>
                )}
                {product.gender && product.gender !== 'Unisex' && (
                  <>
                    {product.color && product.color !== 'N/A' && <span>•</span>}
                    <span>{product.gender}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => {
        const category = row.getValue("category") as string
        return (
          <Badge variant="secondary">
            {category}
          </Badge>
        )
      },
    },
    {
      accessorKey: "current_price",
      header: "Price",
      cell: ({ row }) => {
        const price = parseFloat(row.getValue("current_price"))
        const originalPrice = row.original.original_price
        const discount = row.original.discount_percentage
        const currency = row.original.currency
        
        return (
          <div className="space-y-1">
            <div className="font-medium">
              {currency === 'USD' ? '$' : currency} {price.toFixed(2)}
            </div>
            {discount > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="line-through text-muted-foreground">
                  ${originalPrice.toFixed(2)}
                </span>
                <Badge variant="outline" className="text-xs">
                  -{discount}%
                </Badge>
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "average_rating",
      header: "Rating",
      cell: ({ row }) => {
        const rating = row.original.average_rating
        const reviewCount = row.original.reviews_count
        
        if (!rating) {
          return <span className="text-muted-foreground text-sm">No ratings</span>
        }
        
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <StarIcon 
                  key={i} 
                  className={`h-3 w-3 ${
                    i < Math.floor(rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              ))}
              <span className="text-sm font-medium ml-1">{rating.toFixed(1)}</span>
            </div>
            {reviewCount && (
              <div className="text-xs text-muted-foreground">
                {reviewCount} reviews
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "stock_status",
      header: "Stock",
      cell: ({ row }) => {
        const status = row.getValue("stock_status") as string
        const inventory = row.original.current_inventory_level
        
        return (
          <div className="space-y-1">
            <Badge 
              variant={status === "InStock" ? "default" : "secondary"}
              className={status === "InStock" ? "bg-green-500 text-white hover:bg-green-600" : ""}
            >
              {status}
            </Badge>
            {inventory > 0 && (
              <div className="text-xs text-muted-foreground">
                {inventory} units
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "trend_match_score",
      header: "Trend Match",
      cell: ({ row }) => {
        // Generate a stable trend match score based on product ID
        // In production, this would come from actual trend matching algorithm
        const productId = row.original.product_id || 0
        const score = 70 + (productId % 31) // Generates 70-100 based on product ID
        const color = score > 90 ? 'text-green-600' : score > 80 ? 'text-yellow-600' : 'text-orange-600'
        return (
          <div className="flex items-center gap-2">
            <TrendingUpIcon className={`h-4 w-4 ${color}`} />
            <span className={`font-medium ${color}`}>{score}%</span>
          </div>
        )
      },
    },
    {
      accessorKey: "created_at",
      header: "Added",
      cell: ({ row }) => {
        const date = new Date(row.original.created_at)
        const daysAgo = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24))
        return (
          <div className="text-sm text-muted-foreground">
            {daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`}
          </div>
        )
      },
    },
  ]

  const table = useReactTable({
    data: products,
    columns,
    onSortingChange: (updaterOrValue) => {
      const newSorting = typeof updaterOrValue === 'function' 
        ? updaterOrValue(sorting) 
        : updaterOrValue
      onSortingChange(newSorting)
    },
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      pagination,
    },
    meta: {
      onRowClick: (product: any) => {
        setSelectedProduct(product)
        setSheetOpen(true)
      }
    }
  })

  // Apply search filter
  React.useEffect(() => {
    if (searchQuery) {
      table.getColumn("product_name")?.setFilterValue(searchQuery)
    } else {
      table.getColumn("product_name")?.setFilterValue("")
    }
  }, [searchQuery, table])

  return (
    <>
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted font-sans">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="font-sans">
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No products found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between px-4">
        <div className="flex-1 text-sm text-muted-foreground">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
          {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, products.length)} of {products.length} products
        </div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <Label htmlFor="rows-per-page-catalog" className="text-sm font-medium">
              Rows per page
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value))
              }}
            >
              <SelectTrigger className="w-20" id="rows-per-page-catalog">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeftIcon className="h-4 w-4" />
              <span className="sr-only">Go to first page</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span className="sr-only">Go to previous page</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRightIcon className="h-4 w-4" />
              <span className="sr-only">Go to next page</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRightIcon className="h-4 w-4" />
              <span className="sr-only">Go to last page</span>
            </Button>
          </div>
        </div>
      </div>
      
      {/* Product Details Sheet - Using same pattern as TrendDetailSheet */}
      <ProductDetailSheet
        product={selectedProduct}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  )
} 