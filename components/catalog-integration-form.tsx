"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Package,
  TrendingUp,
  Database,
  Info,
  Play,
  XCircle,
  Clock,
  AlertTriangle,
  Globe,
  Link
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import { useCatalogImport } from "@/lib/catalog-import-context"
import { cn } from "@/lib/utils"



interface ImportHistory {
  id: number
  status: string
  total_products: number
  successful_products: number
  failed_products: number
  enriched_products: number
  started_at: string
  completed_at?: string
  metadata?: any
}

export function CatalogIntegrationForm() {
  const { user } = useAuth()
  const { importProgress, startImport } = useCatalogImport()
  const [isStarting, setIsStarting] = useState(false)
  const [importHistory, setImportHistory] = useState<ImportHistory[]>([])
  const [currentTab, setCurrentTab] = useState("overview")
  const [useProductLimit, setUseProductLimit] = useState(false)
  const [productLimit, setProductLimit] = useState("1000")
  const [importMethod, setImportMethod] = useState<"api" | "website">("api")
  const [websiteUrl, setWebsiteUrl] = useState("")
  
  const [alert, setAlert] = useState<{
    type: "success" | "error" | "info" | null;
    message: string;
  }>({ type: null, message: "" })

  // Load import history and failures on mount
  useEffect(() => {
    if (user) {
      loadImportHistory()
    }
  }, [user])



  const loadImportHistory = async () => {
    try {
      // Get user's brand
      const { data: userData } = await supabase
        .from('usr')
        .select('brand_id')
        .eq('email', user!.email)
        .single()

      if (userData?.brand_id) {
        // Get import history
        const { data: history } = await supabase
          .from('catalog_import_progress')
          .select('*')
          .eq('brand_id', userData.brand_id)
          .order('started_at', { ascending: false })
          .limit(10)

        if (history) {
          setImportHistory(history)
        }
      }
    } catch (error) {
      console.error('Error loading import history:', error)
    }
  }




  const handleStartImport = async () => {
    setAlert({ type: null, message: "" })
    setIsStarting(true)

    try {
      // Get user's brand_id
      const { data: userData, error: userError } = await supabase
        .from('usr')
        .select('brand_id')
        .eq('email', user!.email)
        .single()

      if (userError || !userData || !userData.brand_id) {
        throw new Error('User is not associated with a brand')
      }

      const brandId = userData.brand_id

      // Validate website URL if using website method
      if (importMethod === 'website' && !websiteUrl) {
        throw new Error('Please enter a website URL')
      }

      // Start the import process
      const importProgress = await startImport(brandId, importMethod === 'api' ? 'marisa_api' : 'website_crawl')

      // Trigger the appropriate import
      const endpoint = importMethod === 'api' 
        ? '/api/catalog/marisa/bulk-import'
        : '/api/catalog/import/website'
        
      const requestBody = importMethod === 'api'
        ? {
            importProgressId: importProgress.id,
            brandId: brandId,
            resumeFromPage: importProgress.current_page || 0,
            productLimit: useProductLimit ? parseInt(productLimit) : null
          }
        : {
            importProgressId: importProgress.id,
            brandId: brandId,
            websiteUrl: websiteUrl,
            productLimit: useProductLimit ? parseInt(productLimit) : null
          }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start import')
      }

      setAlert({
        type: "info",
        message: "Product import started! You can navigate away - the import will continue in the background."
      })

      // Reload history
      loadImportHistory()

    } catch (error) {
      console.error('Import error:', error)
      setAlert({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to start import"
      })
    } finally {
      setIsStarting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { color: 'bg-gray-500', icon: Clock },
      processing: { color: 'bg-blue-500', icon: RefreshCw },
      completed: { color: 'bg-green-500', icon: CheckCircle },
      failed: { color: 'bg-red-500', icon: XCircle },
      paused: { color: 'bg-yellow-500', icon: Clock }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    const Icon = config.icon

    return (
      <Badge className={cn("text-xs font-normal", config.color)} variant="secondary">
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }



  const isImportActive = importProgress && ['pending', 'processing', 'enriching'].includes(importProgress.status)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-medium tracking-tight">Integrate Your Catalog</h2>
        <p className="text-sm text-muted-foreground">
          Connect to Marisa Lojas API to import and sync your product catalog
        </p>
      </div>

      {/* Alert */}
      {alert.type && (
        <Alert className={cn({
          "border-green-500": alert.type === "success",
          "border-red-500": alert.type === "error",
          "border-blue-500": alert.type === "info"
        })}>
          <AlertDescription className="flex items-center gap-2">
            {alert.type === "success" && <CheckCircle className="h-4 w-4 text-green-500" />}
            {alert.type === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
            {alert.type === "info" && <Info className="h-4 w-4 text-blue-500" />}
            {alert.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-medium">
              {importHistory[0]?.successful_products?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              {importHistory[0]?.successful_products 
                ? `Synced from API`
                : 'No products yet'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Last Import</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-medium">
              {importHistory[0] ? formatDate(importHistory[0].started_at) : 'Never'}
            </div>
            <div className="text-xs text-muted-foreground">
              {importHistory[0]?.status ? getStatusBadge(importHistory[0].status) : 'No imports yet'}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-normal text-muted-foreground">Integration Status</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-medium">
              {isImportActive ? 'Active' : 'Ready'}
            </div>
            <p className="text-xs text-muted-foreground">
              {isImportActive 
                ? 'Importing...'
                : 'Ready'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">Import History</TabsTrigger>
          <TabsTrigger value="coverage">Data Coverage</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Import Products</CardTitle>
              <CardDescription className="text-sm">
                Choose how to import your product catalog
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Import Method Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Import Method</Label>
                <RadioGroup value={importMethod} onValueChange={(v) => setImportMethod(v as "api" | "website")}>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="api" id="api" />
                    <Label htmlFor="api" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Link className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">API Integration</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Direct integration with Marisa Lojas API for accurate, real-time data
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="website" id="website" />
                    <Label htmlFor="website" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Website Crawling</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Extract products from any e-commerce website (less accurate, may miss data)
                      </p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Website URL Input */}
              {importMethod === "website" && (
                <div className="space-y-2">
                  <Label htmlFor="website-url" className="text-sm font-medium">Website URL</Label>
                  <Input
                    id="website-url"
                    type="url"
                    placeholder="https://example.com/products"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the URL of a product listing page or category page
                  </p>
                  <Alert className="border-yellow-500/50">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    <AlertDescription className="text-xs">
                      Website crawling may not capture all product data and could be blocked by some sites. 
                      API integration is recommended for best results.
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Process Overview</h4>
                <ul className="text-xs text-muted-foreground space-y-1.5">
                  {importMethod === "api" ? (
                    <>
                      <li className="flex items-start"><span className="text-muted-foreground/50 mr-2">•</span>Connect to Marisa API and fetch products</li>
                      <li className="flex items-start"><span className="text-muted-foreground/50 mr-2">•</span>Process in batches of 100 for optimal performance</li>
                      <li className="flex items-start"><span className="text-muted-foreground/50 mr-2">•</span>Fill missing fields with intelligent defaults</li>
                      <li className="flex items-start"><span className="text-muted-foreground/50 mr-2">•</span>Skip unchanged products automatically</li>
                      <li className="flex items-start"><span className="text-muted-foreground/50 mr-2">•</span>Continue in background if you navigate away</li>
                      <li className="flex items-start"><span className="text-muted-foreground/50 mr-2">•</span>Track progress in real-time</li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start"><span className="text-muted-foreground/50 mr-2">•</span>Crawl website and extract product information</li>
                      <li className="flex items-start"><span className="text-muted-foreground/50 mr-2">•</span>Process pages and identify products</li>
                      <li className="flex items-start"><span className="text-muted-foreground/50 mr-2">•</span>Extract available data (name, price, images)</li>
                      <li className="flex items-start"><span className="text-muted-foreground/50 mr-2">•</span>Generate missing fields with defaults</li>
                      <li className="flex items-start"><span className="text-muted-foreground/50 mr-2">•</span>Import in batches of 100 products</li>
                      <li className="flex items-start"><span className="text-muted-foreground/50 mr-2">•</span>May take longer depending on website</li>
                    </>
                  )}
                </ul>
              </div>

              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-xs text-muted-foreground flex items-start">
                  <Info className="w-3 h-3 mr-1.5 mt-0.5 flex-shrink-0" />
                  Import runs in the background. Progress appears in the bottom-right corner.
                </p>
              </div>

              <div className="border rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="product-limit-toggle" className="text-sm font-medium">Test Mode</Label>
                    <p className="text-xs text-muted-foreground">
                      Limit products for testing
                    </p>
                  </div>
                  <Switch
                    id="product-limit-toggle"
                    checked={useProductLimit}
                    onCheckedChange={setUseProductLimit}
                  />
                </div>
                
                {useProductLimit && (
                  <div className="space-y-1.5">
                    <Label htmlFor="product-limit" className="text-xs font-normal">Number of products</Label>
                    <Input
                      id="product-limit"
                      type="number"
                      min="1"
                      max="10000"
                      value={productLimit}
                      onChange={(e) => setProductLimit(e.target.value)}
                      className="w-24 h-8 text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Max 10,000
                    </p>
                  </div>
                )}
              </div>

              <Button
                onClick={handleStartImport}
                disabled={isStarting || !!isImportActive}
                className="w-full"
                size="default"
              >
                {isStarting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Starting Import...
                  </>
                ) : isImportActive ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Import in Progress...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Import
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Import History</CardTitle>
              <CardDescription className="text-sm">
                View your recent catalog imports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-normal">Started</TableHead>
                    <TableHead className="text-xs font-normal">Status</TableHead>
                    <TableHead className="text-xs font-normal text-right">Total</TableHead>
                    <TableHead className="text-xs font-normal text-right">Imported</TableHead>
                    <TableHead className="text-xs font-normal">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No import history yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    importHistory.map((imp) => {
                      const duration = imp.completed_at 
                        ? Math.round((new Date(imp.completed_at).getTime() - new Date(imp.started_at).getTime()) / 60000)
                        : null
                      
                      return (
                        <TableRow key={imp.id}>
                          <TableCell className="text-xs">{formatDate(imp.started_at)}</TableCell>
                          <TableCell>{getStatusBadge(imp.status)}</TableCell>
                          <TableCell className="text-xs text-right">{imp.total_products.toLocaleString()}</TableCell>
                          <TableCell className="text-xs text-right text-green-600">
                            {imp.successful_products.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs">
                            {duration !== null ? `${duration} min` : 'In progress'}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="coverage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-medium">Data Coverage</CardTitle>
              <CardDescription className="text-sm">
                See which fields come from the API vs default values
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {importHistory[0]?.metadata?.data_coverage ? (
                  <>
                    <div className="p-3 bg-muted/30 rounded-md">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">API Fields</h4>
                      <div className="flex flex-wrap gap-2">
                        {importHistory[0].metadata.data_coverage.from_api.map((field: string) => (
                          <Badge key={field} variant="secondary" className="text-xs font-normal">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-muted/30 rounded-md">
                      <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Default Fields</h4>
                      <div className="flex flex-wrap gap-2">
                        {importHistory[0].metadata.ai_enhanced_fields.map((field: string) => (
                          <Badge key={field} variant="outline" className="text-xs font-normal">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            {field.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="p-3 bg-muted/30 rounded-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Coverage</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            {importHistory[0].metadata.data_coverage.coverage_percentage}% from API
                          </p>
                        </div>
                        <div className="text-2xl font-medium">
                          {importHistory[0].metadata.data_coverage.coverage_percentage}%
                        </div>
                      </div>
                    </div>
                    
                    <Alert className="border-muted bg-muted/30">
                      <Info className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        Default values ensure 100% import success. Realistic estimates are used for fields like inventory and sales metrics.
                      </AlertDescription>
                    </Alert>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No import data available. Complete an import to see data coverage information.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}