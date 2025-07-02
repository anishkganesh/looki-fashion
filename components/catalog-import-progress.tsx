"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { 
  X, 
  Minimize2, 
  Maximize2, 
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Pause,
  Play
} from "lucide-react"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { useCatalogImport } from "@/lib/catalog-import-context"

export function CatalogImportProgress() {
  const { importProgress, setImportProgress, hideProgress, pauseImport, stopImport, resumeImport } = useCatalogImport()
  const [isMinimized, setIsMinimized] = useState(false)
  const [isPolling, setIsPolling] = useState(false)
  const [isControlling, setIsControlling] = useState(false)

  useEffect(() => {
    if (!importProgress || importProgress.status === 'completed' || importProgress.status === 'failed') {
      setIsPolling(false)
      return
    }

    // Poll for updates every 2 seconds
    setIsPolling(true)
    const interval = setInterval(async () => {
      const { data, error } = await supabase
        .from('catalog_import_progress')
        .select('*')
        .eq('id', importProgress.id)
        .single()

      if (data && !error) {
        setImportProgress(data)
        
        // Stop polling if completed or failed
        if (data.status === 'completed' || data.status === 'failed') {
          setIsPolling(false)
        }
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [importProgress, setImportProgress])

  if (!importProgress) return null

  const progressPercentage = importProgress.total_products > 0
    ? Math.round((importProgress.processed_products / importProgress.total_products) * 100)
    : 0

  const getStatusIcon = () => {
    switch (importProgress.status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-500" />
      default:
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
    }
  }

  const getStatusText = () => {
    switch (importProgress.status) {
      case 'processing':
        const currentBatch = Math.ceil(importProgress.processed_products / 100) || 1
        const totalBatches = Math.ceil(importProgress.total_products / 100)
        return `Processing batch ${currentBatch} of ${totalBatches} (${importProgress.processed_products.toLocaleString()} / ${importProgress.total_products.toLocaleString()} products)`
      case 'completed':
        return `Import completed! ${importProgress.successful_products.toLocaleString()} products imported successfully`
      case 'failed':
        return `Import failed: ${importProgress.error_message || 'Unknown error'}`
      case 'paused':
        return 'Import paused'
      default:
        return 'Initializing import...'
    }
  }

  const getTimeEstimate = () => {
    if (importProgress.status !== 'processing') {
      return null
    }

    const processedCount = importProgress.processed_products
    const totalCount = importProgress.total_products

    if (processedCount === 0) return 'Calculating time remaining...'

    const elapsedMinutes = Math.floor((Date.now() - new Date(importProgress.started_at).getTime()) / 60000)
    const ratePerMinute = processedCount / Math.max(elapsedMinutes, 1)
    const remainingCount = totalCount - processedCount
    const remainingMinutes = Math.ceil(remainingCount / ratePerMinute)

    if (remainingMinutes < 60) {
      return `~${remainingMinutes} minutes remaining`
    } else {
      const hours = Math.floor(remainingMinutes / 60)
      const minutes = remainingMinutes % 60
      return `~${hours}h ${minutes}m remaining`
    }
  }

  const handlePause = async () => {
    setIsControlling(true)
    try {
      await pauseImport()
    } catch (error) {
      console.error('Failed to pause import:', error)
    } finally {
      setIsControlling(false)
    }
  }

  const handleStop = async () => {
    if (confirm('Are you sure you want to stop this import? This cannot be undone.')) {
      setIsControlling(true)
      try {
        await stopImport()
      } catch (error) {
        console.error('Failed to stop import:', error)
      } finally {
        setIsControlling(false)
      }
    }
  }

  const handleResume = async () => {
    setIsControlling(true)
    try {
      await resumeImport()
    } catch (error) {
      console.error('Failed to resume import:', error)
    } finally {
      setIsControlling(false)
    }
  }

  return (
    <div className={cn(
      "fixed bottom-4 right-4 z-50 transition-all duration-200",
      "max-w-sm w-full sm:w-96"
    )}
    style={{ bottom: '80px' }} // Position above chat
    >
      <Card className={cn(
        "shadow-lg border-2",
        isMinimized ? "h-14" : "h-auto"
      )}>
        <div className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-medium text-sm">Catalog Import</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsMinimized(!isMinimized)}
              >
                {isMinimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
              </Button>
              {(importProgress.status === 'completed' || importProgress.status === 'failed') && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={hideProgress}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {getStatusText()}
                  </p>
                  {getTimeEstimate() && (
                    <p className="text-xs text-muted-foreground">
                      {getTimeEstimate()}
                    </p>
                  )}
                </div>

                <Progress value={progressPercentage} className="h-2" />

                {/* Statistics */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Processed</span>
                    <span className="font-medium">
                      {importProgress.processed_products.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Successful</span>
                    <span className="font-medium text-green-600">
                      {importProgress.successful_products.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground">Batch Size</span>
                    <span className="font-medium">
                      100
                    </span>
                  </div>
                </div>

                {/* Error message */}
                {importProgress.error_message && importProgress.status === 'failed' && (
                  <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-600 dark:text-red-400">
                    {importProgress.error_message}
                  </div>
                )}

                {/* Control buttons */}
                {(importProgress.status === 'processing' || importProgress.status === 'paused') && (
                  <div className="flex gap-2">
                    {importProgress.status === 'paused' ? (
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={handleResume}
                        disabled={isControlling}
                      >
                        <Play className="h-3 w-3 mr-1" />
                        Resume
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onClick={handlePause}
                        disabled={isControlling}
                      >
                        <Pause className="h-3 w-3 mr-1" />
                        Pause
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={handleStop}
                      disabled={isControlling}
                    >
                      <X className="h-3 w-3 mr-1" />
                      Stop
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  )
}