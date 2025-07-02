"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2 } from "lucide-react"
import * as React from "react"
import { supabase } from "@/lib/supabase"
import { useRequireAuth } from "@/lib/auth-utils"

export function SiteHeader() {
  const { user, session } = useRequireAuth()
  const [selectedBrandId, setSelectedBrandId] = React.useState<string>("")
  const [availableBrands] = React.useState<{id: string, name: string}[]>([
    { id: "1", name: "Arvind Fashions" },
    { id: "2", name: "KENZO" },
    { id: "3", name: "GANT" },
    { id: "4", name: "Marisa Lojas" },
    { id: "5", name: "Walmart" }
  ])
  
  // Load saved brand on mount
  React.useEffect(() => {
    const loadSavedBrand = async () => {
      if (!user?.email) return
      
      const { data: userData } = await supabase
        .from('usr')
        .select('brand_id, selected_brand')
        .eq('email', user.email)
        .single()
      
      if (userData?.selected_brand) {
        const savedBrand = availableBrands.find(b => b.name === userData.selected_brand)
        if (savedBrand) {
          setSelectedBrandId(savedBrand.id)
        } else if (userData.brand_id) {
          setSelectedBrandId(userData.brand_id.toString())
        }
      } else if (userData?.brand_id) {
        setSelectedBrandId(userData.brand_id.toString())
      }
    }
    
    loadSavedBrand()
  }, [user, availableBrands])
  
  // Handle brand change
  const handleBrandChange = async (value: string) => {
    setSelectedBrandId(value)
    
    // Persist the selection
    if (session?.user?.email) {
      const selectedBrandName = availableBrands.find(b => b.id === value)?.name
      if (selectedBrandName) {
        await fetch('/api/profile/update-brand', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userEmail: session.user.email,
            selectedBrand: selectedBrandName
          })
        })
      }
    }
    
    // Emit event for other components
    window.dispatchEvent(new CustomEvent('brandChanged', { 
      detail: { brandId: value, brandName: availableBrands.find(b => b.id === value)?.name } 
    }))
    
    // Reload the page to refresh all data
    window.location.reload()
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <SidebarTrigger />
      <div className="flex items-center gap-4 flex-1">
        <h1 className="text-lg font-semibold">Looki Trend Intelligence</h1>
        
        {/* Brand Selector */}
        <div className="ml-auto flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedBrandId} onValueChange={handleBrandChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Brand" />
            </SelectTrigger>
            <SelectContent>
              {availableBrands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </header>
  )
}
