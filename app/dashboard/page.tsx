"use client"

import { AppSidebar } from "../../components/app-sidebar"
import { ChartAreaInteractive } from "../../components/chart-area-interactive"
import { DataTableTrends } from "../../components/data-table-trends"
import { SectionCards } from "../../components/section-cards"
import { SiteHeader } from "../../components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ChatLayout } from "@/components/chat-layout"
import { RevenueMetrics } from "@/components/revenue-metrics"
import { useRequireAuth } from "@/lib/auth-utils"
import { Loader2, Clock, Database, StopCircle, PlayCircle, CheckCircle2, Lightbulb, RocketIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import * as React from "react"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { Skeleton } from "@/components/ui/skeleton"
import { useCredits, CREDIT_COSTS } from "@/components/credits-widget"
import { useTranslation } from 'react-i18next'

export default function DashboardPage() {
  const { user, session, isLoading } = useRequireAuth()
  const { t } = useTranslation()
  const [isScrapingManually, setIsScrapingManually] = useState(false)
  const [progressMessage, setProgressMessage] = useState<string>("")
  const [agentStatus, setAgentStatus] = useState<{
    lastRun?: string
    nextRun?: string
    totalTrends?: number
    canRunNow?: boolean
  }>({})
  const [autoRunEnabled, setAutoRunEnabled] = useState(false)
  const [nextRunTime, setNextRunTime] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState<string>("")
  const [catalogIntegrated, setCatalogIntegrated] = useState(false)
  const [productCount, setProductCount] = useState(0)
  const [recommendationCount, setRecommendationCount] = useState(0)
  const [campaignCount, setCampaignCount] = useState(0)
  const [activeTab, setActiveTab] = useState<'trends' | 'catalog' | 'inventory' | 'campaigns'>('trends')
  const [selectedBrandId, setSelectedBrandId] = useState<string>("")
  const [statsLoading, setStatsLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(true)

  // Fetch user's selected brand
  React.useEffect(() => {
    const fetchSelectedBrand = async () => {
      if (!user?.email) return
      
      const { data: userData } = await supabase
        .from('usr')
        .select('brand_id, selected_brand')
        .eq('email', user.email)
        .single()
      
      if (userData?.selected_brand) {
        // Get brand ID from available brands (would need to fetch or hardcode)
        const brandMap: Record<string, string> = {
          "Arvind Fashions": "1",
          "Cris Barros": "2",
          "Track & Field": "7",
          "Walmart": "5",
          "Zara": "6",
          "Marisa Lojas": "13"
        }
        setSelectedBrandId(brandMap[userData.selected_brand] || userData.brand_id?.toString() || "")
      } else if (userData?.brand_id) {
        setSelectedBrandId(userData.brand_id.toString())
      }
    }
    
    fetchSelectedBrand()
  }, [user])

  // Listen for brand changes
  React.useEffect(() => {
    const handleBrandChange = (event: CustomEvent) => {
      const { brandId } = event.detail
      setSelectedBrandId(brandId)
      // Trigger loading states
      setStatsLoading(true)
      setChartLoading(true)
    }
    
    window.addEventListener('brandChanged', handleBrandChange as any)
    return () => {
      window.removeEventListener('brandChanged', handleBrandChange as any)
    }
  }, [])

  // Check catalog integration status
  const checkCatalogStatus = async () => {
    if (!user) return
    
    try {
      // Get user's brand
      const { data: userData } = await supabase
        .from('usr')
        .select('brand_id')
        .eq('email', user.email)
        .single()
      
      if (userData?.brand_id) {
        // Check if catalog is integrated
        const { data: brandData } = await supabase
          .from('brands')
          .select('has_catalog_integrated')
          .eq('brand_id', userData.brand_id)
          .single()
        
        setCatalogIntegrated(brandData?.has_catalog_integrated || false)
        
        // Get product count
        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('brand_id', userData.brand_id)
        
        setProductCount(count || 0)
        
        // Get recommendation count
        const { count: recCount } = await supabase
          .from('recommendations')
          .select('*', { count: 'exact', head: true })
          .eq('brand_id', userData.brand_id)
          .eq('is_active', true)
        
        setRecommendationCount(recCount || 0)
        
        // Get campaign count
        const { count: campCount, error: campError } = await supabase
          .from('campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('brand_id', userData.brand_id)
        
        console.log('Campaign count fetch:', { count: campCount, error: campError, brandId: userData.brand_id })
        setCampaignCount(campCount || 0)
      }
    } catch (error) {
      console.error('Error checking catalog status:', error)
    }
  }
  
  useEffect(() => {
    checkCatalogStatus()
  }, [user])
  
  // Refresh counts when tabs are active
  useEffect(() => {
    if (activeTab === 'inventory' || activeTab === 'campaigns') {
      checkCatalogStatus()
    }
  }, [activeTab])

  // Load auto-run state from localStorage
  useEffect(() => {
    const savedAutoRun = localStorage.getItem('autoRunEnabled')
    const savedNextRun = localStorage.getItem('nextRunTime')
    
    if (savedAutoRun === 'true') {
      setAutoRunEnabled(true)
      if (savedNextRun) {
        setNextRunTime(new Date(savedNextRun))
      }
    }
  }, [])

  // Update countdown timer
  useEffect(() => {
    if (!autoRunEnabled || !nextRunTime) {
      setCountdown("")
      return
    }

    const updateCountdown = () => {
      const now = new Date()
      const diff = nextRunTime.getTime() - now.getTime()
      
      if (diff <= 0) {
        // Time to run!
        handleManualScrape()
        // Set next run time (3 hours from now)
        const newNextRun = new Date(now.getTime() + 3 * 60 * 60 * 1000)
        setNextRunTime(newNextRun)
        localStorage.setItem('nextRunTime', newNextRun.toISOString())
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        setCountdown(`${hours}h ${minutes}m`)
      }
    }

    updateCountdown()
    const interval = setInterval(updateCountdown, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [autoRunEnabled, nextRunTime])

  // Fetch agent status
  const fetchAgentStatus = async () => {
    try {
      const response = await fetch('/api/trends/scrape')
      if (response.ok) {
        const data = await response.json()
        setAgentStatus({
          lastRun: data.lastRun,
          nextRun: data.nextRun,
          totalTrends: data.totalTrends,
          canRunNow: true
        })
      }
    } catch (error) {
      console.error('Error fetching agent status:', error)
    }
  }

  useEffect(() => {
    fetchAgentStatus()
    const interval = setInterval(fetchAgentStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleManualScrape = async () => {
    try {
      // Check credits first
      const creditCheck = await useCredits(user?.email!, 'trend_agent', 'Running trend discovery agent')
      if (!creditCheck.success) {
        toast.error(creditCheck.message || t('dashboard.trendsTable.insufficientCredits'))
        return
      }
      
      toast.info(t('dashboard.trendsTable.usingCredits', { cost: CREDIT_COSTS.trend_agent }))
      
      setIsScrapingManually(true)
      setProgressMessage(t('dashboard.trendsTable.initializingAgent'))
      
      const response = await fetch('/api/trends/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userEmail: user?.email,
          selectedBrandId: selectedBrandId
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to start trend agent')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.message === 'COMPLETE' && data.data) {
                const result = data.data
                toast.success(
                  t('dashboard.trendsTable.agentCompleted', { inserted: result.inserted, updated: result.updated }),
                  { duration: 5000 }
                )
                
                window.dispatchEvent(new CustomEvent('refreshTrends'))
                fetchAgentStatus()
                setProgressMessage("")
              } else if (data.message === 'ERROR' && data.data) {
                throw new Error(data.data.error || 'Trend agent failed')
              } else {
                setProgressMessage(data.message)
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e)
            }
          }
        }
      }
    } catch (error: any) {
      toast.error(t('dashboard.trendsTable.agentFailed', { error: error.message }))
      console.error(error)
      setProgressMessage("")
    } finally {
      setIsScrapingManually(false)
    }
  }

  const handleAutoRun = () => {
    if (autoRunEnabled) {
      // Stop auto-run
      setAutoRunEnabled(false)
      setNextRunTime(null)
      localStorage.setItem('autoRunEnabled', 'false')
      localStorage.removeItem('nextRunTime')
      toast.info(t('dashboard.trendsTable.autoRunStopped'))
    } else {
      // Start auto-run
      setAutoRunEnabled(true)
      const now = new Date()
      const nextRun = new Date(now.getTime() + 3 * 60 * 60 * 1000) // 3 hours from now
      setNextRunTime(nextRun)
      localStorage.setItem('autoRunEnabled', 'true')
      localStorage.setItem('nextRunTime', nextRun.toISOString())
      
      // Run immediately
      handleManualScrape()
      toast.success(t('dashboard.trendsTable.autoRunStarted'))
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <ChatLayout>
      <SidebarProvider>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col">
            <div className="@container/main flex flex-1 flex-col gap-2">
              <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                <SectionCards 
                  selectedBrandId={selectedBrandId} 
                  onLoadComplete={() => setStatsLoading(false)}
                />
                <div className="px-4 lg:px-6 space-y-4">
                  <ChartAreaInteractive 
                    selectedBrandId={selectedBrandId} 
                    onLoadComplete={() => setChartLoading(false)}
                  />
                  {selectedBrandId && (
                    <RevenueMetrics brandId={parseInt(selectedBrandId)} />
                  )}
                </div>
                <div className="px-4 lg:px-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-xl font-medium">
                        {activeTab === 'trends' && t('dashboard.trendsTable.title.trends')}
                        {activeTab === 'catalog' && t('dashboard.trendsTable.title.catalog')}
                        {activeTab === 'inventory' && t('dashboard.trendsTable.title.inventory')}
                        {activeTab === 'campaigns' && t('dashboard.trendsTable.title.campaigns')}
                      </h1>
                      <p className="text-sm text-muted-foreground">
                        {activeTab === 'trends' && t('dashboard.trendsTable.description.trends')}
                        {activeTab === 'catalog' && t('dashboard.trendsTable.description.catalog')}
                        {activeTab === 'inventory' && t('dashboard.trendsTable.description.inventory')}
                        {activeTab === 'campaigns' && t('dashboard.trendsTable.description.campaigns')}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Status Indicators */}
                      <div className="flex items-center gap-3 text-sm">
                        {agentStatus.totalTrends !== undefined && (
                          <Badge variant="outline" className="gap-1">
                            <Database className="h-3 w-3" />
                            {agentStatus.totalTrends} {t('dashboard.trends')}
                          </Badge>
                        )}
                        {catalogIntegrated && productCount > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <Database className="h-3 w-3" />
                            {productCount} Products
                          </Badge>
                        )}
                        {recommendationCount > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <Lightbulb className="h-3 w-3" />
                            {recommendationCount} Actions
                          </Badge>
                        )}
                        {campaignCount > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <RocketIcon className="h-3 w-3" />
                            {campaignCount} Campaigns
                          </Badge>
                        )}
                        {autoRunEnabled && countdown && activeTab === 'trends' && (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" />
                            {t('dashboard.trendsTable.nextRun')} {countdown}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      {activeTab === 'trends' && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleManualScrape}
                          disabled={isScrapingManually}
                        >
                          {isScrapingManually ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t('dashboard.trendsTable.running')}
                            </>
                          ) : (
                            t('dashboard.trendsTable.runTrendAgent')
                          )}
                        </Button>
                        <Button
                          variant={autoRunEnabled ? "destructive" : "default"}
                          size="sm"
                          onClick={handleAutoRun}
                        >
                          {autoRunEnabled ? (
                            <>
                              <StopCircle className="mr-2 h-4 w-4" />
                              {t('dashboard.trendsTable.stopAutoRun')}
                            </>
                          ) : (
                            <>
                              <PlayCircle className="mr-2 h-4 w-4" />
                              {t('dashboard.trendsTable.startAutoRun')}
                            </>
                          )}
                        </Button>
                      </div>
                      )}
                    </div>
                  </div>
                  
                  <DataTableTrends 
                    onTabChange={setActiveTab} 
                    session={session}
                    trendAgentGenerating={isScrapingManually}
                    trendAgentProgress={progressMessage}
                  />
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ChatLayout>
  )
}

