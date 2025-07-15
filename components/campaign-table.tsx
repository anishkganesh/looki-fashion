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
  RocketIcon,
  CalendarIcon,
  UsersIcon,
  DollarSignIcon,
  TrendingUpIcon,
  PackageIcon,
  TagIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Loader2Icon,
  ImageIcon,
  FileDownIcon,
  MessageSquare,
  CheckCircle2Icon,
  Check,
  PauseIcon,
  PlayIcon,
  HashIcon,
  TargetIcon,
  SparklesIcon,
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
import { Progress } from "@/components/ui/progress"
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
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { useCredits, CREDIT_COSTS } from "@/components/credits-widget"
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { ExportDropdown } from "@/components/ui/export-dropdown"
import { exportCampaigns, type ExportFormat } from "@/lib/export-utils"

interface Campaign {
  campaign_id: number
  brand_id: number
  campaign_name: string
  campaign_description: string
  start_date: string
  end_date: string
  status: 'draft' | 'active' | 'completed' | 'paused'
  bundle_criteria: any
  bundle_reasons: string[]
  target_audience: any
  target_audience_description: string
  budget_min: number
  budget_max: number
  budget_currency: string
  budget_reasoning: string
  marketing_copy: string
  hashtags: string[]
  content_suggestions: any[]
  impressions: number
  clicks: number
  conversions: number
  revenue: number
  roi: number
  confidence_score: number
  generation_reasons: any
  is_applied: boolean
  applied_at: string | null
  created_at: string
  updated_at: string
  performance_metrics?: any
  products?: any[]
  trends?: any[]
  trend_id?: number
  trend?: any
  social_reach?: number
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
) 

