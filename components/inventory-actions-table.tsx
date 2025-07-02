"use client"

import * as React from "react"
import { createClient } from "@supabase/supabase-js"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ArrowUpIcon,
  ArrowDownIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  AlertCircleIcon,
  PackageIcon,
  TagIcon,
  PauseIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  SearchIcon,
  RefreshCwIcon,
  Loader2Icon,
  InfoIcon,
  ExternalLinkIcon,
  ImageIcon,
  FileDownIcon,
  MessageSquare,
  CheckCircle2Icon,
  RocketIcon,
  LinkIcon,
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { toast } from "sonner"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { CalculationTooltip } from "@/components/ui/calculation-tooltip"
import { getTrendDisplayName } from "@/lib/format-utils"

interface InventoryAction {
  recommendation_id: number
  product_id: number
  trend_id: number | null
  matched_trend_id?: number | null
  recommendation_action: 'promote' | 'strong_promote' | 'markdown' | 'restock_urgent' | 'phase_out' | 'hold' | 'discount' | 'restock' | 'discontinue' | 'bundle'
  confidence_score: number
  alignment_score: number | null
  alignment_factors: {
    category_match: number
    demographic_alignment: number
    seasonality_match: number
    price_alignment: number
    lifecycle_compatibility: number
    style_match: number
    trend_momentum: number
  } | null
  reasons: Array<{
    reason_type: string
    reason_code: string
    reason_description: string
    impact_score: number
    supporting_data?: any
  }> | null
  recommendation_reasons?: string | null
  created_at: string
  applied_at: string | null
  status: string | null
  is_applied?: boolean
  product: {
    product_id: number
    product_name: string
    product_code: string
    current_price: number
    current_inventory_level: number
    stock_status: string
    images?: string[]
  }
  trend: {
    trend_id: number
    trend_identifier: string
    trend_category: string
    lifecycle_stage: string
    trend_description?: string
  } | null
}

const actionIcons: Record<string, React.ReactNode> = {
  promote: <TrendingUpIcon className="h-4 w-4 text-blue-600" />,
  strong_promote: <RocketIcon className="h-4 w-4 text-purple-600" />,
  markdown: <TagIcon className="h-4 w-4 text-green-600" />,
  restock_urgent: <PackageIcon className="h-4 w-4 text-orange-600" />,
  phase_out: <XCircleIcon className="h-4 w-4 text-red-600" />,
  hold: <PauseIcon className="h-4 w-4 text-gray-600" />,
  // Legacy mappings
  discount: <TagIcon className="h-4 w-4 text-green-600" />,
  restock: <PackageIcon className="h-4 w-4 text-orange-600" />,
  discontinue: <XCircleIcon className="h-4 w-4 text-red-600" />,
  bundle: <LinkIcon className="h-4 w-4 text-purple-600" />
}

const actionLabels: Record<string, string> = {
  promote: "Promote",
  strong_promote: "Strong Promote",
  markdown: "Markdown",
  restock_urgent: "Urgent Restock",
  phase_out: "Phase Out",
  hold: "Hold",
  // Legacy mappings
  discount: "Discount",
  restock: "Restock",
  discontinue: "Discontinue",
  bundle: "Bundle"
}

const actionColors: Record<string, string> = {
  strong_promote: "bg-green-50 text-green-700 border-green-200",
  promote: "bg-green-50 text-green-700 border-green-200",
  hold: "bg-yellow-50 text-yellow-700 border-yellow-200",
  hold_back: "bg-orange-50 text-orange-700 border-orange-200",
  markdown: "bg-orange-50 text-orange-700 border-orange-200",
  phase_out: "bg-red-50 text-red-700 border-red-200",
  restock_urgent: "bg-blue-50 text-blue-700 border-blue-200",
  no_action: "bg-gray-50 text-gray-600 border-gray-200"
}

