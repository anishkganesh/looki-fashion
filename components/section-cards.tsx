"use client"

import { TrendingDownIcon, TrendingUpIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useContextMenu } from "@/hooks/use-context-menu"

export function SectionCards() {
  // Create context menu hooks for each card
  const trendingProductsContext = useContextMenu({
    data: { 
      metric: 'Trending Products',
      value: 32,
      change: '+3 from last week',
      percentage: '+10.37%'
    },
    type: 'widget',
    description: 'Trending Products Metric'
  });

  const catalogMatchContext = useContextMenu({
    data: { 
      metric: 'Catalog Match Rate',
      value: '68%',
      change: '+2.5% from last week',
      percentage: '+3.81%'
    },
    type: 'widget',
    description: 'Catalog Match Rate Metric'
  });

  const trendConversionsContext = useContextMenu({
    data: { 
      metric: 'Trend Conversions',
      value: '$12,450',
      change: '$650 from last week',
      percentage: '+5.51%'
    },
    type: 'widget',
    description: 'Trend Conversions Metric'
  });

  const activeTrendsContext = useContextMenu({
    data: { 
      metric: 'Active Trends',
      value: 156,
      change: '-12 from last week',
      percentage: '-7.14%'
    },
    type: 'widget',
    description: 'Active Trends Metric'
  });

  return (
    <>
      <div className="*:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card lg:px-6">
        <Card className="@container/card" ref={trendingProductsContext.ref as any}>
          <CardHeader className="relative">
            <CardDescription>Trending Products</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">32</CardTitle>
            <div className="absolute right-4 top-2 flex text-primary">
              <TrendingUpIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <span className="text-muted-foreground">+3 from last week</span>
            <span className="font-medium">+10.37%</span>
          </CardFooter>
        </Card>
        <Card className="@container/card" ref={catalogMatchContext.ref as any}>
          <CardHeader className="relative">
            <CardDescription>Catalog Match Rate</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">68%</CardTitle>
            <div className="absolute right-4 top-2 flex text-primary">
              <TrendingUpIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <span className="text-muted-foreground">+2.5% from last week</span>
            <span className="font-medium">+3.81%</span>
          </CardFooter>
        </Card>
        <Card className="@container/card" ref={trendConversionsContext.ref as any}>
          <CardHeader className="relative">
            <CardDescription>Trend Conversions</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">$12,450</CardTitle>
            <div className="absolute right-4 top-2 flex text-primary">
              <TrendingUpIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <span className="text-muted-foreground">$650 from last week</span>
            <span className="font-medium">+5.51%</span>
          </CardFooter>
        </Card>
        <Card className="@container/card" ref={activeTrendsContext.ref as any}>
          <CardHeader className="relative">
            <CardDescription>Active Trends</CardDescription>
            <CardTitle className="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">156</CardTitle>
            <div className="absolute right-4 top-2 flex text-destructive">
              <TrendingDownIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1 text-sm">
            <span className="text-muted-foreground">-12 from last week</span>
            <span className="font-medium text-destructive">-7.14%</span>
          </CardFooter>
        </Card>
      </div>
      
      {/* Render tooltips */}
      {trendingProductsContext.tooltip}
      {catalogMatchContext.tooltip}
      {trendConversionsContext.tooltip}
      {activeTrendsContext.tooltip}
    </>
  )
}
