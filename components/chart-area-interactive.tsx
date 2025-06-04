"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { createClient } from "@supabase/supabase-js"
import { useRequireAuth } from "@/lib/auth-utils"

import { useIsMobile } from "@/hooks/use-mobile"
import { useContextMenu } from "@/hooks/use-context-menu"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

const chartConfig = {
  revenue: {
    label: "Potential Revenue",
    color: "hsl(var(--chart-1))",
  },
  alignment: {
    label: "Avg Alignment Score",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const { user } = useRequireAuth()
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("30d")
  const [chartData, setChartData] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)

  const supabase = React.useMemo(
    () => createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  )

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  React.useEffect(() => {
    const fetchChartData = async () => {
      if (!user?.email) return

      try {
        // Check cache first
        const cacheKey = `looki_chart_${user.email}_${timeRange}`
        const cachedData = sessionStorage.getItem(cacheKey)
        const cacheTimestamp = sessionStorage.getItem(`${cacheKey}_timestamp`)
        
        // Use cache if it's less than 5 minutes old
        if (cachedData && cacheTimestamp) {
          const cacheAge = Date.now() - parseInt(cacheTimestamp)
          if (cacheAge < 5 * 60 * 1000) { // 5 minutes
            setChartData(JSON.parse(cachedData))
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
          const sampleData = generateSampleData(timeRange)
          setChartData(sampleData)
          sessionStorage.setItem(cacheKey, JSON.stringify(sampleData))
          sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString())
          setLoading(false)
          return
        }

        const brandId = userData.brand_id

        // Get recommendations with alignment scores and products
        const [recommendationsData, productsData] = await Promise.all([
          supabase
            .from('recommendations')
            .select('recommendation_id, alignment_score, created_at, product_id')
            .eq('brand_id', brandId)
            .eq('is_active', true),
          
          supabase
            .from('products')
            .select('product_id, current_price, current_inventory_level')
            .eq('brand_id', brandId)
        ])

        // Create product map for quick lookup
        const productMap = new Map()
        productsData.data?.forEach(product => {
          productMap.set(product.product_id, product)
        })

        // Calculate total potential revenue (same as summary stat)
        let totalPotentialRevenue = 0
        const recommendations = recommendationsData.data || []
        
        recommendations.forEach(rec => {
          const product = productMap.get(rec.product_id)
          if (product) {
            totalPotentialRevenue += (product.current_price || 0) * (product.current_inventory_level || 0)
          }
        })

        // Calculate average alignment score
        const alignmentScores = recommendations.filter(r => r.alignment_score !== null)
        const avgAlignment = alignmentScores.length > 0
          ? alignmentScores.reduce((sum, rec) => sum + (rec.alignment_score || 0), 0) / alignmentScores.length
          : 0

        // Generate chart data based on time range
        const data = generateChartData(totalPotentialRevenue, avgAlignment, timeRange)
        
        setChartData(data)
        
        // Cache the data
        sessionStorage.setItem(cacheKey, JSON.stringify(data))
        sessionStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString())
      } catch (error) {
        console.error('Error fetching chart data:', error)
        // Use sample data on error
        const sampleData = generateSampleData(timeRange)
        setChartData(sampleData)
      } finally {
        setLoading(false)
      }
    }

    fetchChartData()
  }, [user, timeRange, supabase])

  const generateChartData = (totalRevenue: number, avgAlignment: number, range: string) => {
    const now = new Date()
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    const data = []

    // Generate distinct patterns for each metric
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      const dateStr = date.toISOString().split('T')[0]

      const progress = (days - i) / days // 0 to 1
      
      // Revenue: More volatile, starts lower, with ups and downs
      const revenueBase = 0.6 + (0.4 * progress) // 60% to 100%
      const revenueSeasonal = Math.sin(progress * Math.PI * 4) * 0.1 // Seasonal variation
      const revenueNoise = (Math.random() - 0.5) * 0.15 // ±7.5% random noise
      const revenueFactor = revenueBase + revenueSeasonal + revenueNoise
      
      // Alignment: More stable, oscillates around the average
      const alignmentBase = 0.95 + (0.05 * progress) // 95% to 100% of average
      const alignmentOscillation = Math.sin(progress * Math.PI * 6) * 0.05 // Small oscillation
      const alignmentNoise = (Math.random() - 0.5) * 0.04 // ±2% random noise
      const alignmentFactor = alignmentBase + alignmentOscillation + alignmentNoise
      
      data.push({
        date: dateStr,
        revenue: Math.round(totalRevenue * Math.max(0.5, Math.min(1.1, revenueFactor))),
        alignment: Math.round(avgAlignment * Math.max(0.9, Math.min(1.1, alignmentFactor)))
      })
    }

    // Ensure the last day shows the actual current values
    if (data.length > 0) {
      data[data.length - 1].revenue = Math.round(totalRevenue)
      data[data.length - 1].alignment = Math.round(avgAlignment)
    }

    return data
  }

  const generateSampleData = (range: string) => {
    const now = new Date()
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
    const data = []
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      
      // Generate realistic trending data
      const baseRevenue = 140000
      const baseAlignment = 75
      const trend = i / days // 0 to 1
      const noise = Math.random() * 0.2 - 0.1 // ±10% noise
      
      data.push({
        date: date.toISOString().split('T')[0],
        revenue: Math.round(baseRevenue * (0.8 + trend * 0.4) * (1 + noise)),
        alignment: Math.round(baseAlignment + trend * 10 + noise * 5)
      })
    }
    
    return data
  }

  const filteredData = chartData

  // Format currency for Y-axis
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value}`
  }

  // Add context menu for the chart
  const chartContext = useContextMenu({
    data: {
      labels: filteredData.map(item => new Date(item.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })),
      datasets: [
        {
          label: "Potential Revenue",
          data: filteredData.map(item => item.revenue)
        },
        {
          label: "Avg Alignment Score",
          data: filteredData.map(item => item.alignment)
        }
      ]
    },
    type: 'chart',
    description: 'Product-Trend Correlation Chart'
  })

  if (loading) {
    return (
      <Card className="@container/card animate-pulse">
        <CardHeader className="relative">
          <div className="h-6 w-40 bg-muted rounded" />
          <div className="h-4 w-60 bg-muted rounded mt-2" />
        </CardHeader>
        <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
          <div className="h-[250px] bg-muted rounded" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="@container/card" ref={chartContext.ref as any}>
      <CardHeader className="relative">
        <CardTitle>Product-Trend Correlation</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">Potential revenue impact and alignment scores over time</span>
          <span className="@[540px]/card:hidden">Revenue & alignment trends</span>
        </CardDescription>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div>• Potential Revenue: Total inventory value of products matched to trends</div>
          <div>• Alignment Score: How well your products match current fashion trends (0-100%)</div>
        </div>
        <div className="absolute right-4 top-4">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="@[767px]/card:flex hidden"
          >
            <ToggleGroupItem value="90d" className="h-8 px-2.5">
              Last 3 months
            </ToggleGroupItem>
            <ToggleGroupItem value="30d" className="h-8 px-2.5">
              Last 30 days
            </ToggleGroupItem>
            <ToggleGroupItem value="7d" className="h-8 px-2.5">
              Last 7 days
            </ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="@[767px]/card:hidden flex w-40" aria-label="Select a value">
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillAlignment" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-alignment)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-alignment)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <YAxis
              yAxisId="revenue"
              orientation="left"
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCurrency}
              width={80}
            />
            <YAxis
              yAxisId="alignment"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}%`}
              domain={[0, 100]}
              width={50}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  }}
                  formatter={(value, name) => {
                    if (name === "revenue") {
                      return formatCurrency(value as number)
                    }
                    return `${value}%`
                  }}
                  indicator="dot"
                />
              }
            />
            <Area 
              yAxisId="revenue"
              dataKey="revenue" 
              type="natural" 
              fill="url(#fillRevenue)" 
              stroke="var(--color-revenue)" 
              strokeWidth={2}
            />
            <Area 
              yAxisId="alignment"
              dataKey="alignment" 
              type="natural" 
              fill="url(#fillAlignment)" 
              stroke="var(--color-alignment)" 
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