function CampaignDetailSheet({ 
  campaign, 
  open, 
  onOpenChange,
  onUpdateCampaign
}: { 
  campaign: Campaign | null, 
  open: boolean, 
  onOpenChange: (open: boolean) => void,
  onUpdateCampaign: (campaign: Campaign) => void
}) {
  const { t } = useTranslation()
  const [applying, setApplying] = React.useState(false)
  const [generatingImage, setGeneratingImage] = React.useState(false)
  const [generatedImage, setGeneratedImage] = React.useState<string | null>(null)
  const [applied, setApplied] = React.useState(campaign?.is_applied || false)

  React.useEffect(() => {
    if (campaign) {
      setApplied(campaign.is_applied || false)
      setGeneratedImage(null)
      setGeneratingImage(false)
    }
  }, [campaign])
  
  if (!campaign) return null

  const handleApply = async () => {
    setApplying(true)
    try {
      const newAppliedState = !applied
      
      const response = await fetch('/api/campaigns', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaign.campaign_id,
          action: newAppliedState ? 'apply' : 'unapply'
        })
      })

      if (!response.ok) throw new Error('Failed to update campaign')
      
      const { campaign: updatedCampaign } = await response.json()
      setApplied(newAppliedState)
      onUpdateCampaign(updatedCampaign)
      toast.success(newAppliedState ? 'Campaign applied - performance will be tracked' : 'Campaign unapplied')
    } catch (error) {
      console.error('Error applying campaign:', error)
      toast.error('Failed to update campaign')
    } finally {
      setApplying(false)
    }
  }

  const handleGenerateImage = async () => {
    setGeneratingImage(true)
    try {
      const productNames = campaign.products?.slice(0, 3).map(p => p.product_name).join(', ') || ''
      const trendNames = campaign.trends?.slice(0, 2).map(t => t.trend_identifier).join(', ') || ''
      
      const prompt = `Fashion campaign hero image featuring ${productNames}. Campaign theme: ${campaign.campaign_name}. Trends: ${trendNames}. Professional fashion photography, editorial layout, clean aesthetic, brand cohesion.`
      
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt,
          brandContext: { style: 'contemporary', price_point: 'premium' }
        })
      })
      
      if (!response.ok) throw new Error('Failed to generate image')
      
      const data = await response.json()
      if (data.url) {
        setGeneratedImage(data.url)
        toast.success('Campaign visual generated')
      }
    } catch (error: any) {
      console.error('Error generating image:', error)
      toast.error('Failed to generate image')
    } finally {
      setGeneratingImage(false)
    }
  }

  const handleExport = (format: ExportFormat) => {
    if (!campaign) return
    
    const exportData = [{
      campaign_id: campaign.campaign_id,
      campaign_name: campaign.campaign_name,
      description: campaign.campaign_description,
      status: campaign.status,
      trend_name: campaign.trend?.trend_identifier || 'N/A',
      social_reach: campaign.social_reach || campaign.trend?.social_reach || 0,
      budget_min: campaign.budget_min,
      budget_max: campaign.budget_max,
      budget_reasoning: campaign.budget_reasoning,
      target_audience: campaign.target_audience_description,
      marketing_copy: campaign.marketing_copy,
      hashtags: campaign.hashtags?.join(', ') || '',
      content_suggestions: JSON.stringify(campaign.content_suggestions),
      products: campaign.products?.map((p: any) => p.product_name).join(', ') || '',
      product_count: campaign.products?.length || 0,
      is_applied: campaign.is_applied ? 'Yes' : 'No',
      created_at: campaign.created_at,
      updated_at: campaign.updated_at
    }]
    
    exportCampaigns(exportData, format)
    toast.success('Campaign exported')
  }

  const handleAddToChat = () => {
    const context = `Campaign: ${campaign.campaign_name}\n` +
      `Description: ${campaign.campaign_description}\n` +
      `Budget: $${campaign.budget_min}-$${campaign.budget_max}\n` +
      `Products: ${campaign.products?.length || 0}\n` +
      `Trends: ${campaign.trends?.map(t => t.trend_identifier).join(', ')}`
    
    // Add to chat context
    window.dispatchEvent(new CustomEvent('add-to-chat', { detail: { context } }))
    toast.success('Added to chat context')
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RocketIcon className="h-5 w-5" />
              <SheetTitle>{campaign.campaign_name}</SheetTitle>
            </div>
            <Badge variant={
              campaign.status === 'active' ? 'default' :
              campaign.status === 'completed' ? 'secondary' :
              campaign.status === 'paused' ? 'outline' :
              'secondary'
            }>
              {campaign.status}
            </Badge>
          </div>
          <SheetDescription>{campaign.campaign_description}</SheetDescription>
        </SheetHeader>

        {/* Action Buttons - Moved to top */}
        <div className="flex gap-2 mt-6">
          <Button 
            onClick={handleApply} 
            disabled={applying}
            variant={applied ? "secondary" : "default"}
            size="sm"
          >
            {applied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Applied
              </>
            ) : (
              <>
                <CheckCircle2Icon className="h-4 w-4 mr-2" />
                Apply
              </>
            )}
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="icon"
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
              <TooltipContent>Generate Visual</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <ExportDropdown onExport={handleExport} size="sm" variant="outline" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={handleAddToChat}>
                  <MessageSquare className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add to Chat</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="mt-6 space-y-6">
          {/* Campaign Dates */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Campaign Period</Label>
            <div className="flex items-center gap-2 text-sm">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              {format(new Date(campaign.start_date), 'MMM d, yyyy')} - {format(new Date(campaign.end_date), 'MMM d, yyyy')}
            </div>
          </div>

          {/* Budget */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Budget Range</Label>
            <div className="flex items-center gap-2">
              <DollarSignIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                ${campaign.budget_min.toLocaleString()} - ${campaign.budget_max.toLocaleString()} {campaign.budget_currency}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{campaign.budget_reasoning}</p>
          </div>

          {/* Social Reach */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Social Reach</Label>
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">
                {campaign.social_reach && campaign.social_reach > 0 ? (
                  campaign.social_reach > 1000000 
                    ? `${(campaign.social_reach / 1000000).toFixed(1)}M` 
                    : campaign.social_reach > 1000 
                    ? `${(campaign.social_reach / 1000).toFixed(0)}K`
                    : campaign.social_reach.toString()
                ) : 'Not available'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Potential audience reach based on trend data</p>
          </div>

          {/* Bundle Information */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Bundle Criteria</Label>
            <div className="flex flex-wrap gap-2">
              {campaign.bundle_reasons.map((reason, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {reason}
                </Badge>
              ))}
            </div>
          </div>

          {/* Target Audience */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Target Audience</Label>
            <div className="flex items-start gap-2">
              <UsersIcon className="h-4 w-4 text-muted-foreground mt-0.5" />
              <p className="text-sm">{campaign.target_audience_description}</p>
            </div>
          </div>

          {/* Marketing Copy */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Marketing Copy</Label>
            <p className="text-sm bg-muted p-3 rounded-md">{campaign.marketing_copy}</p>
          </div>

          {/* Hashtags */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Hashtags</Label>
            <div className="flex flex-wrap gap-2">
              {campaign.hashtags.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  <HashIcon className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Products */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Products ({campaign.products?.length || 0})
            </Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {campaign.products?.map((product, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <div>
                    <p className="text-sm font-medium">{product.product_name}</p>
                    <p className="text-xs text-muted-foreground">SKU: {product.variant_sku}</p>
                  </div>
                  <span className="text-sm font-medium">${product.current_price}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trends */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">
              Associated Trends ({campaign.trends?.length || 0})
            </Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {campaign.trends?.map((trend, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <div>
                    <p className="text-sm font-medium">{trend.trend_identifier}</p>
                    <p className="text-xs text-muted-foreground">{trend.link_reason}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {Math.round((trend.relevance_score || 0) * 100)}% match
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Metrics (if applied) */}
          {campaign.is_applied && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Performance Metrics</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Impressions</p>
                  <p className="text-lg font-medium">{campaign.impressions.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Clicks</p>
                  <p className="text-lg font-medium">{campaign.clicks.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Conversions</p>
                  <p className="text-lg font-medium">{campaign.conversions.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-lg font-medium">${campaign.revenue.toLocaleString()}</p>
                </div>
              </div>
              {campaign.roi && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">ROI</p>
                  <div className="flex items-center gap-2">
                    <Progress value={Math.min(campaign.roi, 100)} className="h-2" />
                    <span className="text-sm font-medium">{campaign.roi}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Generated Image */}
          {generatedImage && (
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Campaign Visual</Label>
              <img 
                src={generatedImage} 
                alt={campaign.campaign_name}
                className="w-full rounded-lg border"
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
} 

export const CampaignTable = React.forwardRef<
  { 
    fetchCampaigns: () => void;
    generateCampaigns: () => void;
    setSearchFilter: (value: string) => void;
    setSorting: (sorting: any) => void;
    getData: () => Campaign[];
  },
  { 
    brandId: number; 
    session?: any;
    onCampaignsGenerated?: () => void;
    generating?: boolean;
    generationProgress?: string;
    onGeneratingChange?: (generating: boolean) => void;
    onProgressChange?: (progress: string) => void;
  }
>(({ brandId, session, onCampaignsGenerated, generating: parentGenerating, generationProgress: parentProgress, onGeneratingChange, onProgressChange }, ref) => {
  const { t } = useTranslation()
  const [data, setData] = React.useState<Campaign[]>([])
  const [loading, setLoading] = React.useState(true)
  const [localGenerating, setLocalGenerating] = React.useState(false)
  const [localProgress, setLocalProgress] = React.useState("")
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'created_at', desc: true }
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [selectedCampaign, setSelectedCampaign] = React.useState<Campaign | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 20,
  })

  // Use parent state if provided, otherwise use local state
  const generating = parentGenerating !== undefined ? parentGenerating : localGenerating
  const generationProgress = parentProgress !== undefined ? parentProgress : localProgress

  const setGenerating = (value: boolean) => {
    if (onGeneratingChange) {
      onGeneratingChange(value)
    } else {
      setLocalGenerating(value)
    }
  }

  const setProgress = (value: string) => {
    if (onProgressChange) {
      onProgressChange(value)
    } else {
      setLocalProgress(value)
    }
  }

  // Fetch campaigns
  const fetchCampaigns = React.useCallback(async () => {
    try {
      setLoading(true)
      
      const response = await fetch(`/api/campaigns?brand_id=${brandId}`)
      if (!response.ok) throw new Error('Failed to fetch campaigns')
      
      const { campaigns } = await response.json()
      setData(campaigns || [])
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  // Generate new campaigns
  const generateCampaigns = React.useCallback(async () => {
    if (!session?.user?.email) {
      toast.error('Please log in to generate campaigns')
      return
    }

    // Check credits
    const creditCheck = await useCredits(
      session.user.email, 
      'campaign_generation' as keyof typeof CREDIT_COSTS,
      'Campaign generation'
    )
    
    if (!creditCheck.success) {
      toast.error(creditCheck.message || 'Insufficient credits')
      return
    }

    setGenerating(true)
    setProgress("Analyzing product catalog...")
    
    // Show progress messages
    const progressMessages = [
      { delay: 1000, message: "Identifying bundling opportunities..." },
      { delay: 2500, message: "Analyzing product similarities..." },
      { delay: 4000, message: "Matching with trending topics..." },
      { delay: 5500, message: "Generating campaign strategies..." },
      { delay: 7000, message: "Creating marketing content..." },
      { delay: 8500, message: "Finalizing campaigns..." }
    ]

    const timeouts: NodeJS.Timeout[] = []
    progressMessages.forEach(({ delay, message }) => {
      const timeout = setTimeout(() => setProgress(message), delay)
      timeouts.push(timeout)
    })

    try {
      const response = await fetch('/api/campaigns/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to generate campaigns')
      }

      const result = await response.json()
      
      if (result.campaigns_generated > 0) {
        toast.success(t('campaigns.messages.generated', { count: result.campaigns_generated }))
        await fetchCampaigns()
        onCampaignsGenerated?.()
      } else {
        toast.info(t('campaigns.messages.noOpportunities'))
      }
    } catch (error: any) {
      console.error('Error generating campaigns:', error)
      toast.error(error.message || 'Failed to generate campaigns')
    } finally {
      // Clear all timeouts
      timeouts.forEach(timeout => clearTimeout(timeout))
      setGenerating(false)
      setProgress("")
    }
  }, [brandId, session, onCampaignsGenerated, fetchCampaigns, t])

  React.useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  // Expose methods to parent
  React.useImperativeHandle(ref, () => ({
    fetchCampaigns,
    generateCampaigns,
    setSearchFilter: setGlobalFilter,
    setSorting: setSorting,
    getData: () => data
  }), [fetchCampaigns, generateCampaigns, setGlobalFilter, setSorting, data])

  const handleUpdateCampaign = (updatedCampaign: Campaign) => {
    setData(prev => prev.map(c => 
      c.campaign_id === updatedCampaign.campaign_id ? updatedCampaign : c
    ))
  }

  const columns: ColumnDef<Campaign>[] = [
    {
      accessorKey: "campaign_name",
      header: "Campaign",
      cell: ({ row }) => {
        const campaign = row.original
        const isActive = campaign.status === 'active'
        const isPaused = campaign.status === 'paused'
        
        return (
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isActive ? 'bg-green-100 dark:bg-green-900/20' :
              isPaused ? 'bg-yellow-100 dark:bg-yellow-900/20' :
              'bg-muted'
            }`}>
              <RocketIcon className={`h-5 w-5 ${
                isActive ? 'text-green-600 dark:text-green-400' :
                isPaused ? 'text-yellow-600 dark:text-yellow-400' :
                'text-muted-foreground'
              }`} />
            </div>
            <div>
              <p className="font-medium">{campaign.campaign_name}</p>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {campaign.campaign_description}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "bundle_info",
      header: "Bundle",
      cell: ({ row }) => {
        const campaign = row.original
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PackageIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{campaign.products?.length || 0} products</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {campaign.bundle_reasons.slice(0, 2).map((reason, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {reason}
                </Badge>
              ))}
              {campaign.bundle_reasons.length > 2 && (
                <Badge variant="outline" className="text-xs">
                  +{campaign.bundle_reasons.length - 2}
                </Badge>
              )}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "trends",
      header: "Trends",
      cell: ({ row }) => {
        const campaign = row.original
        const trends = campaign.trends || []
        
        if (trends.length === 0) {
          return <span className="text-muted-foreground">No trends</span>
        }
        
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{trends.length} trends</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {trends[0]?.trend_identifier}
              {trends.length > 1 && ` +${trends.length - 1}`}
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: "social_reach",
      header: "Social Reach",
      cell: ({ row }) => {
        const campaign = row.original
        const reach = campaign.social_reach || campaign.trend?.social_reach || 0
        
        if (reach === 0) {
          return <span className="text-muted-foreground">—</span>
        }
        
        const formatted = reach > 1000000 
          ? `${(reach / 1000000).toFixed(1)}M` 
          : reach > 1000 
          ? `${(reach / 1000).toFixed(0)}K`
          : reach.toString()
          
        return (
          <div className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{formatted}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "budget",
      header: "Budget",
      cell: ({ row }) => {
        const campaign = row.original
        return (
          <div className="text-right">
            <p className="font-medium">
              ${campaign.budget_min.toLocaleString()}-${campaign.budget_max.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{campaign.budget_currency}</p>
          </div>
        )
      },
    },
    {
      accessorKey: "dates",
      header: "Duration",
      cell: ({ row }) => {
        const campaign = row.original
        const startDate = new Date(campaign.start_date)
        const endDate = new Date(campaign.end_date)
        const daysLeft = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm">
              <CalendarIcon className="h-3 w-3 text-muted-foreground" />
              {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')}
            </div>
            {campaign.status === 'active' && daysLeft > 0 && (
              <p className="text-xs text-muted-foreground">{daysLeft} days left</p>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "performance",
      header: "Performance",
      cell: ({ row }) => {
        const campaign = row.original
        
        if (!campaign.is_applied) {
          return (
            <Badge variant="outline" className="text-xs">
              Not Applied
            </Badge>
          )
        }
        
        const ctr = campaign.impressions > 0 
          ? ((campaign.clicks / campaign.impressions) * 100).toFixed(1)
          : '0'
          
        return (
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">CTR:</span>
              <span className="font-medium">{ctr}%</span>
            </div>
            {campaign.roi && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">ROI:</span>
                <span className={`font-medium ${
                  campaign.roi > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {campaign.roi > 0 ? '+' : ''}{campaign.roi}%
                </span>
              </div>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "confidence_score",
      header: "Confidence",
      cell: ({ row }) => {
        const score = row.original.confidence_score * 100
        const color = score > 80 ? 'text-green-600' : score > 60 ? 'text-yellow-600' : 'text-orange-600'
        
        return (
          <div className="flex items-center gap-2">
            <SparklesIcon className={`h-4 w-4 ${color}`} />
            <span className={`font-medium ${color}`}>{Math.round(score)}%</span>
          </div>
        )
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status
        const variant = 
          status === 'active' ? 'default' :
          status === 'completed' ? 'secondary' :
          status === 'paused' ? 'outline' :
          'secondary'
          
        const icon = 
          status === 'active' ? <PlayIcon className="h-3 w-3" /> :
          status === 'paused' ? <PauseIcon className="h-3 w-3" /> :
          status === 'completed' ? <CheckCircle2Icon className="h-3 w-3" /> :
          null
          
        return (
          <Badge variant={variant} className="gap-1">
            {icon}
            {status}
          </Badge>
        )
      },
    },
    {
      accessorKey: "created_at",
      header: () => null,
      cell: () => null,
      enableHiding: true,
      enableColumnFilter: false,
    },
    {
      accessorKey: "budget_max",
      header: () => null,
      cell: () => null,
      enableHiding: true,
      enableColumnFilter: false,
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
    state: {
      sorting,
      columnFilters,
      pagination,
      globalFilter,
    },
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <>
      <div className="rounded-lg border bg-card relative">
        {/* Loading overlay when generating */}
        {generating && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
              <div className="text-sm text-muted-foreground font-medium">
                {generationProgress || "Generating campaigns..."}
              </div>
            </div>
          </div>
        )}
        
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
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
                    setSelectedCampaign(row.original)
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
                    ? "No campaigns generated yet. Click 'Generate Campaigns' to start."
                    : "No campaigns found."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 py-4">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} campaign(s)
        </div>
        <div className="flex items-center space-x-2">
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

      <CampaignDetailSheet 
        campaign={selectedCampaign}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdateCampaign={handleUpdateCampaign}
      />
    </>
  )
}) 