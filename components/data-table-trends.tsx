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
  Building2,
  ArrowUpDown,
  RocketIcon,
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
import { CalculationTooltip, CALCULATION_FORMULAS } from "@/components/ui/calculation-tooltip"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import { InventoryActionsTable } from "@/components/inventory-actions-table"
import { CampaignTable } from "@/components/campaign-table"
import { getTrendDisplayName } from "@/lib/format-utils"
import { useCredits, CREDIT_COSTS } from "@/components/credits-widget"
import { HydrationWrapper } from "@/components/hydration-wrapper"
import { formatDate, formatRelativeDate } from "@/lib/date-utils"
import { supabase } from "@/lib/supabase"
import { useTranslation } from 'react-i18next'
import { ExportDropdown } from "@/components/ui/export-dropdown"
import { exportTrends, exportProducts, exportRecommendations, exportCampaigns, type ExportFormat } from "@/lib/export-utils"

// Add type definitions
type InventoryActionsTableRef = any
type CampaignTableRef = any

interface Trend {
  trend_id: number
  trend_identifier: string
  trend_category: string
  trend_description?: string
  trend_region?: string
  momentum_score: number
  velocity: number
  lifecycle_stage: string
  adoption_rate: number
  social_reach: number
  conversion_impact: number
  risk_score: number
  predicted_peak_date: string
  predicted_decline_date: string
  competitor_adoption?: {
    brands: string[]
    percentage: number
  }
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
  // Source information
  source_urls?: string[]
  sources?: Array<{
    id: number
    trend_id: number
    source_url: string
    source_type?: string
    source_title?: string
    extracted_at: string
    relevance_score?: number
  }>
}

