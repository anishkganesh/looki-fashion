"use client"

import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { TrendingUpIcon, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRequireAuth } from "@/lib/auth-utils"

export function SiteHeader() {
  const { user } = useRequireAuth()
  const [catalogIntegrated, setCatalogIntegrated] = useState(false)
  const [productCount, setProductCount] = useState(0)

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

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <SidebarTrigger />
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Looki Trend Intelligence</h1>
        {catalogIntegrated && productCount > 0 && (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Catalog Integrated ({productCount} products)
          </Badge>
        )}
      </div>
    </header>
  )
}
