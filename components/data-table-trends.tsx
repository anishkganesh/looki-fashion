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
    header: "Created Date",
    cell: ({ row }) => {
      const date = new Date(row.original.created_at)
      return <span className="text-sm text-muted-foreground">{date.toLocaleDateString()}</span>
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

export function DataTableTrends() {
  const [data, setData] = React.useState<Trend[]>([])
  const [loading, setLoading] = React.useState(true)
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'created_at', desc: true }
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({
    last_updated: false
  })
  const [rowSelection, setRowSelection] = React.useState({})
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 20,
  })
  const [selectedTrend, setSelectedTrend] = React.useState<Trend | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [initialLoad, setInitialLoad] = React.useState(true)
  const [activeTab, setActiveTab] = React.useState<'trends' | 'catalog' | 'inventory' | 'forecast'>('trends')

  // Initialize Supabase client for real-time updates only
  const supabase = React.useMemo(
    () => createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  // Fetch trends from API (bypasses RLS)
  const fetchTrends = React.useCallback(async () => {
    try {
      // Only show loading on initial load
      if (initialLoad) {
        setLoading(true)
      }
      
      const response = await fetch('/api/trends')
      const result = await response.json()

      if (!response.ok || !result.success) {
        console.error('Error fetching trends:', result.error)
      } else {
        setData(result.trends || [])
      }
    } catch (error) {
      console.error('Error:', error)
    } finally {
      setLoading(false)
      setInitialLoad(false)
    }
  }, [initialLoad])

  React.useEffect(() => {
    fetchTrends()
    
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
  }, [supabase, fetchTrends])

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
    if (activeTab === 'trends') {
      return data.filter(trend => trend.trend_type === 'signal' || !trend.trend_type)
    } else if (activeTab === 'forecast') {
      return data.filter(trend => trend.trend_type === 'forecast')
    }
    return data
  }, [data, activeTab])

  // Calculate counts for each tab
  const signalCount = React.useMemo(() => 
    data.filter(trend => trend.trend_type === 'signal' || !trend.trend_type).length, 
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
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    meta: {
      onRowClick: (trend: Trend) => {
        setSelectedTrend(trend)
        setSheetOpen(true)
      }
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="text-muted-foreground">Loading trends...</div>
      </div>
    )
  }

  return (
    <>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex w-full flex-col justify-start gap-6">
        <div className="flex items-center justify-between">
          <TabsList className="font-sans">
            <TabsTrigger value="trends">
              Trend Signals
              {signalCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
                >
                  {signalCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="catalog" className="gap-1">
              Catalog Matches{" "}
              <Badge
                variant="secondary"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
              >
                3
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-1">
              Inventory Actions{" "}
              <Badge
                variant="secondary"
                className="flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
              >
                2
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="forecast">
              Trend Forecasts
              {forecastCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-muted-foreground/30"
                >
                  {forecastCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
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
            <Button variant="outline" size="sm">
              <PlusIcon className="mr-2 h-4 w-4" />
              <span className="hidden lg:inline">Add Section</span>
            </Button>
          </div>
        </div>
        <TabsContent value="trends" className="relative flex flex-col gap-4 overflow-auto">
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
                <Label htmlFor="rows-per-page" className="text-sm font-medium">
                  Rows per page
                </Label>
                <Select
                  value={`${table.getState().pagination.pageSize}`}
                  onValueChange={(value) => {
                    table.setPageSize(Number(value))
                  }}
                >
                  <SelectTrigger className="w-20" id="rows-per-page">
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
        
        {/* Catalog Matches tab content placeholder */}
        <TabsContent value="catalog" className="relative flex flex-col gap-4 overflow-auto">
          <div className="flex items-center justify-center py-10">
            <div className="text-muted-foreground">Catalog matches feature coming soon...</div>
          </div>
        </TabsContent>
        
        {/* Inventory Actions tab content placeholder */}
        <TabsContent value="inventory" className="relative flex flex-col gap-4 overflow-auto">
          <div className="flex items-center justify-center py-10">
            <div className="text-muted-foreground">Inventory actions feature coming soon...</div>
          </div>
        </TabsContent>
        
        {/* Trend Forecasts tab content - same table structure as trends */}
        <TabsContent value="forecast" className="relative flex flex-col gap-4 overflow-auto">
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
      </Tabs>
      
      <TrendDetailSheet 
        trend={selectedTrend} 
        open={sheetOpen} 
        onOpenChange={setSheetOpen}
        onUpdateTrend={handleUpdateTrend}
      />
    </>
  )
} 