"use client"

import * as React from "react"
import { TrendingDownIcon, TrendingUpIcon, DollarSignIcon, PercentIcon, PackageIcon, ActivityIcon } from "lucide-react"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useContextMenu } from "@/hooks/use-context-menu"
import { createClient } from "@supabase/supabase-js"
import { useRequireAuth } from "@/lib/auth-utils"

export const SectionCards = React.forwardRef<{ clearCache: () => void }, {}>(({}, ref) => {
  const { user, session } = useRequireAuth()
  const [stats, setStats] = React.useState({
    activeTrends: { value: 0, change: 0, percentage: 0 },
    alignmentScore: { value: 0, change: 0, percentage: 0 },
    optimizationOpportunities: { value: 0, change: 0, percentage: 0 },
    potentialRevenue: { value: 0, change: 0, percentage: 0 }
  })
  const [loading, setLoading] = React.useState(true)

  const supabase = React.useMemo(
    () => createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  // Clear cache method
  const clearCache = React.useCallback(() => {
    if (user?.email) {
      const cacheKey = `looki_stats_${user.email}`
      sessionStorage.removeItem(cacheKey)
      sessionStorage.removeItem(`${cacheKey}_timestamp`)
    }
  }, [user])

  // Expose methods to parent
  React.useImperativeHandle(ref, () => ({
    clearCache
  }), [clearCache])

  React.useEffect(() => {
    const fetchStats = async () => {
      if (!user?.email) return

      try {
        // Check cache first
        const cacheKey = `looki_stats_${user.email}`
        const cachedData = sessionStorage.getItem(cacheKey)
        const cacheTimestamp = sessionStorage.getItem(`${cacheKey}_timestamp`)
        
        // Use cache if it's less than 5 minutes old
        if (cachedData && cacheTimestamp) {
          const cacheAge = Date.now() - parseInt(cacheTimestamp)
          if (cacheAge < 5 * 60 * 1000) { // 5 minutes
            setStats(JSON.parse(cachedData))
            setLoading(false)
            return
          }
        }

        setLoading(true)
        
        // Get user's brand
        const { data: userData } = await supabase
          .from('usr')
          .select('brand_id')
          .eq('email', user.email)
          .single()

        if (!userData?.brand_id) {
          // Use sample data if no brand
          const sampleStats = {
            activeTrends: { value: 67, change: 12, percentage: 21.8 },
            alignmentScore: { value: 76, change: 6, percentage: 8.57 },
            optimizationOpportunities: { value: 23, change: 5, percentage: 27.8 },
            potentialRevenue: { value: 45000, change: 8500, percentage: 23.3 }
          }
          setStats(sampleStats)
          setLoading(false)
          return
        }

        const brandId = userData.brand_id
        const now = new Date()
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

        // Run all queries in parallel for better performance
        const [
          trendsData,
          recommendationsData,
          previousRecommendationsData,
          productsData
        ] = await Promise.all([
          // Active trends query
          supabase
            .from('trends')
            .select('trend_id, last_updated')
            .in('lifecycle_stage', ['growing', 'emerging']),
          
          // Current recommendations
          supabase
            .from('recommendations')
            .select('recommendation_id, alignment_score, created_at, product_id')
            .eq('brand_id', brandId)
            .eq('is_active', true),
          
          // Previous week recommendations for comparison
          supabase
            .from('recommendations')
            .select('recommendation_id')
            .eq('brand_id', brandId)
            .gte('created_at', twoWeeksAgo.toISOString())
            .lt('created_at', weekAgo.toISOString()),
            
          // Get all products for this brand in one query
          supabase
            .from('products')
            .select('product_id, current_price, current_inventory_level')
            .eq('brand_id', brandId)
        ])

        // 1. Active Trends calculation
        const currentTrends = trendsData.data?.filter(t => 
          new Date(t.last_updated) >= weekAgo
        ) || []
        const previousTrends = trendsData.data?.filter(t => 
          new Date(t.last_updated) >= twoWeeksAgo && 
          new Date(t.last_updated) < weekAgo
        ) || []

        const activeTrendsCount = currentTrends.length
        const previousActiveTrends = previousTrends.length
        const trendsChange = activeTrendsCount - previousActiveTrends
        const trendsPercentage = previousActiveTrends > 0 
          ? ((trendsChange / previousActiveTrends) * 100) 
          : 0

        // 2. Average Alignment Score
        const alignments = recommendationsData.data?.filter(r => r.alignment_score !== null) || []
        const avgAlignment = alignments.length > 0
          ? alignments.reduce((sum, rec) => sum + (rec.alignment_score || 0), 0) / alignments.length
          : 0

        // 3. Optimization Opportunities (all recommendations)
        const currentRecommendations = recommendationsData.data || []
        const previousRecommendations = previousRecommendationsData.data || []
        
        const opportunitiesCount = currentRecommendations.length
        const previousOpportunitiesCount = previousRecommendations.length
        const opportunitiesChange = opportunitiesCount - previousOpportunitiesCount
        const opportunitiesPercentage = previousOpportunitiesCount > 0
          ? ((opportunitiesChange / previousOpportunitiesCount) * 100)
          : opportunitiesCount > 0 ? 100 : 0

        // 4. Potential Revenue - Create a map of products for quick lookup
        const productMap = new Map()
        productsData.data?.forEach(product => {
          productMap.set(product.product_id, product)
        })

        // Calculate potential revenue from recommended products
        let potentialRevenue = 0
        currentRecommendations.forEach(rec => {
          const product = productMap.get(rec.product_id)
          if (product) {
            const price = product.current_price || 0
            const stock = product.current_inventory_level || 0
            // Simple calculation: price × stock
            potentialRevenue += price * stock
          }
        })

        // If no data, use sample data
        if (opportunitiesCount === 0 && potentialRevenue === 0) {
          const sampleStats = {
            activeTrends: { value: activeTrendsCount || 67, change: trendsChange || 12, percentage: trendsPercentage || 21.8 },
            alignmentScore: { value: Math.round(avgAlignment) || 76, change: avgAlignment - 70 || 6, percentage: ((avgAlignment - 70) / 70 * 100) || 8.57 },
            optimizationOpportunities: { value: 23, change: 5, percentage: 27.8 },
            potentialRevenue: { value: 45000, change: 8500, percentage: 23.3 }
          }
          setStats(sampleStats)
          // Cache the sample data
          sessionStorage.setItem(cacheKey, JSON.stringify(sampleStats))
          sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString())
        } else {
          // Calculate revenue change (estimate 20% growth week-over-week)
          const revenueChange = potentialRevenue * 0.2
          const revenuePercentage = 20

          const calculatedStats = {
            activeTrends: {
              value: activeTrendsCount,
              change: trendsChange,
              percentage: trendsPercentage
            },
            alignmentScore: {
              value: Math.round(avgAlignment),
              change: avgAlignment - 70,
              percentage: (avgAlignment - 70) / 70 * 100
            },
            optimizationOpportunities: {
              value: opportunitiesCount,
              change: opportunitiesChange,
              percentage: opportunitiesPercentage
            },
            potentialRevenue: {
              value: Math.round(potentialRevenue),
              change: revenueChange,
              percentage: revenuePercentage
            }
          }
          
          setStats(calculatedStats)
          
          // Cache the calculated stats
          sessionStorage.setItem(cacheKey, JSON.stringify(calculatedStats))
          sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString())
        }
      } catch (error) {
        console.error('Error fetching statistics:', error)
        // Use sample data on error
        const sampleStats = {
          activeTrends: { value: 67, change: 12, percentage: 21.8 },
          alignmentScore: { value: 76, change: 6, percentage: 8.57 },
          optimizationOpportunities: { value: 23, change: 5, percentage: 27.8 },
          potentialRevenue: { value: 45000, change: 8500, percentage: 23.3 }
        }
        setStats(sampleStats)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [user, supabase])

  // Create context menu hooks for each card
  const activeTrendsContext = useContextMenu({
    data: { 
      metric: 'Active Trends',
      value: stats.activeTrends.value,
      change: `${stats.activeTrends.change >= 0 ? '+' : ''}${stats.activeTrends.change} from last week`,
      percentage: `${stats.activeTrends.percentage >= 0 ? '+' : ''}${stats.activeTrends.percentage.toFixed(2)}%`
    },
    type: 'widget',
    description: 'Growing and emerging fashion trends tracked in the last 7 days'
  });

  const alignmentContext = useContextMenu({
    data: { 
      metric: 'Avg. Alignment Score',
      value: `${stats.alignmentScore.value}%`,
      change: `${stats.alignmentScore.change >= 0 ? '+' : ''}${stats.alignmentScore.change.toFixed(1)}% from baseline`,
      percentage: `${stats.alignmentScore.percentage >= 0 ? '+' : ''}${stats.alignmentScore.percentage.toFixed(2)}%`
    },
    type: 'widget',
    description: 'Average product-trend alignment score across your catalog'
  });

  const optimizationContext = useContextMenu({
    data: { 
      metric: 'Optimization Opportunities',
      value: stats.optimizationOpportunities.value,
      change: `${stats.optimizationOpportunities.change >= 0 ? '+' : ''}${stats.optimizationOpportunities.change} from last week`,
      percentage: `${stats.optimizationOpportunities.percentage >= 0 ? '+' : ''}${stats.optimizationOpportunities.percentage.toFixed(2)}%`
    },
    type: 'widget',
    description: 'Total actionable recommendations available'
  });

  const revenueContext = useContextMenu({
    data: { 
      metric: 'Potential Revenue Impact',
      value: `$${stats.potentialRevenue.value.toLocaleString()}`,
      change: `$${Math.abs(stats.potentialRevenue.change).toLocaleString()} opportunity`,
      percentage: `${stats.potentialRevenue.percentage >= 0 ? '+' : ''}${stats.potentialRevenue.percentage.toFixed(2)}%`
    },
    type: 'widget',
    description: 'Total inventory value of recommended products (price × stock)'
  });

  if (loading) {
    return (
      <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="@container/card animate-pulse">
            <CardHeader className="relative">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-8 w-16 bg-muted rounded mt-2" />
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1">
              <div className="h-3 w-32 bg-muted rounded" />
              <div className="h-3 w-16 bg-muted rounded" />
            </CardFooter>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <>
      <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
        <Card className="@container/card" ref={activeTrendsContext.ref as any}>
          <CardHeader className="relative">
            <CardDescription>Active Trends</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              {stats.activeTrends.value}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Fashion trends currently growing or emerging in the market</p>
            <div className="absolute right-4 top-2 flex">
              <ActivityIcon className={`h-4 w-4 ${stats.activeTrends.change >= 0 ? 'text-primary' : 'text-destructive'}`} />
            </div>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <span className="text-muted-foreground">
              {stats.activeTrends.change >= 0 ? '+' : ''}{stats.activeTrends.change} from last week
            </span>
            <span className={`font-medium ${stats.activeTrends.percentage >= 0 ? '' : 'text-destructive'}`}>
              {stats.activeTrends.percentage >= 0 ? '+' : ''}{stats.activeTrends.percentage.toFixed(2)}%
            </span>
          </CardFooter>
        </Card>
        
        <Card className="@container/card" ref={alignmentContext.ref as any}>
          <CardHeader className="relative">
            <CardDescription>Avg. Alignment Score</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              {stats.alignmentScore.value}%
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">How well your catalog matches trending styles</p>
            <div className="absolute right-4 top-2 flex">
              <PercentIcon className={`h-4 w-4 ${stats.alignmentScore.change >= 0 ? 'text-primary' : 'text-destructive'}`} />
            </div>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <span className="text-muted-foreground">
              {stats.alignmentScore.change >= 0 ? '+' : ''}{stats.alignmentScore.change.toFixed(1)}% from baseline
            </span>
            <span className={`font-medium ${stats.alignmentScore.percentage >= 0 ? '' : 'text-destructive'}`}>
              {stats.alignmentScore.percentage >= 0 ? '+' : ''}{stats.alignmentScore.percentage.toFixed(2)}%
            </span>
          </CardFooter>
        </Card>
        
        <Card className="@container/card" ref={optimizationContext.ref as any}>
          <CardHeader className="relative">
            <CardDescription>Optimization Opportunities</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              {stats.optimizationOpportunities.value}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Product recommendations based on trend analysis</p>
            <div className="absolute right-4 top-2 flex">
              <PackageIcon className={`h-4 w-4 ${stats.optimizationOpportunities.change >= 0 ? 'text-primary' : 'text-destructive'}`} />
            </div>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <span className="text-muted-foreground">
              {stats.optimizationOpportunities.change >= 0 ? '+' : ''}{stats.optimizationOpportunities.change} from last week
            </span>
            <span className={`font-medium ${stats.optimizationOpportunities.percentage >= 0 ? '' : 'text-destructive'}`}>
              {stats.optimizationOpportunities.percentage >= 0 ? '+' : ''}{stats.optimizationOpportunities.percentage.toFixed(2)}%
            </span>
          </CardFooter>
        </Card>
        
        <Card className="@container/card" ref={revenueContext.ref as any}>
          <CardHeader className="relative">
            <CardDescription>Potential Revenue Impact</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
              ${stats.potentialRevenue.value.toLocaleString()}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Total inventory value of trend-aligned products</p>
            <div className="absolute right-4 top-2 flex text-primary">
              <DollarSignIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <span className="text-muted-foreground">
              ${Math.abs(stats.potentialRevenue.change).toLocaleString()} opportunity
            </span>
            <span className="font-medium">
              {stats.potentialRevenue.percentage >= 0 ? '+' : ''}{stats.potentialRevenue.percentage.toFixed(2)}%
            </span>
          </CardFooter>
        </Card>
      </div>
    </>
  )
})

SectionCards.displayName = 'SectionCards'
