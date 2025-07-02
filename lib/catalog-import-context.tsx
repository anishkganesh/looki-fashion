"use client"

import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

interface ImportProgress {
  id: number
  brand_id: number
  import_type: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'paused'
  total_products: number
  processed_products: number
  successful_products: number
  failed_products: number
  enriched_products: number
  current_page: number
  last_processed_sku?: string
  error_message?: string
  started_at: string
  completed_at?: string
  updated_at: string
  metadata?: any
}

interface CatalogImportContextType {
  importProgress: ImportProgress | null
  setImportProgress: (progress: ImportProgress | null) => void
  startImport: (brandId: number, importType?: string) => Promise<ImportProgress>
  checkActiveImport: (brandId: number) => Promise<ImportProgress | null>
  pauseImport: () => Promise<void>
  stopImport: () => Promise<void>
  resumeImport: () => Promise<void>
  hideProgress: () => void
}

const CatalogImportContext = createContext<CatalogImportContextType | undefined>(undefined)

export function CatalogImportProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)

  // Check for active imports on mount and when user changes
  useEffect(() => {
    if (user) {
      checkForActiveImports()
    }
  }, [user])

  const checkForActiveImports = async () => {
    if (!user) return

    try {
      // Get user's brand
      const { data: userData } = await supabase
        .from('usr')
        .select('brand_id')
        .eq('email', user.email!)
        .single()

      if (userData?.brand_id) {
        const activeImport = await checkActiveImport(userData.brand_id)
        if (activeImport) {
          setImportProgress(activeImport)
        }
      }
    } catch (error) {
      console.error('Error checking for active imports:', error)
    }
  }

  const checkActiveImport = async (brandId: number): Promise<ImportProgress | null> => {
    try {
      const { data, error } = await supabase
        .from('catalog_import_progress')
        .select('*')
        .eq('brand_id', brandId)
        .in('status', ['pending', 'processing', 'paused'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle() // Use maybeSingle instead of single to avoid errors when no rows

      if (error) {
        return null
      }

      return data as ImportProgress | null
    } catch (error) {
      console.error('Error checking active import:', error)
      return null
    }
  }

  const startImport = async (brandId: number, importType: string = 'marisa_api'): Promise<ImportProgress> => {
    // First check if there's already an active import
    const existingImport = await checkActiveImport(brandId)
    if (existingImport) {
      setImportProgress(existingImport)
      return existingImport
    }

    // Create new import progress record
    const { data, error } = await supabase
      .from('catalog_import_progress')
      .insert({
        brand_id: brandId,
        import_type: importType,
        status: 'pending',
        total_products: 0,
        processed_products: 0,
        successful_products: 0,
        failed_products: 0,
        enriched_products: 0,
        current_page: 0
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create import progress: ${error.message}`)
    }

    const newProgress = data as ImportProgress
    setImportProgress(newProgress)
    return newProgress
  }

  const pauseImport = async () => {
    if (!importProgress) return

    try {
      const response = await fetch('/api/catalog/import/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importProgressId: importProgress.id,
          action: 'pause'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to pause import')
      }

      setImportProgress({ ...importProgress, status: 'paused' })
    } catch (error) {
      console.error('Error pausing import:', error)
      throw error
    }
  }

  const stopImport = async () => {
    if (!importProgress) return

    try {
      const response = await fetch('/api/catalog/import/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importProgressId: importProgress.id,
          action: 'stop'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to stop import')
      }

      setImportProgress({ ...importProgress, status: 'failed', error_message: 'Import stopped by user' })
    } catch (error) {
      console.error('Error stopping import:', error)
      throw error
    }
  }

  const resumeImport = async () => {
    if (!importProgress) return

    try {
      const response = await fetch('/api/catalog/import/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importProgressId: importProgress.id,
          action: 'resume'
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resume import')
      }

      setImportProgress({ ...importProgress, status: 'processing' })
    } catch (error) {
      console.error('Error resuming import:', error)
      throw error
    }
  }

  const hideProgress = () => {
    setImportProgress(null)
  }

  return (
    <CatalogImportContext.Provider 
      value={{ 
        importProgress, 
        setImportProgress,
        startImport,
        checkActiveImport,
        pauseImport,
        stopImport,
        resumeImport,
        hideProgress
      }}
    >
      {children}
    </CatalogImportContext.Provider>
  )
}

export function useCatalogImport() {
  const context = useContext(CatalogImportContext)
  if (context === undefined) {
    throw new Error('useCatalogImport must be used within a CatalogImportProvider')
  }
  return context
}