const columns: ColumnDef<Trend>[] = [
  {
    accessorKey: "trend_identifier",
    header: "Trend Name",
    cell: ({ row, table }) => {
      const displayName = getTrendDisplayName(row.original)
      const description = row.original.trend_description
      const isWatchlisted = row.original.watchlist
      
      // Extract the actual description part (after the name prefix if present)
      let cleanDescription = description
      if (description && description.includes(':')) {
        const parts = description.split(':')
        if (parts.length > 1) {
          cleanDescription = parts.slice(1).join(':').trim()
        }
      }
      
      return (
        <div 
          className="flex flex-col cursor-pointer hover:text-primary"
          onClick={() => (table.options.meta as any)?.onRowClick?.(row.original)}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{displayName}</span>
            {row.original.trend_region && (
              <Badge variant="secondary" className="text-xs uppercase">
                {row.original.trend_region === 'brazil' ? 'BR' :
                 row.original.trend_region === 'india' ? 'IN' :
                 row.original.trend_region === 'usa' ? 'US' :
                 row.original.trend_region === 'europe' ? 'EU' :
                 row.original.trend_region === 'asia' ? 'AS' :
                 row.original.trend_region === 'global' ? 'GL' :
                 row.original.trend_region}
              </Badge>
            )}
            {isWatchlisted && (
              <BookmarkIcon className="h-3 w-3 text-primary fill-primary" />
            )}
          </div>
          {cleanDescription && (
            <span className="text-xs text-muted-foreground line-clamp-2 max-w-md">
              {cleanDescription}
            </span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "trend_category",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Category
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      )
    },
    cell: ({ row }) => <span className="capitalize">{row.original.trend_category}</span>,
  },
  {
    accessorKey: "sources",
    header: "Source",
    cell: ({ row }) => {
      const sources = row.original.sources || []
      const sourceUrls = row.original.source_urls || []
      
      if (sources.length === 0 && sourceUrls.length === 0) {
        return <span className="text-sm text-muted-foreground">No source</span>
      }
      
      // Get the first source or use source_urls
      const primarySource = sources[0] || { source_url: sourceUrls[0] }
      const domain = primarySource.source_url ? new URL(primarySource.source_url).hostname.replace('www.', '') : 'Unknown'
      const sourceCount = sources.length || sourceUrls.length
      
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 cursor-pointer">
                <span className="text-sm truncate max-w-[150px]">{domain}</span>
                {sourceCount > 1 && (
                  <span className="text-xs text-muted-foreground">(+{sourceCount - 1})</span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <div className="space-y-2">
                <p className="font-semibold">Sources ({sourceCount}):</p>
                {sources.length > 0 ? (
                  sources.slice(0, 5).map((source, idx) => (
                    <div key={idx} className="text-xs">
                      <a 
                        href={source.source_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {new URL(source.source_url).hostname.replace('www.', '')}
                      </a>
                      {source.source_title && (
                        <p className="text-muted-foreground truncate">{source.source_title}</p>
                      )}
                    </div>
                  ))
                ) : (
                  sourceUrls.slice(0, 5).map((url, idx) => (
                    <div key={idx} className="text-xs">
                      <a 
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        {new URL(url).hostname.replace('www.', '')}
                      </a>
                    </div>
                  ))
                )}
                {sourceCount > 5 && (
                  <p className="text-xs text-muted-foreground">...and {sourceCount - 5} more</p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
  },
  {
    accessorKey: "lifecycle_stage",
    header: "Status",
    cell: ({ row }) => {
      const stage = row.original.lifecycle_stage
      const trendType = row.original.trend_type
      const isEmerging = trendType === 'forecast'
      
      const getIcon = () => {
        if (isEmerging) {
          return <Clock className="h-3 w-3" />
        }
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
        if (isEmerging) {
          return 'outline'
        }
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
        <div className="flex flex-col gap-1">
          <Badge variant={getVariant()} className="capitalize gap-1 w-fit">
            {getIcon()}
            {stage}
          </Badge>
          {isEmerging && (
            <span className="text-xs text-muted-foreground">Emerging Trend</span>
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "momentum_score",
    header: ({ column }) => (
      <div className="flex items-center gap-1">
        <span>Momentum</span>
        <CalculationTooltip
          title="Momentum Score"
          value="0-100"
          steps={CALCULATION_FORMULAS.momentum.getSteps({
            baseMomentum: 50,
            todayBonus: 15,
            sourceCount: 3,
            variance: 5
          })}
          description={CALCULATION_FORMULAS.momentum.description}
          size="sm"
        />
      </div>
    ),
    cell: ({ row }) => {
      const score = row.original.momentum_score
      const color = score > 70 ? 'text-green-600' : score > 40 ? 'text-yellow-600' : 'text-red-600'
      return <span className={`font-medium ${color}`}>{score.toFixed(0)}</span>
    },
  },
  {
    accessorKey: "velocity",
    header: ({ column }) => (
      <div className="flex items-center gap-1">
        <span>Velocity</span>
        <CalculationTooltip
          title="Velocity Score"
          value="0-30"
          steps={CALCULATION_FORMULAS.velocity.getSteps({
            baseVelocity: 8,
            sourceCount: 3,
            sourceBoost: 9,
            randomFactor: 2
          })}
          description={CALCULATION_FORMULAS.velocity.description}
          size="sm"
        />
      </div>
    ),
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
    header: ({ column }) => (
      <div className="flex items-center gap-1">
        <span>Adoption</span>
        <CalculationTooltip
          title="Adoption Rate"
          value="0-100%"
          steps={CALCULATION_FORMULAS.adoption.getSteps({
            baseAdoption: "20%",
            momentumFactor: "20%",
            momentum: 50
          })}
          description={CALCULATION_FORMULAS.adoption.description}
          size="sm"
        />
      </div>
    ),
    cell: ({ row }) => {
      const rate = row.original.adoption_rate
      return <span>{(rate * 100).toFixed(0)}%</span>
    },
  },
  {
    accessorKey: "social_reach",
    header: ({ column }) => (
      <div className="flex items-center gap-1">
        <span>Social Reach</span>
        <CalculationTooltip
          title="Social Reach"
          value="50K-1M+"
          steps={CALCULATION_FORMULAS.socialReach.getSteps({
            baseReach: 50000,
            platform: "varies",
            momentumBoost: 500000,
            variance: 50000
          })}
          description={CALCULATION_FORMULAS.socialReach.description}
          size="sm"
        />
      </div>
    ),
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
    header: ({ column }) => (
      <div className="flex items-center gap-1">
        <span>Risk</span>
        <CalculationTooltip
          title="Risk Score"
          value="0-30%"
          steps={CALCULATION_FORMULAS.risk.getSteps({
            baseRisk: "20%",
            randomFactor: "10%",
            total: "30%"
          })}
          description={CALCULATION_FORMULAS.risk.description}
          size="sm"
        />
      </div>
    ),
    cell: ({ row }) => {
      const risk = row.original.risk_score
      const percentage = (risk * 100).toFixed(0)
      return (
        <span className={risk > 0.3 ? 'text-red-600' : risk > 0.15 ? 'text-yellow-600' : 'text-green-600'}>
          {percentage}%
        </span>
      )
    },
  },
  {
    accessorKey: "conversion_impact",
    header: ({ column }) => (
      <div className="flex items-center gap-1">
        <span>Impact</span>
        <CalculationTooltip
          title="Conversion Impact"
          value="0-50%"
          steps={CALCULATION_FORMULAS.conversion.getSteps({
            baseConversion: "8%",
            momentumImpact: "10%",
            adoptionImpact: "5%"
          })}
          description={CALCULATION_FORMULAS.conversion.description}
          size="sm"
        />
      </div>
    ),
    cell: ({ row }) => {
      const impact = row.original.conversion_impact
      const percentage = (impact * 100).toFixed(0)
      return (
        <span className={impact > 0.3 ? 'text-green-600' : impact > 0.15 ? 'text-yellow-600' : 'text-gray-600'}>
          {percentage}%
        </span>
      )
    },
  },
  {
    accessorKey: "competitor_adoption",
    header: "Competitors",
    cell: ({ row }) => {
      const adoption = row.original.competitor_adoption
      if (!adoption || !adoption.brands || adoption.brands.length === 0) {
        return <span className="text-sm text-muted-foreground">—</span>
      }
      
      const displayBrands = adoption.brands.slice(0, 2).join(', ')
      const moreBrands = adoption.brands.length > 2 ? ` +${adoption.brands.length - 2}` : ''
      
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col gap-0.5 cursor-pointer">
                <span className="text-sm truncate max-w-[120px]">
                  {displayBrands}{moreBrands}
                </span>
                <span className="text-xs text-muted-foreground">
                  {adoption.percentage}% adoption
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-semibold">Competitor Adoption</p>
                <p className="text-sm">{adoption.brands.join(', ')}</p>
                <p className="text-sm text-muted-foreground">{adoption.percentage}% of competitors</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
  trend: any | null, 
  open: boolean, 
  onOpenChange: (open: boolean) => void,
  onUpdateTrend: (trend: any) => void
}) {
  const router = useRouter()
  const [generatedImage, setGeneratedImage] = React.useState<string | null>(null)
  const [generatingImage, setGeneratingImage] = React.useState(false)
  const [updating, setUpdating] = React.useState(false)
  const [generatingCampaign, setGeneratingCampaign] = React.useState(false)
  const { t } = useTranslation()
  
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
      const trendName = getTrendDisplayName(trend)
      const prompt = `Professional fashion photography showcasing ${trendName} trend. ${trend.trend_description || ''} Style: ${trend.trend_category}, ${trend.lifecycle_stage} trend. Clean commercial fashion photography, editorial quality, authentic styling, natural lighting.`
      
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          prompt,
          brandContext: {
            style: 'contemporary',
            price_point: 'premium'
          }
        })
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

  const handleAddToWatchlist = async () => {
    if (!trend) return
    
    setUpdating(true)
    try {
      const { error } = await supabase
        .from('trends')
        .update({ watchlist: !trend.watchlist })
        .eq('trend_id', trend.trend_id)
      
      if (error) throw error
      
      // Update local state
      const updatedTrend = { ...trend, watchlist: !trend.watchlist }
      onUpdateTrend(updatedTrend)
      
      toast.success(trend.watchlist ? 'Removed from watchlist' : 'Added to watchlist')
    } catch (error) {
      console.error('Error updating watchlist:', error)
      toast.error('Failed to update watchlist')
    } finally {
      setUpdating(false)
    }
  }

  const handleExport = (format: ExportFormat) => {
    exportTrends([trend], format)
    toast.success(`Trend exported as ${format.toUpperCase()}`)
  }

  const handleAddContext = () => {
    // Format trend data as context
    const contextData = `Context from Trend: ${getTrendDisplayName(trend)}\n` +
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

  const handleGenerateCampaign = async () => {
    setGeneratingCampaign(true)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user?.email) {
        toast.error('User not authenticated')
        setGeneratingCampaign(false)
        return
      }
      
      // Get user's brand ID using email
      const { data: userData } = await supabase
        .from('usr')
        .select('brand_id')
        .eq('email', user.email)
        .single()
      
      if (!userData?.brand_id) {
        toast.error('Brand not found')
        setGeneratingCampaign(false)
        return
      }
      
      console.log('Generating campaign for trend:', trend.trend_id, 'brand:', userData.brand_id)
      
      // Generate campaign from this specific trend
      const response = await fetch('/api/campaigns/generate-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          brand_id: userData.brand_id,
          trend_id: trend.trend_id
        })
      })
      
      console.log('Campaign generation response status:', response.status)
      
      const responseText = await response.text()
      console.log('Response text:', responseText)
      
      let result
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        console.error('Failed to parse response:', responseText)
        throw new Error('Invalid response from server')
      }
      
      if (!response.ok) {
        console.error('Campaign generation failed:', result)
        throw new Error(result.error || result.details || 'Failed to generate campaign')
      }
      
      console.log('Campaign generated successfully:', result)
      toast.success(`Campaign "${result.campaign_name}" created successfully!`)
      
      // Close the sheet
      onOpenChange(false)
      
      // Refresh campaigns if the tab is active
      window.dispatchEvent(new CustomEvent('refreshCampaigns'))
      
      // Also refresh campaign count
      window.dispatchEvent(new CustomEvent('campaignsUpdated'))
      
    } catch (error: any) {
      console.error('Error generating campaign:', error)
      toast.error(error.message || 'Failed to generate campaign')
    } finally {
      setGeneratingCampaign(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[540px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{getTrendDisplayName(trend)}</SheetTitle>
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
                    variant={trend.watchlist ? "secondary" : "outline"} 
                    size="sm" 
                    onClick={handleAddToWatchlist}
                    disabled={updating}
                  >
                    {updating ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    ) : (
                      <BookmarkIcon className={`h-4 w-4 ${trend.watchlist ? 'fill-current' : ''}`} />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {trend.watchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ExportDropdown onExport={handleExport} size="sm" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleGenerateCampaign}
                    disabled={generatingCampaign}
                  >
                    {generatingCampaign ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    ) : (
                      <RocketIcon className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Generate Campaign</TooltipContent>
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
              <div>
                {trend.competitor_adoption?.brands && trend.competitor_adoption.brands.length > 0 ? (
                  <div>
                    <p className="font-medium">{trend.competitor_adoption.brands.slice(0, 3).join(', ')}</p>
                    <p className="text-sm text-muted-foreground">{trend.competitor_adoption.percentage}% adoption</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not available</p>
                )}
              </div>
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
              <p className="text-sm">Peak Date: <span className="font-medium">{formatDate(trend.predicted_peak_date)}</span></p>
              <p className="text-sm">Decline Date: <span className="font-medium">{formatDate(trend.predicted_decline_date)}</span></p>
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
          
          <div>
            <Label className="text-sm text-muted-foreground mb-2">Sources</Label>
            <div className="space-y-2 mt-2">
              {(trend.sources && trend.sources.length > 0) || (trend.source_urls && trend.source_urls.length > 0) ? (
                <>
                  {trend.sources && trend.sources.length > 0 ? (
                    trend.sources.map((source: any, idx: number) => (
                      <div key={idx} className="p-2 border rounded-md">
                        <a 
                          href={source.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-500 hover:underline font-medium"
                        >
                          {new URL(source.source_url).hostname.replace('www.', '')}
                        </a>
                        {source.source_title && (
                          <p className="text-xs text-muted-foreground mt-1">{source.source_title}</p>
                        )}
                        {source.source_type && (
                          <Badge variant="outline" className="text-xs mt-1 capitalize">
                            {source.source_type}
                          </Badge>
                        )}
                        {source.extracted_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Extracted: {formatRelativeDate(new Date(source.extracted_at))}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    trend.source_urls?.map((url: string, idx: number) => (
                      <div key={idx} className="p-2 border rounded-md">
                        <a 
                          href={url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-500 hover:underline"
                        >
                          {url}
                        </a>
                      </div>
                    ))
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No source information available</p>
              )}
            </div>
          </div>
          
          <Separator />
          
          <div className="text-sm text-muted-foreground">
            <p>Created: {formatDate(trend.created_at)}</p>
            <p>Last Updated: {formatDate(trend.last_updated)}</p>
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
      const prompt = `Professional fashion product photography of ${product.product_name}. ${product.product_description || ''} Category: ${product.category}. Clean commercial product photography, pristine white background, studio lighting, editorial quality.`
      
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          prompt,
          brandContext: {
            style: 'contemporary',
            price_point: 'premium'
          }
        })
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

  const handleExport = (format: ExportFormat) => {
    exportProducts([product], format)
    toast.success(`Product exported as ${format.toUpperCase()}`)
  }

  const handleAddContext = () => {
    // Format product data as context
    const contextData = `Context from Product: ${product.product_name}\n` +
      `SKU: ${product.variant_sku}\n` +
      `Category: ${product.category_hierarchy}\n` +
      `Price: ${product.currency === 'BRL' ? 'R$' : product.currency === 'USD' ? '$' : product.currency} ${product.current_price}\n` +
      `Stock Status: ${product.stock_status}\n` +
      `Inventory: ${product.current_inventory_level || 0} units\n` +
      `Days of Supply: ${product.days_of_supply || 0} days\n` +
      `Color: ${product.color || 'N/A'}\n` +
      `Size: ${product.size || 'N/A'}\n` +
      `Revenue (30d): ${product.currency === 'BRL' ? 'R$' : product.currency === 'USD' ? '$' : product.currency} ${product.revenue_last_30d || 0}\n` +
      `Units Sold (30d): ${product.units_sold_last_30d || 0}\n` +
      `Description: ${product.description || 'N/A'}`;
    
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
            SKU: {product.variant_sku} • {product.color} • Size {product.size}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="flex gap-2">
            <ExportDropdown onExport={handleExport} size="sm" />
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
                    onClick={() => {
                      if (product.api_data?.url) {
                        window.open(product.api_data.url, '_blank')
                      } else {
                        window.open(`https://www.google.com/search?q=${encodeURIComponent(product.product_name)}`, '_blank')
                      }
                    }}
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
              <p className="font-medium">{product.category_hierarchy?.split('/').join(' > ') || 'Uncategorized'}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Product Code</Label>
              <p className="font-medium">{product.product_code}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Current Price</Label>
              <p className="font-medium">
                {product.currency === 'USD' ? '$' : product.currency === 'BRL' ? 'R$' : product.currency} {product.current_price?.toFixed(2)}
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Original Price</Label>
              <div className="font-medium">
                {product.currency === 'USD' ? '$' : product.currency === 'BRL' ? 'R$' : product.currency} {product.original_price?.toFixed(2)}
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
              <Label className="text-sm text-muted-foreground">Inventory</Label>
              <p className="font-medium">{product.current_inventory_level || 0} units • {product.days_of_supply || 0}d supply</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Velocity</Label>
              <p className="font-medium">{product.inventory_velocity?.toFixed(1) || 0}/day</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Revenue (30d)</Label>
              <p className="font-medium">
                {product.currency === 'USD' ? '$' : product.currency === 'BRL' ? 'R$' : product.currency} {product.revenue_last_30d?.toFixed(2) || 0}
              </p>
            </div>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Units Sold (30d)</Label>
              <p className="font-medium">{product.units_sold_last_30d || 0}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Conversion Rate</Label>
              <p className="font-medium">{product.conversion_rate?.toFixed(1) || 0}%</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Return Rate</Label>
              <p className="font-medium">{product.return_rate?.toFixed(1) || 0}%</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Margin</Label>
              <p className="font-medium">{product.margin_percentage?.toFixed(1) || 0}%</p>
            </div>
          </div>
          
          {product.style_attributes && Object.keys(product.style_attributes).length > 0 && (
            <>
              <Separator />
              <div>
                <Label className="text-sm text-muted-foreground">Style Attributes</Label>
                <div className="mt-2 space-y-1 text-sm">
                  {Object.entries(product.style_attributes).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-muted-foreground capitalize min-w-[120px]">{key.replace(/_/g, ' ')}:</span>
                      <span className="font-medium">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
          
          {product.material_attributes && Object.keys(product.material_attributes).length > 0 && (
            <>
              <Separator />
              <div>
                <Label className="text-sm text-muted-foreground">Material Information</Label>
                <div className="mt-2 space-y-1 text-sm">
                  {product.material_attributes.primary_material && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground min-w-[120px]">Primary Material:</span>
                      <span className="font-medium capitalize">{product.material_attributes.primary_material}</span>
                    </div>
                  )}
                  {product.material_attributes.material_composition && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground min-w-[120px]">Composition:</span>
                      <span className="font-medium">{product.material_attributes.material_composition}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          
          {product.description && (
            <>
              <Separator />
              <div>
                <Label className="text-sm text-muted-foreground">Description</Label>
                <p className="mt-2 text-sm">{product.description}</p>
              </div>
            </>
          )}
          
          {product.target_demographics && (
            <>
              <Separator />
              <div>
                <Label className="text-sm text-muted-foreground mb-2">Target Demographics</Label>
                <div className="space-y-1 mt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground min-w-[120px]">Gender:</span>
                    <span className="font-medium capitalize">{product.target_demographics.target_gender || 'Unisex'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground min-w-[120px]">Age Range:</span>
                    <span className="font-medium">{product.target_demographics.target_age_min || 18}-{product.target_demographics.target_age_max || 65}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground min-w-[120px]">Income Level:</span>
                    <span className="font-medium capitalize">{product.target_demographics.target_income_level || 'Medium'}</span>
                  </div>
                </div>
              </div>
            </>
          )}
          
          <Separator />
          
          <div className="text-sm text-muted-foreground">
            <p>Added: {formatDate(product.created_at)}</p>
            <p>Last Updated: {formatDate(product.updated_at)}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function DataTableTrends({ onTabChange, session, trendAgentGenerating, trendAgentProgress }: { 
  onTabChange?: (tab: 'trends' | 'catalog' | 'inventory' | 'campaigns') => void
  session?: any
  trendAgentGenerating?: boolean
  trendAgentProgress?: string
}) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = React.useState<'trends' | 'catalog' | 'inventory' | 'campaigns'>('trends')
  const [data, setData] = React.useState<Trend[]>([])
  const [catalogProducts, setCatalogProducts] = React.useState<any[]>([])
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'created_at', desc: true }
  ])
  const [catalogSorting, setCatalogSorting] = React.useState<SortingState>([
    { id: 'created_at', desc: true }
  ])
  const [inventorySorting, setInventorySorting] = React.useState<SortingState>([
    { id: 'confidence_score', desc: true }
  ])
  const [campaignSorting, setCampaignSorting] = React.useState<SortingState>([
    { id: 'created_at', desc: true }
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [selectedTrend, setSelectedTrend] = React.useState<Trend | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [catalogLoading, setCatalogLoading] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const inventoryTableRef = React.useRef<InventoryActionsTableRef>(null)
  const campaignTableRef = React.useRef<CampaignTableRef>(null)
  const [userBrandId, setUserBrandId] = React.useState<number | null>(null)
  const [selectedBrandId, setSelectedBrandId] = React.useState<string>("")
  const [inventoryCount, setInventoryCount] = React.useState(0)
  const [productCount, setProductCount] = React.useState(0)
  const [campaignCount, setCampaignCount] = React.useState(0)
  const [generating, setGenerating] = React.useState(false)
  const [generationProgress, setGenerationProgress] = React.useState("")
  const [campaignGenerating, setCampaignGenerating] = React.useState(false)
  const [campaignProgress, setCampaignProgress] = React.useState("")
  const [marisaSyncing, setMarisaSyncing] = React.useState(false)
  const [marisaSyncProgress, setMarisaSyncProgress] = React.useState("")
  const [catalogProductToOpen, setCatalogProductToOpen] = React.useState<any | null>(null)
  const [availableBrands, setAvailableBrands] = React.useState<{id: string, name: string}[]>([
    { id: "1", name: "Arvind Fashions" },
    { id: "2", name: "Cris Barros" },
    { id: "5", name: "Walmart" },
    { id: "6", name: "Zara" },
    { id: "7", name: "Track & Field" },
    { id: "13", name: "Marisa Lojas" }
  ])
  const [activeBrandContext, setActiveBrandContext] = React.useState<any>(null)

  const supabase = React.useMemo(
    () => createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  // Fetch brand details for context
  const fetchBrandDetails = React.useCallback(async (brandId: string) => {
    if (brandId === 'all') {
      // Use user's default brand for context
      if (userBrandId) {
        const { data: brandData } = await supabase
          .from('brands')
          .select('*')
          .eq('brand_id', userBrandId)
          .single()
        
        if (brandData) {
          setActiveBrandContext(brandData)
          // Dispatch event to update chat context
          window.dispatchEvent(new CustomEvent('brandContextChanged', { 
            detail: { brand: brandData } 
          }))
        }
      }
    } else {
      // Fetch specific brand
      const { data: brandData } = await supabase
        .from('brands')
        .select('*')
        .eq('brand_id', parseInt(brandId))
        .single()
      
      if (brandData) {
        setActiveBrandContext(brandData)
        // Dispatch event to update chat context
        window.dispatchEvent(new CustomEvent('brandContextChanged', { 
          detail: { brand: brandData } 
        }))
      }
    }
  }, [supabase, userBrandId])

  // Fetch user's brand ID and product count
  React.useEffect(() => {
    const fetchUserBrandId = async () => {
      if (!session?.user?.email) return
      
      try {
        const { data: userData, error: userError } = await supabase
          .from('usr')
          .select('brand_id, selected_brand')
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
          
          // Load saved brand selection
          if (userData.selected_brand && availableBrands.length > 0) {
            const savedBrand = availableBrands.find(b => b.name === userData.selected_brand)
            if (savedBrand) {
              setSelectedBrandId(savedBrand.id)
            } else {
              // Default to user's brand if saved brand not found
              setSelectedBrandId(userData.brand_id.toString())
            }
          } else if (!selectedBrandId && availableBrands.length > 0) {
            // Default to user's brand if no selection
            setSelectedBrandId(userData.brand_id.toString())
          }
        }
      } catch (error) {
        console.error('Error fetching user brand:', error)
      }
    }
    
    fetchUserBrandId()
  }, [session, supabase, availableBrands])

  // Add ref to prevent duplicate fetches
  const fetchingCatalogRef = React.useRef(false)
  
  // Fetch catalog products
  const fetchCatalogProducts = React.useCallback(async () => {
    // Prevent duplicate fetches
    if (fetchingCatalogRef.current || catalogLoading) {
      console.log('Already fetching catalog products, skipping...')
      return
    }
    
    try {
      fetchingCatalogRef.current = true
      setCatalogLoading(true)
      console.log('Fetching catalog products, session:', session)
      
      if (!session?.access_token) {
        console.error('No session found')
        setCatalogLoading(false)
        fetchingCatalogRef.current = false
        return
      }
      
      const url = selectedBrandId 
        ? `/api/catalog/products?brand_id=${selectedBrandId}`
        : '/api/catalog/products'
      
      const response = await fetch(url, {
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
        
        // Set products directly since we don't have related tables
        setCatalogProducts(result.products || [])
      } else {
        const error = await response.text()
        console.error('Catalog fetch error:', error)
      }
    } catch (error) {
      console.error('Error fetching catalog products:', error)
    } finally {
      setCatalogLoading(false)
      fetchingCatalogRef.current = false
    }
  }, [session, supabase, selectedBrandId])

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
      const response = await fetch('/api/trends/', {  // Added trailing slash
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

  // Fetch catalog products when session is available or brand filter changes
  React.useEffect(() => {
    if (session && userBrandId) {
      console.log('Session and brand available, fetching catalog...')
      fetchCatalogProducts()
      // Fetch brand details for AI context
      fetchBrandDetails(selectedBrandId)
      // Refresh trends with brand filter
      fetchTrends()
    }
  }, [session, userBrandId, selectedBrandId, fetchBrandDetails, fetchTrends])

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
      'risk_score': 'Risk Score',
      'trend_region': 'Region'
    }
    return sortMap[sortField] || 'Sort by'
  }

  // Filter data based on active tab
  const filteredData = React.useMemo(() => {
    console.log('Total data length:', data.length)
    console.log('Active tab:', activeTab)
    
    if (activeTab === 'trends') {
      // Show all trends (both signals and forecasts)
      return data
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
    onGlobalFilterChange: setSearchQuery,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter: searchQuery,
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
    const tab = value as 'trends' | 'catalog' | 'inventory' | 'campaigns'
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
    
    const brandIdToUse = selectedBrandId ? parseInt(selectedBrandId) : userBrandId
    
    try {
      const { count, error } = await supabase
        .from('recommendations')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandIdToUse)
        .eq('is_active', true)
      
      if (!error && count !== null) {
        setInventoryCount(count)
      }
    } catch (error) {
      console.error('Error fetching inventory count:', error)
    }
  }, [userBrandId, selectedBrandId, supabase])

  // Fetch campaign count
  const fetchCampaignCount = React.useCallback(async () => {
    if (!userBrandId) return
    
    const brandIdToUse = selectedBrandId ? parseInt(selectedBrandId) : userBrandId
    
    try {
      const { count, error } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandIdToUse)
      
      if (!error && count !== null) {
        setCampaignCount(count)
      }
    } catch (error) {
      console.error('Error fetching campaign count:', error)
    }
  }, [userBrandId, selectedBrandId, supabase])

  React.useEffect(() => {
    if (userBrandId) {
      fetchInventoryCount()
      fetchCampaignCount()
    }
  }, [userBrandId, selectedBrandId, fetchInventoryCount, fetchCampaignCount])
  
  // Listen for campaigns updated event
  React.useEffect(() => {
    const handleCampaignsUpdated = () => {
      console.log('Campaigns updated, refreshing count...')
      fetchCampaignCount()
    }
    
    window.addEventListener('campaignsUpdated', handleCampaignsUpdated)
    
    return () => {
      window.removeEventListener('campaignsUpdated', handleCampaignsUpdated)
    }
  }, [fetchCampaignCount])

  // Handle Marisa product sync
  const handleMarisaSync = React.useCallback(async () => {
    if (!userBrandId || userBrandId !== 13) return // Only for Marisa brand
    
    try {
      setMarisaSyncing(true)
      setMarisaSyncProgress('Authenticating with Marisa API...')
      
      // Show progress messages
      const progressMessages = [
        { delay: 1000, message: "Fetching product catalog from Marisa..." },
        { delay: 3000, message: "Processing product data..." },
        { delay: 5000, message: "Mapping product attributes..." },
        { delay: 7000, message: "Updating local catalog..." },
        { delay: 9000, message: "Syncing revenue metrics..." },
        { delay: 11000, message: "Finalizing sync..." }
      ]
      
      const timeouts: NodeJS.Timeout[] = []
      progressMessages.forEach(({ delay, message }) => {
        const timeout = setTimeout(() => setMarisaSyncProgress(message), delay)
        timeouts.push(timeout)
      })
      
      const response = await fetch('/api/catalog/marisa/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ brandId: userBrandId })
      })
      
      // Clear timeouts
      timeouts.forEach(timeout => clearTimeout(timeout))
      
      if (!response.ok) {
        let errorMessage = 'Sync failed'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = `Sync failed: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(`Sync complete! ${result.summary.inserted} new, ${result.summary.updated} updated, ${result.summary.deleted} removed`)
        // Refresh catalog
        await fetchCatalogProducts()
        // Update product count
        setProductCount(result.summary.totalProducts)
        // Trigger revenue metrics refresh
        window.dispatchEvent(new CustomEvent('revenueMetricsUpdated'))
      } else {
        throw new Error(result.error || 'Sync failed')
      }
    } catch (error: any) {
      console.error('Marisa sync error:', error)
      toast.error(`Sync failed: ${error.message}`)
    } finally {
      setMarisaSyncing(false)
      setMarisaSyncProgress('')
    }
  }, [userBrandId, session, fetchCatalogProducts])

  // Generate recommendations handler
  const handleGenerateRecommendations = React.useCallback(async () => {
    if (!userBrandId || !session?.user?.email) return
    
    const timeouts: NodeJS.Timeout[] = []
    
    try {
      // Check credits first
      const creditCheck = await useCredits(session.user.email, 'recommendations', 'Generating inventory recommendations')
      if (!creditCheck.success) {
        toast.error(creditCheck.message || 'Insufficient credits')
        return
      }
      
      toast.info(`Using ${CREDIT_COSTS.recommendations} credits for recommendations`)
      
      // Clear cache for all related components
      const brandIdToUse = selectedBrandId || userBrandId
      const cacheKeysToRemove = [
        // Clear stats cache (section-cards.tsx)
        `looki_stats_${session.user.email}_${brandIdToUse}`,
        `looki_stats_${session.user.email}_${brandIdToUse}_timestamp`,
        `looki_stats_${session.user.email}_default`,
        `looki_stats_${session.user.email}_default_timestamp`,
        // Clear chart cache for all time ranges (chart-area-interactive.tsx)
        ...['7d', '30d', '90d', '365d', '730d', 'all'].flatMap(range => [
          `looki_chart_${session.user.email}_${brandIdToUse}_${range}`,
          `looki_chart_${session.user.email}_${brandIdToUse}_${range}_timestamp`,
          `looki_chart_${session.user.email}_default_${range}`,
          `looki_chart_${session.user.email}_default_${range}_timestamp`
        ])
      ]
      
      // Remove all cache entries
      cacheKeysToRemove.forEach(key => {
        sessionStorage.removeItem(key)
      })
      
      console.log('Cleared cache for recommendations generation')
      
      setGenerating(true)
      setGenerationProgress("Analyzing product catalog...")
      
      // Show progress messages
      const progressMessages = [
        { delay: 1000, message: "Identifying relevant fashion trends..." },
        { delay: 2500, message: "Matching products with trends..." },
        { delay: 4000, message: "Calculating alignment scores..." },
        { delay: 5500, message: "Determining inventory actions..." },
        { delay: 7000, message: "Generating personalized recommendations..." },
        { delay: 8500, message: "Finalizing recommendations..." }
      ]

      progressMessages.forEach(({ delay, message }) => {
        const timeout = setTimeout(() => setGenerationProgress(message), delay)
        timeouts.push(timeout)
      })
      
      const response = await fetch('/api/recommendations/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ brand_id: selectedBrandId || userBrandId })
      })

      console.log('Response status:', response.status)
      console.log('Response headers:', response.headers)

      // Check if response has content before parsing
      const responseText = await response.text()
      
      console.log('Response text:', responseText)
      
      if (!responseText) {
        console.error('Empty response from API')
        throw new Error('Server returned empty response')
      }
      
      let result
      try {
        result = JSON.parse(responseText)
      } catch (parseError) {
        console.error('Failed to parse response:', responseText)
        console.error('Parse error:', parseError)
        throw new Error('Invalid response format from server')
      }
      
      console.log('Parsed result:', result)
      
      if (!response.ok) {
        console.error('API Error:', result)
        console.error('Error details:', result.error, result.message, result.type)
        throw new Error(result.error || result.message || 'Failed to generate recommendations')
      }
      toast.success(`Generated ${result.recommendations_count} recommendations`)
      
      // Refresh inventory count
      await fetchInventoryCount()
      
      // Trigger refresh in inventory table
      if (inventoryTableRef.current?.fetchRecommendations) {
        inventoryTableRef.current.fetchRecommendations()
      }
      
      // Dispatch a custom event to notify dashboard components to refresh
      window.dispatchEvent(new CustomEvent('recommendationsUpdated', { 
        detail: { 
          brandId: brandIdToUse,
          count: result.recommendations_count,
          timestamp: Date.now()
        } 
      }))
    } catch (error) {
      console.error('Error generating recommendations:', error)
      toast.error('Failed to generate recommendations')
    } finally {
      // Clear all timeouts
      timeouts.forEach((timeout: NodeJS.Timeout) => clearTimeout(timeout))
      setGenerating(false)
      setGenerationProgress("")
    }
  }, [userBrandId, selectedBrandId, session?.user?.email, fetchInventoryCount])

  // Get current catalog sort label
  const getCurrentCatalogSortLabel = () => {
    if (catalogSorting.length === 0) return 'Product Name'
    const sortField = catalogSorting[0].id
    const sortMap: Record<string, string> = {
      'product_name': 'Product Name',
      'variant_sku': 'SKU',
      'current_price': 'Price',
      'revenue_last_30d': 'Revenue',
      'inventory_velocity': 'Velocity',
      'category_hierarchy': 'Category',
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

  // Get current campaign sort label
  const getCurrentCampaignSortLabel = () => {
    if (campaignSorting.length === 0) return 'Newest First'
    const sortField = campaignSorting[0].id
    const sortMap: Record<string, string> = {
      'created_at': 'Newest First',
      'confidence_score': 'Confidence',
      'status': 'Status',
      'budget_max': 'Budget'
    }
    return sortMap[sortField] || 'Sort by'
  }

  // Listen for brand changes from header
  React.useEffect(() => {
    const handleBrandChange = (event: CustomEvent) => {
      const { brandId } = event.detail
      setSelectedBrandId(brandId)
      // Trigger refetch
      fetchCatalogProducts()
      fetchBrandDetails(brandId)
      fetchInventoryCount()
      fetchCampaignCount()
    }
    
    window.addEventListener('brandChanged', handleBrandChange as any)
    return () => {
      window.removeEventListener('brandChanged', handleBrandChange as any)
    }
  }, [fetchCatalogProducts, fetchBrandDetails, fetchInventoryCount, fetchCampaignCount])

  // Listen for switch to catalog and open product event
  React.useEffect(() => {
    const handleSwitchToCatalogAndOpenProduct = (event: CustomEvent) => {
      const { product } = event.detail
      // Switch to catalog tab
      setActiveTab('catalog')
      // Store the product to open after catalog loads
      setCatalogProductToOpen(product)
    }
    
    window.addEventListener('switchToCatalogAndOpenProduct', handleSwitchToCatalogAndOpenProduct as any)
    return () => {
      window.removeEventListener('switchToCatalogAndOpenProduct', handleSwitchToCatalogAndOpenProduct as any)
    }
  }, [])

  // Open product when catalog tab is active and product is set
  React.useEffect(() => {
    if (activeTab === 'catalog' && catalogProductToOpen && !catalogLoading) {
      // Small delay to ensure catalog is rendered
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('openCatalogProduct', { 
          detail: { product: catalogProductToOpen } 
        }))
        setCatalogProductToOpen(null)
      }, 100)
    }
  }, [activeTab, catalogProductToOpen, catalogLoading])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="text-muted-foreground">Loading trends...</div>
      </div>
    )
  }

  return (
    <HydrationWrapper>
    <div suppressHydrationWarning>
      <div className="space-y-4">
        {/* Active Brand Context Indicator */}
        {activeBrandContext && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border">
            <Badge variant="secondary" className="gap-1">
              <Building2 className="h-3 w-3" />
              AI Context
            </Badge>
            <span className="text-sm">
              <span className="text-muted-foreground">Using brand context:</span>{' '}
              <span className="font-medium">{activeBrandContext.brand_name}</span>
            </span>
            <div className="ml-auto text-xs text-muted-foreground">
              {activeBrandContext.target_gender && `${activeBrandContext.target_gender} • `}
              {activeBrandContext.target_age_min && activeBrandContext.target_age_max && 
                `Ages ${activeBrandContext.target_age_min}-${activeBrandContext.target_age_max}`}
            </div>
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="flex" translate="no">
              <TabsTrigger value="trends" className="flex items-center gap-2">
                {t('trends.tabs.trends')}
                {data.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {data.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="catalog" className="flex items-center gap-2">
                {t('trends.tabs.catalog')}
                {catalogProducts.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {catalogProducts.length}
                </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="inventory" className="flex items-center gap-2">
                {t('trends.tabs.inventory')}
                {inventoryCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {inventoryCount}
              </Badge>
                )}
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-2">
              {t('trends.tabs.campaigns')}
              {campaignCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {campaignCount}
                </Badge>
              )}
            </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              
              {/* Universal Search Bar */}
              <div className="relative">
                <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={
                    activeTab === 'trends' ? t('trends.searchPlaceholder') :
                    activeTab === 'catalog' ? t('catalog.searchPlaceholder') :
                    activeTab === 'inventory' ? t('inventory.searchPlaceholder') :
                    t('campaigns.searchPlaceholder')
                  }
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value)
                    // For inventory tab, update the table filter
                    if (activeTab === 'inventory' && inventoryTableRef.current?.setSearchFilter) {
                      inventoryTableRef.current.setSearchFilter(e.target.value)
                    }
                    // For campaigns tab, update the table filter
                    if (activeTab === 'campaigns' && campaignTableRef.current?.setSearchFilter) {
                      campaignTableRef.current.setSearchFilter(e.target.value)
                    }
                  }}
                  className="pl-8 w-[300px]"
                  translate="no"
                />
              </div>
              {activeTab !== 'catalog' && activeTab !== 'inventory' && activeTab !== 'campaigns' && (
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
                <DropdownMenuItem onClick={() => setSorting([{ id: 'trend_region', desc: false }])}>
                  Region (A-Z)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
              )}
              {activeTab === 'catalog' && (
                <>
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
                      <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'variant_sku', desc: false }])}>
                        SKU
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'current_price', desc: false }])}>
                        Price (Low to High)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'current_price', desc: true }])}>
                        Price (High to Low)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'revenue_last_30d', desc: true }])}>
                        Revenue (High to Low)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'inventory_velocity', desc: true }])}>
                        Velocity (High to Low)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'category_hierarchy', desc: false }])}>
                        Category
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCatalogSorting([{ id: 'created_at', desc: true }])}>
                        Date Added (Newest First)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {userBrandId === 13 && ( // Show sync button only for Marisa brand
                    <Button
                      onClick={handleMarisaSync}
                      disabled={marisaSyncing}
                      size="sm"
                    >
                      {marisaSyncing ? (
                        <>
                          <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <RefreshCwIcon className="mr-2 h-4 w-4" />
                          Sync Products
                        </>
                      )}
                    </Button>
                  )}
                </>
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
                  <ExportDropdown 
                    onExport={(format) => {
                      // Get recommendations data from the table ref
                      if (inventoryTableRef.current?.getData) {
                        const data = inventoryTableRef.current.getData()
                        exportRecommendations(data, format)
                        toast.success('Recommendations exported')
                      }
                    }}
                    size="sm"
                  />
                </>
              )}
              {activeTab === 'campaigns' && (
                <>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <ArrowUpDown className="mr-2 h-4 w-4" />
                        <span className="hidden lg:inline">{getCurrentCampaignSortLabel()}</span>
                        <ChevronDownIcon className="ml-2 h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onClick={() => {
                        setCampaignSorting([{ id: 'created_at', desc: true }])
                        campaignTableRef.current?.setSorting([{ id: 'created_at', desc: true }])
                      }}>
                        Newest First
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setCampaignSorting([{ id: 'confidence_score', desc: true }])
                        campaignTableRef.current?.setSorting([{ id: 'confidence_score', desc: true }])
                      }}>
                        Confidence (High to Low)
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setCampaignSorting([{ id: 'status', desc: false }])
                        campaignTableRef.current?.setSorting([{ id: 'status', desc: false }])
                      }}>
                        Status
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {
                        setCampaignSorting([{ id: 'budget_max', desc: true }])
                        campaignTableRef.current?.setSorting([{ id: 'budget_max', desc: true }])
                      }}>
                        Budget (High to Low)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    onClick={() => {
                      if (campaignTableRef.current?.generateCampaigns) {
                        campaignTableRef.current.generateCampaigns()
                      }
                    }}
                    disabled={campaignGenerating}
                    size="sm"
                  >
                    {campaignGenerating ? (
                      <>
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RocketIcon className="mr-2 h-4 w-4" />
                        Generate Campaigns
                      </>
                    )}
                  </Button>
                  <ExportDropdown 
                    onExport={(format) => {
                      // Get campaigns data from the table ref
                      if (campaignTableRef.current?.getData) {
                        const data = campaignTableRef.current.getData()
                        exportCampaigns(data, format)
                        toast.success('Campaigns exported')
                      }
                    }}
                    size="sm"
                  />
                </>
              )}
          </div>
        </div>



        <div className="flex-1 overflow-hidden">
          <TabsContent value="trends" className="flex flex-col gap-4 m-0 p-0">
            <div className="overflow-hidden rounded-lg border bg-card relative">
              {/* Loading overlay when running trend agent */}
              {trendAgentGenerating && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
                    <div className="text-sm text-muted-foreground font-medium">
                      {trendAgentProgress || "Running trend agent..."}
                    </div>
                  </div>
                </div>
              )}
              
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
                        {t('trends.noTrends')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex items-center justify-between px-4">
              <div className="flex-1 text-sm text-muted-foreground">
                {t('common.showing', { 
                  start: table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1,
                  end: Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, filteredData.length),
                  total: filteredData.length,
                  item: t('dashboard.trends').toLowerCase()
                })}
              </div>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                    <Label htmlFor="rows-per-page-trends" className="text-sm font-medium">
                    {t('common.rowsPerPage')}
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
                  {t('common.page')} {table.getState().pagination.pageIndex + 1} {t('common.of')} {table.getPageCount()}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.setPageIndex(0)}
                    disabled={!table.getCanPreviousPage()}
                    aria-label={t('common.goToFirstPage')}
                  >
                    <ChevronsLeftIcon className="h-4 w-4" />
                    <span className="sr-only">{t('common.goToFirstPage')}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                    aria-label={t('common.goToPreviousPage')}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    <span className="sr-only">{t('common.goToPreviousPage')}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                    aria-label={t('common.goToNextPage')}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                    <span className="sr-only">{t('common.goToNextPage')}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                    disabled={!table.getCanNextPage()}
                    aria-label={t('common.goToLastPage')}
                  >
                    <ChevronsRightIcon className="h-4 w-4" />
                    <span className="sr-only">{t('common.goToLastPage')}</span>
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="catalog" className="flex flex-col gap-4 m-0 p-0">
              {catalogLoading ? (
            <div className="flex items-center justify-center py-10 rounded-lg border">
                  <div className="text-muted-foreground">{t('catalog.loadingProducts')}</div>
            </div>
              ) : (
                <div className="relative">
                  {/* Loading overlay when syncing */}
                  {marisaSyncing && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                      <div className="flex flex-col items-center gap-4">
                        <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
                        <div className="text-sm text-muted-foreground font-medium">
                          {marisaSyncProgress || "Syncing products..."}
                        </div>
                      </div>
                    </div>
                  )}
                  <CatalogTable 
                    products={catalogProducts} 
                    searchQuery={searchQuery}
                    sorting={catalogSorting}
                    onSortingChange={setCatalogSorting}
                  />
                </div>
              )}
          </TabsContent>
          
          <TabsContent value="inventory" className="flex flex-col gap-4 m-0 p-0">
              {session?.user && userBrandId ? (
                <InventoryActionsTable 
                  ref={inventoryTableRef}
                  brandId={selectedBrandId ? parseInt(selectedBrandId) : userBrandId} 
                  session={session}
                  onRecommendationsGenerated={fetchInventoryCount}
                  generating={generating}
                  generationProgress={generationProgress}
                />
              ) : (
            <div className="flex items-center justify-center py-10 rounded-lg border">
                  <div className="text-muted-foreground">
                    {!session?.user ? t('auth.loginRequired') : t('common.loading')}
            </div>
                </div>
              )}
          </TabsContent>
          <TabsContent value="campaigns" className="flex flex-col gap-4 m-0 p-0">
            {session?.user && userBrandId ? (
              <CampaignTable 
                ref={campaignTableRef}
                brandId={selectedBrandId ? parseInt(selectedBrandId) : userBrandId} 
                session={session}
                generating={campaignGenerating}
                generationProgress={campaignProgress}
                onGeneratingChange={setCampaignGenerating}
                onProgressChange={setCampaignProgress}
                onCampaignsGenerated={() => {
                  // Fetch campaign count
                  supabase
                    .from('campaigns')
                    .select('*', { count: 'exact', head: true })
                    .eq('brand_id', selectedBrandId ? parseInt(selectedBrandId) : userBrandId)
                    .then(({ count }) => {
                      setCampaignCount(count || 0)
                    })
                }}
              />
            ) : (
              <div className="flex items-center justify-center py-10 rounded-lg border">
                <div className="text-muted-foreground">
                  {!session?.user ? t('auth.loginRequired') : t('common.loading')}
                </div>
              </div>
            )}
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
    </div>
    </HydrationWrapper>
  )
}

function CatalogTable({ products, searchQuery, sorting, onSortingChange }: { 
  products: any[]; 
  searchQuery: string;
  sorting: SortingState;
  onSortingChange: (sorting: SortingState) => void;
}) {
  const { t } = useTranslation()
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = React.useState({})
  const [selectedProduct, setSelectedProduct] = React.useState<any>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 20,
  })

  // Listen for open catalog product event
  React.useEffect(() => {
    const handleOpenCatalogProduct = (event: CustomEvent) => {
      const { product } = event.detail
      setSelectedProduct(product)
      setSheetOpen(true)
    }
    
    window.addEventListener('openCatalogProduct', handleOpenCatalogProduct as any)
    return () => {
      window.removeEventListener('openCatalogProduct', handleOpenCatalogProduct as any)
    }
  }, [])

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "variant_sku",
      header: "SKU",
      cell: ({ row }) => (
        <div className="font-mono text-sm">{row.getValue("variant_sku")}</div>
      ),
    },
    {
      accessorKey: "product_name",
      header: "Product",
      cell: ({ row, table }) => {
        const product = row.original
        const images = product.images || []
        const hasImage = images.length > 0
        
        return (
          <div 
            className="flex items-center gap-3 cursor-pointer hover:text-primary"
            onClick={() => (table.options.meta as any)?.onRowClick?.(row.original)}
          >
            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center flex-shrink-0 overflow-hidden">
              {hasImage ? (
                <img 
                  src={images[0]} 
                  alt={product.product_name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                    e.currentTarget.nextElementSibling?.classList.remove('hidden')
                  }}
                />
              ) : null}
              <ImageIcon className={`h-5 w-5 text-muted-foreground ${hasImage ? 'hidden' : ''}`} />
            </div>
            <div className="max-w-[300px]">
              <div className="font-medium truncate">{product.product_name}</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{product.color} • {product.size}</span>
              </div>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "category_hierarchy",
      header: "Category",
      cell: ({ row }) => {
        const category = row.getValue("category_hierarchy") as string
        const displayCategory = category?.split('/').pop() || 'Uncategorized'
        return (
          <Badge variant="secondary">
            {displayCategory}
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
            {originalPrice && originalPrice > price && (
              <div className="flex items-center gap-2 text-xs">
                <span className="line-through text-muted-foreground">
                  {currency === 'USD' ? '$' : currency} {originalPrice.toFixed(2)}
                </span>
                {discount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    -{discount}%
                  </Badge>
                )}
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "inventory_velocity",
      header: ({ column }) => (
        <div className="flex items-center gap-1">
          <span>Velocity</span>
          <CalculationTooltip
            title="Inventory Velocity"
            value="Units/Day"
            steps={[
              { label: "Units Sold (30d)", value: "units_sold_last_30d", formula: "Total units sold in last 30 days" },
              { label: "Days", value: "30", formula: "Time period" },
              { label: "Velocity", value: "units/day", formula: "units_sold / days" }
            ]}
            description="Rate at which inventory is moving"
            size="sm"
          />
        </div>
      ),
      cell: ({ row }) => {
        const velocity = parseFloat(row.getValue("inventory_velocity") || "0")
        const unitsLast30d = row.original.units_sold_last_30d || 0
        
        return (
          <div className="space-y-1">
            <div className="font-medium">{velocity.toFixed(1)}/day</div>
            <div className="text-xs text-muted-foreground">
              {unitsLast30d} units/30d
            </div>
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
        const daysOfSupply = row.original.days_of_supply
        
        return (
          <div className="space-y-1">
            <Badge 
              variant={status === "InStock" ? "default" : "secondary"}
              className={status === "InStock" ? "bg-green-500 text-white hover:bg-green-600" : ""}
            >
              {status}
            </Badge>
            <div className="text-xs text-muted-foreground">
              {inventory} units • {daysOfSupply}d supply
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "revenue_last_30d",
      header: "Revenue (30d)",
      cell: ({ row }) => {
        const revenue = parseFloat(row.getValue("revenue_last_30d") || "0")
        const currency = row.original.currency || 'BRL'
        const conversionRate = row.original.conversion_rate || 0
        
        return (
          <div className="space-y-1">
            <div className="font-medium">
              {currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : currency} {revenue.toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground">
              {conversionRate.toFixed(1)}% conv
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "trend_match_score",
      header: ({ column }) => (
        <div className="flex items-center gap-1">
          <span>Trend Match</span>
          <CalculationTooltip
            title="Trend Match Score"
            value="0-100%"
            steps={[
              { label: "Category Match", value: "30%", formula: "product category vs trending categories" },
              { label: "Style Attributes", value: "25%", formula: "color, pattern, silhouette alignment" },
              { label: "Price Alignment", value: "20%", formula: "price point vs trend demographics" },
              { label: "Seasonality", value: "15%", formula: "seasonal relevance score" },
              { label: "Brand Fit", value: "10%", formula: "brand positioning alignment" }
            ]}
            description="Measures how well a product aligns with current fashion trends"
            size="sm"
          />
        </div>
      ),
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
            {t('common.page')} {table.getState().pagination.pageIndex + 1} {t('common.of')} {table.getPageCount()}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label={t('common.goToFirstPage')}
            >
              <ChevronsLeftIcon className="h-4 w-4" />
              <span className="sr-only">{t('common.goToFirstPage')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label={t('common.goToPreviousPage')}
            >
              <ChevronLeftIcon className="h-4 w-4" />
              <span className="sr-only">{t('common.goToPreviousPage')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label={t('common.goToNextPage')}
            >
              <ChevronRightIcon className="h-4 w-4" />
              <span className="sr-only">{t('common.goToNextPage')}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              aria-label={t('common.goToLastPage')}
            >
              <ChevronsRightIcon className="h-4 w-4" />
              <span className="sr-only">{t('common.goToLastPage')}</span>
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