function ActionDetailSheet({ action, open, onOpenChange }: { 
  action: InventoryAction | null, 
  open: boolean, 
  onOpenChange: (open: boolean) => void
}) {
  const [applied, setApplied] = React.useState(false)
  const [generatingImage, setGeneratingImage] = React.useState(false)
  const [generatedImage, setGeneratedImage] = React.useState<string | null>(null)
  
  const supabase = React.useMemo(
    () => createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  // Reset state when action changes
  React.useEffect(() => {
    if (action) {
      setApplied(action.applied_at || action.is_applied ? true : false)
      setGeneratedImage(null)
      setGeneratingImage(false)
    }
  }, [action])
  
  if (!action) return null

  const handleApplyRecommendation = async () => {
    try {
      const { data, error } = await supabase
        .from('recommendations')
        .update({ 
          applied_at: new Date().toISOString(),
          status: 'applied',
          is_applied: true
        })
        .eq('recommendation_id', action.recommendation_id)
        .select()
      
      if (error) {
        console.error('Supabase error:', error)
        throw error
      }
      
      setApplied(true)
      
      // Update the action object to reflect the change
      if (action) {
        action.applied_at = new Date().toISOString()
        action.status = 'applied'
        action.is_applied = true
      }
      
      toast.success('Recommendation applied successfully')
    } catch (error) {
      console.error('Error applying recommendation:', error)
      toast.error('Failed to apply recommendation')
    }
  }

  const handleGenerateImage = async () => {
    setGeneratingImage(true)
    try {
      const prompt = `Hyperrealistic professional B2B fashion photography of ${action.product.product_name}. Luxury commercial product photography, pristine white background, ultra high-end quality, professional studio lighting, fashion magazine quality, premium brand aesthetic, photorealistic detail, 8K resolution, award-winning commercial photography.`
      
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt.slice(0, 1000),
          n: 1,
          size: '1024x1024',
          quality: 'standard',
          style: 'natural'
        })
      })
      
      const data = await response.json()
      if (data.data?.[0]?.url) {
        setGeneratedImage(data.data[0].url)
        toast.success('Image generated successfully')
      }
    } catch (error) {
      console.error('Error generating image:', error)
      toast.error('Failed to generate image')
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleExport = () => {
    const exportData = {
      product: action.product,
      trend: action.trend,
      recommendation: {
        action: action.recommendation_action,
        confidence: action.confidence_score,
        alignment_score: action.alignment_score,
        factors: action.alignment_factors,
        reasons: action.reasons
      }
    }
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `recommendation-${action.product.product_code}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Data exported')
  }

  const handleAddToChat = () => {
    const contextData = `Recommendation for ${action.product.product_name}\n` +
      `Action: ${actionLabels[action.recommendation_action]}\n` +
      `Matched Trend: ${action.trend?.trend_identifier.replace(/-/g, ' ')}\n` +
      `Match Score: ${action.alignment_score}%\n` +
      `Confidence: ${(action.confidence_score * 100).toFixed(0)}%\n` +
      `Reasons: ${action.reasons?.map(r => r.reason_description).join(', ')}`;
    
    window.dispatchEvent(new CustomEvent('addChatContext', { 
      detail: { context: contextData } 
    }));
    
    onOpenChange(false);
    
    window.dispatchEvent(new CustomEvent('openChat', { 
      detail: { view: 'sidebar' } 
    }));
    
    toast.success('Context added to chat');
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[540px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {actionIcons[action.recommendation_action]}
            {actionLabels[action.recommendation_action]}
          </SheetTitle>
          <SheetDescription>
            Recommendation details for {action.product.product_name}
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* Action Icons */}
          <div className="flex gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant={applied ? "default" : "outline"} 
                    size="sm" 
                    onClick={handleApplyRecommendation}
                    disabled={applied}
                  >
                    <CheckCircle2Icon className={`h-4 w-4 ${applied ? 'fill-current' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {applied ? 'Recommendation Applied' : 'Apply Recommendation'}
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
                    onClick={handleAddToChat}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add to Chat</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Product Info */}
          <div>
            <h3 className="text-sm font-medium mb-3">Product Information</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{action.product.product_name}</p>
                  <p className="text-sm text-muted-foreground">SKU: {action.product.product_code}</p>
                  <p className="text-sm">${action.product.current_price}</p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Trend Alignment Details */}
          {action.trend && action.alignment_score && (
            <>
              <div>
                <h3 className="text-sm font-medium mb-3">Trend Alignment Analysis</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium capitalize">
                        {action.trend.trend_identifier.replace(/-/g, ' ')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {action.trend.trend_category} • {action.trend.lifecycle_stage}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-semibold text-primary">{action.alignment_score}%</p>
                      <p className="text-xs text-muted-foreground">Overall Match</p>
                    </div>
                  </div>
                  
                  {/* Alignment Factors - Grid Layout */}
                  {action.alignment_factors && (
                    <div className="mt-4">
                      <Label className="text-sm font-medium mb-3">Alignment Breakdown</Label>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Category Match</span>
                              <span className="text-sm font-medium">
                                {Math.round(action.alignment_factors.category_match || 0)}%
                              </span>
                            </div>
                            <Progress value={action.alignment_factors.category_match || 0} className="h-2" />
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Style Match</span>
                              <span className="text-sm font-medium">
                                {Math.round(action.alignment_factors.style_match || 0)}%
                              </span>
                            </div>
                            <Progress value={action.alignment_factors.style_match || 0} className="h-2" />
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Demographics</span>
                              <span className="text-sm font-medium">
                                {Math.round(action.alignment_factors.demographic_alignment || 0)}%
                              </span>
                            </div>
                            <Progress value={action.alignment_factors.demographic_alignment || 0} className="h-2" />
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Price Alignment</span>
                              <span className="text-sm font-medium">
                                {Math.round(action.alignment_factors.price_alignment || 0)}%
                              </span>
                            </div>
                            <Progress value={action.alignment_factors.price_alignment || 0} className="h-2" />
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm">Seasonality</span>
                              <span className="text-sm font-medium">
                                {Math.round(action.alignment_factors.seasonality_match || 0)}%
                              </span>
                            </div>
                            <Progress value={action.alignment_factors.seasonality_match || 0} className="h-2" />
                          </div>
                        </div>
                      </div>
                      
                      {/* Trend Momentum and Lifecycle */}
                      <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Trend Momentum</span>
                            <span className="text-sm font-medium">
                              {Math.round(action.alignment_factors.trend_momentum || 0)}%
                            </span>
                          </div>
                          <Progress value={action.alignment_factors.trend_momentum || 0} className="h-2" />
                        </div>
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Lifecycle Stage</span>
                            <span className="text-sm font-medium">
                              {Math.round(action.alignment_factors.lifecycle_compatibility || 0)}%
                            </span>
                          </div>
                          <Progress value={action.alignment_factors.lifecycle_compatibility || 0} className="h-2" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Inventory Status */}
          <div>
            <h3 className="text-sm font-medium mb-3">Inventory Status</h3>
            <Badge variant={action.product.stock_status === "InStock" ? "default" : "secondary"}>
              {action.product.stock_status}
            </Badge>
            <div className="mt-3">
              <Label className="text-xs text-muted-foreground">Current Stock</Label>
              <p className="font-medium">{action.product.current_inventory_level} units</p>
            </div>
          </div>

          <Separator />

          {/* Recommendation Details */}
          <div>
            <h3 className="text-sm font-medium mb-3">Recommendation Details</h3>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Confidence Score</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={action.confidence_score * 100} className="flex-1" />
                  <span className="text-sm font-medium">{(action.confidence_score * 100).toFixed(0)}%</span>
                </div>
              </div>
              
              {/* Recommendation Reasons */}
              {(action.recommendation_reasons || (action.reasons && action.reasons.length > 0)) && (
                <div>
                  <Label className="text-xs text-muted-foreground">Recommendation Reasons</Label>
                  <div className="mt-2 space-y-1">
                    {action.recommendation_reasons ? (
                      // Display text-based reasons
                      action.recommendation_reasons.split('\n').map((reason, index) => (
                        <p key={index} className="text-sm text-muted-foreground">
                          {reason}
                        </p>
                      ))
                    ) : (
                      // Fallback to structured reasons
                      action.reasons?.map((reason, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-xs text-muted-foreground mt-0.5">•</span>
                          <p className="text-sm text-muted-foreground">
                            {reason.reason_description}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export const InventoryActionsTable = React.forwardRef<
  { 
    fetchRecommendations: () => void;
    setSearchFilter: (value: string) => void;
    setSorting: (sorting: SortingState) => void;
  },
  { 
    brandId: number; 
    session?: any;
    onRecommendationsGenerated?: () => void;
  }
>(({ brandId, session, onRecommendationsGenerated }, ref) => {
  const [data, setData] = React.useState<InventoryAction[]>([])
  const [loading, setLoading] = React.useState(true)
  const [generating, setGenerating] = React.useState(false)
  const [generationProgress, setGenerationProgress] = React.useState<string>("")
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'confidence_score', desc: true }
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [selectedAction, setSelectedAction] = React.useState<InventoryAction | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 20,
  })

  const supabase = React.useMemo(
    () => createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  // Fetch recommendations
  const fetchRecommendations = React.useCallback(async () => {
    try {
      setLoading(true)
      
      const { data: recommendations, error } = await supabase
        .from('recommendations')
        .select('*')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .order('confidence_score', { ascending: false })

      if (error) {
        console.error('Error fetching recommendations:', error)
        throw error
      }

      // Fetch related products and trends separately
      const productIds = recommendations?.map(r => r.product_id).filter(Boolean) || []
      const trendIds = recommendations?.map(r => r.matched_trend_id).filter(Boolean) || []

      // Fetch products
      const { data: products } = await supabase
        .from('products')
        .select('product_id, variant_sku, product_name, current_price, current_inventory_level, stock_status')
        .in('product_id', productIds)

      // Fetch trends
      const { data: trends } = await supabase
        .from('trends')
        .select('trend_id, trend_identifier, trend_category, lifecycle_stage, trend_description')
        .in('trend_id', trendIds)

      // Create lookup maps
      const productMap = new Map(products?.map(p => [p.product_id, p]) || [])
      const trendMap = new Map(trends?.map(t => [t.trend_id, t]) || [])

      // Fetch product images separately (skip if no products)
      const imageMap = new Map()
      if (productIds.length > 0) {
        const { data: images } = await supabase
          .from('product_images')
          .select('product_id, image_url')
          .in('product_id', productIds)
          .eq('is_primary', true)

        // Group images by product
        images?.forEach((img: any) => {
          if (!imageMap.has(img.product_id)) {
            imageMap.set(img.product_id, [])
          }
          imageMap.get(img.product_id).push(img.image_url)
        })
      }

      // Transform data - map products and trends back to recommendations
      const transformedData = recommendations?.map(rec => {
        const product = productMap.get(rec.product_id)
        const trend = trendMap.get(rec.matched_trend_id)
        
        return {
          ...rec,
          product: product ? {
            product_id: product.product_id,
            product_name: product.product_name,
            product_code: product.variant_sku || '',
            current_price: product.current_price,
            current_inventory_level: product.current_inventory_level,
            stock_status: product.stock_status,
            images: imageMap.get(product.product_id) || []
          } : {
            product_id: rec.product_id,
            product_name: 'Unknown Product',
            product_code: 'N/A',
            current_price: 0,
            current_inventory_level: 0,
            stock_status: 'Unknown',
            images: []
          },
          trend: trend || null
        }
      }) || []

      console.log(`Loaded ${transformedData.length} recommendations`)
      setData(transformedData)
    } catch (error: any) {
      console.error('Error fetching recommendations:', error)
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      toast.error('Failed to load inventory actions')
    } finally {
      setLoading(false)
    }
  }, [brandId, supabase])

  React.useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  const columns: ColumnDef<InventoryAction>[] = [
    {
      accessorKey: "product",
      header: "Product",
      cell: ({ row }) => {
        const product = row.original.product
        
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0">
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">{product.product_name}</p>
              <p className="text-sm text-muted-foreground">SKU: {product.product_code}</p>
            </div>
          </div>
        )
      },
    },
    {
      id: "product_name",
      accessorFn: (row) => row.product.product_name,
      header: () => null,
      cell: () => null,
      enableHiding: true,
      enableColumnFilter: false,
    },
    {
      accessorKey: "matched_trend",
      header: "Matched Trend",
      cell: ({ row }) => {
        const trend = row.original.trend
        const stage = trend?.lifecycle_stage || 'unknown'
        const stageColors: Record<string, string> = {
          emerging: "text-green-700",
          growing: "text-blue-700",
          peak: "text-purple-700",
          declining: "text-orange-700",
          unknown: "text-gray-600"
        }
        
        if (!trend) {
          return <span className="text-muted-foreground">No trend match</span>
        }
        
        return (
          <div>
            <p className="font-medium">
              {getTrendDisplayName({ 
                trend_identifier: trend.trend_identifier, 
                trend_description: trend.trend_description 
              })}
            </p>
            <Badge 
              variant="secondary" 
              className={`text-xs mt-1 ${stageColors[stage]}`}
            >
              {stage}
            </Badge>
          </div>
        )
      },
    },
    {
      id: "trend_identifier",
      accessorFn: (row) => row.trend?.trend_identifier || '',
      header: () => null,
      cell: () => null,
      enableHiding: true,
      enableColumnFilter: false,
    },
    {
      accessorKey: "alignment_score",
      header: ({ column }) => (
        <div className="flex items-center gap-1">
          <span>Match Score</span>
          <CalculationTooltip
            title="Alignment Score Calculation"
            value="0-100%"
            steps={[
              { label: "Category Match", value: "25%", formula: "product vs trend category" },
              { label: "Style Match", value: "25%", formula: "style attributes alignment" },
              { label: "Price Alignment", value: "12%", formula: "price point compatibility" },
              { label: "Seasonality Match", value: "12%", formula: "seasonal relevance" },
              { label: "Demographic Alignment", value: "12%", formula: "target audience overlap" },
              { label: "Lifecycle Compatibility", value: "10%", formula: "trend stage vs product stage" },
              { label: "Trend Momentum", value: "4%", formula: "trend velocity score" }
            ]}
            description="Weighted average with curve grading to ensure proper distribution of actions"
            size="sm"
          />
        </div>
      ),
      size: 200,
      cell: ({ row }) => {
        const score = row.original.alignment_score
        const factors = row.original.alignment_factors
        
        if (!score) return <span className="text-muted-foreground">-</span>
        
        return (
          <div className="space-y-2">
            <div className="text-2xl font-medium text-primary">{score}%</div>
            {factors && (
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-muted-foreground">Category:</span>
                  <span className="font-medium">{Math.round(factors.category_match || 0)}%</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-muted-foreground">Style:</span>
                  <span className="font-medium">{Math.round(factors.style_match || 0)}%</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-muted-foreground">Price:</span>
                  <span className="font-medium">{Math.round(factors.price_alignment || 0)}%</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-muted-foreground">Seasonal:</span>
                  <span className="font-medium">{Math.round(factors.seasonality_match || 0)}%</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-muted-foreground">Demographics:</span>
                  <span className="font-medium">{Math.round(factors.demographic_alignment || 0)}%</span>
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-muted-foreground">Lifecycle:</span>
                  <span className="font-medium">{Math.round(factors.lifecycle_compatibility || 0)}%</span>
                </div>
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "recommendation_action",
      header: "Action",
      cell: ({ row }) => {
        const action = row.original.recommendation_action as keyof typeof actionLabels
        return (
          <div className="flex items-center gap-2">
            {actionIcons[action]}
            <span>{actionLabels[action]}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "confidence_score",
      header: ({ column }) => {
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              className="h-8 px-2"
            >
              Confidence
              <ArrowUpIcon className="ml-2 h-4 w-4" />
            </Button>
            <CalculationTooltip
              title="Confidence Score"
              value="0-100%"
              steps={[
                { label: "Trend Momentum", value: "40%", formula: "trend velocity × lifecycle stage" },
                { label: "Product Performance", value: "30%", formula: "sales history × inventory turnover" },
                { label: "Market Signals", value: "20%", formula: "competitor actions × market demand" },
                { label: "Historical Accuracy", value: "10%", formula: "past recommendation success rate" }
              ]}
              description="AI confidence in the recommended action based on multiple data points"
              size="sm"
            />
          </div>
        )
      },
      cell: ({ row }) => {
        const confidence = row.original.confidence_score
        return (
          <div className="flex items-center gap-2">
            <Progress value={confidence * 100} className="w-16" />
            <span className="text-sm font-medium">{(confidence * 100).toFixed(0)}%</span>
          </div>
        )
      },
    },
    {
      accessorKey: "reasons",
      header: "Primary Reason",
      cell: ({ row }) => {
        const recommendation_reasons = row.original.recommendation_reasons
        const reasons = row.original.reasons
        
        if (recommendation_reasons) {
          // Get first line of text-based reasons
          const firstReason = recommendation_reasons.split('\n')[0]?.replace('• ', '')
          return (
            <p className="text-sm text-muted-foreground line-clamp-2 max-w-xs">
              {firstReason || '-'}
            </p>
          )
        } else if (reasons && reasons.length > 0) {
          const primaryReason = reasons[0]
          return (
            <p className="text-sm text-muted-foreground line-clamp-2 max-w-xs">
              {primaryReason.reason_description}
            </p>
          )
        }
        
        return <span className="text-muted-foreground">-</span>
      },
    },
  ]

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    globalFilterFn: (row, columnId, filterValue) => {
      const searchValue = filterValue.toLowerCase()
      const product = row.original.product
      const trend = row.original.trend
      
      // Search in product name
      if (product?.product_name?.toLowerCase().includes(searchValue)) {
        return true
      }
      
      // Search in product SKU
      if (product?.product_code?.toLowerCase().includes(searchValue)) {
        return true
      }
      
      // Search in trend name
      if (trend?.trend_identifier?.toLowerCase().includes(searchValue)) {
        return true
      }
      
      return false
    },
    state: {
      sorting,
      columnFilters,
      pagination,
      globalFilter: '',
    },
  })

  // Expose methods to parent
  React.useImperativeHandle(ref, () => ({
    fetchRecommendations,
    setSearchFilter: (value: string) => {
      table.setGlobalFilter(value)
    },
    setSorting: (sorting: SortingState) => {
      setSorting(sorting)
    }
  }), [fetchRecommendations, table])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead 
                    key={header.id}
                    style={{ width: header.column.columnDef.size }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelectedAction(row.original)
                    setSheetOpen(true)
                  }}
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
                  {data.length === 0 
                    ? "No recommendations generated yet. Click 'Generate Recommendations' to start."
                    : "No recommendations found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-4">
        <div className="flex-1 text-sm text-muted-foreground">
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}-
          {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, data.length)} of {data.length} recommendations
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ActionDetailSheet
        action={selectedAction}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
})

InventoryActionsTable.displayName = 'InventoryActionsTable' 