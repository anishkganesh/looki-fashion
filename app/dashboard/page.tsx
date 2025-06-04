"use client"

import { AppSidebar } from "../../components/app-sidebar"
import { ChartAreaInteractive } from "../../components/chart-area-interactive"
import { DataTableTrends } from "../../components/data-table-trends"
import { SectionCards } from "../../components/section-cards"
import { SiteHeader } from "../../components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ChatLayout } from "@/components/chat-layout"
import { useRequireAuth } from "@/lib/auth-utils"
import { Loader2, Clock, Database, StopCircle, PlayCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"

export default function DashboardPage() {
  const { user, session, isLoading } = useRequireAuth()
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
  const [activeTab, setActiveTab] = useState<'trends' | 'catalog' | 'inventory' | 'forecast'>('trends')

  // Check catalog integration status
  useEffect(() => {
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
        }
      } catch (error) {
        console.error('Error checking catalog status:', error)
      }
    }
    
    checkCatalogStatus()
  }, [user])

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
      setIsScrapingManually(true)
      setProgressMessage("Initializing trend agent...")
      
      const response = await fetch('/api/trends/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || ''}`
        }
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
                  `Trend agent completed! Found ${result.inserted} new trends and updated ${result.updated} existing trends.`,
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
      toast.error('Failed to run trend agent: ' + error.message)
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
      toast.info('Auto-run stopped')
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
      toast.success('Auto-run started! Next run in 3 hours.')
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
                <SectionCards />
                <div className="px-4 lg:px-6">
                  <ChartAreaInteractive />
                </div>
                <div className="px-4 lg:px-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h1 className="text-2xl font-semibold">
                        {activeTab === 'trends' && 'Live Fashion Trends'}
                        {activeTab === 'catalog' && 'Catalog Matches'}
                        {activeTab === 'inventory' && 'Inventory Actions'}
                        {activeTab === 'forecast' && 'Trend Forecasts'}
                      </h1>
                      <p className="text-sm text-muted-foreground">
                        {activeTab === 'trends' && 'Real-time fashion trend analysis from global sources'}
                        {activeTab === 'catalog' && 'Your integrated product catalog with trend analysis'}
                        {activeTab === 'inventory' && 'Recommended inventory actions based on trends'}
                        {activeTab === 'forecast' && 'AI-powered trend predictions and forecasts'}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Status Indicators */}
                      <div className="flex items-center gap-3 text-sm">
                        {agentStatus.totalTrends !== undefined && (activeTab === 'trends' || activeTab === 'forecast') && (
                          <Badge variant="outline" className="gap-1">
                            <Database className="h-3 w-3" />
                            {agentStatus.totalTrends} trends
                          </Badge>
                        )}
                        {autoRunEnabled && countdown && (activeTab === 'trends' || activeTab === 'forecast') && (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" />
                            Next run: {countdown}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      {(activeTab === 'trends' || activeTab === 'forecast') && (
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
                              Running...
                            </>
                          ) : (
                            'Run Trend Agent'
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
                              Stop Auto-Run
                            </>
                          ) : (
                            <>
                              <PlayCircle className="mr-2 h-4 w-4" />
                              Start Auto-Run Agent
                            </>
                          )}
                        </Button>
                      </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Progress Message */}
                  {progressMessage && (activeTab === 'trends' || activeTab === 'forecast') && (
                    <div className="text-sm text-muted-foreground animate-pulse">
                      {progressMessage}
                    </div>
                  )}
                  
                  <DataTableTrends onTabChange={setActiveTab} session={session} />
                </div>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ChatLayout>
  )
}

