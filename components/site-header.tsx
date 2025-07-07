"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2 } from "lucide-react"
import * as React from "react"
import { supabase } from "@/lib/supabase"
import { useRequireAuth } from "@/lib/auth-utils"
import { LanguageSwitcher } from "@/components/language-switcher"
import { useTranslation } from 'react-i18next'

export function SiteHeader() {
  const { user, session } = useRequireAuth()
  const { t } = useTranslation()
  const [selectedBrandId, setSelectedBrandId] = React.useState<string>("")
  const [availableBrands] = React.useState<{id: string, name: string}[]>([
    { id: "1", name: "Arvind Fashions" },
    { id: "2", name: "Cris Barros" },
    { id: "5", name: "Walmart" },
    { id: "6", name: "Zara" },
    { id: "7", name: "Track & Field" },
    { id: "13", name: "Marisa Lojas" }
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
    
    // Get brand details for AI context
    const selectedBrandName = availableBrands.find(b => b.id === value)?.name
    
    // Persist the selection
    if (session?.user?.email && selectedBrandName) {
      await fetch('/api/profile/update-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: session.user.email,
          selectedBrand: selectedBrandName
        })
      })
    }
    
    // Emit event for other components to refetch data
    window.dispatchEvent(new CustomEvent('brandChanged', { 
      detail: { brandId: value, brandName: selectedBrandName } 
    }))
    
    // Update AI context immediately
    try {
      const { data: brandData } = await supabase
        .from('brands')
        .select('*')
        .eq('brand_id', parseInt(value))
        .single()
      
      if (brandData) {
        window.dispatchEvent(new CustomEvent('brandContextChanged', {
          detail: { brand: brandData }
        }))
      }
    } catch (error) {
      console.error('Error fetching brand data for AI context:', error)
    }
  }

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <SidebarTrigger />
      <div className="flex items-center gap-4 flex-1">
        <h1 className="text-base font-medium">{t('navigation.lookiTitle')}</h1>
        
        {/* Brand Selector */}
        <div className="ml-auto flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedBrandId} onValueChange={handleBrandChange}>
            <SelectTrigger className="w-[180px] font-medium">
              <SelectValue placeholder={t('navigation.brandSelector')} />
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
        
        {/* Language Switcher */}
        <LanguageSwitcher />
      </div>
    </header>
  )
}
