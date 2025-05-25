"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Loader2, Save, User, Building2, CheckCircle, AlertCircle, Package, Upload, FileText, Trash2, Eye, Download, RefreshCw, Database, Sparkles, Link2, FileJson, Key, File as FileIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createClient } from '@supabase/supabase-js'

export default function ProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [userRole, setUserRole] = React.useState<string>("")
  const [alert, setAlert] = React.useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" })
  
  // Initialize Supabase client
  const supabase = React.useMemo(() => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), [])
  
  // User data - only fields that exist in database
  const [userData, setUserData] = React.useState({
    user_id: "",
    email: "",
    full_name: "",
    role: ""
  })
  
  // Brand data - only fields that exist in database
  const [brandData, setBrandData] = React.useState({
    brand_id: "",
    brand_name: "",
    description: "",
    website: "",
    category: "",
    founded_year: "",
    target_age_min: 18,
    target_age_max: 65,
    target_gender: "all",
    target_locations: [] as string[],
    target_income_level: "medium",
    target_lifestyle: [] as string[],
    target_interests: [] as string[],
  })
  
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  
  // Product catalog state
  const [catalogFiles, setCatalogFiles] = React.useState<any[]>([])
  const [uploadProgress, setUploadProgress] = React.useState(0)
  const [isUploading, setIsUploading] = React.useState(false)
  const [processingStatus, setProcessingStatus] = React.useState<string>("")
  const [mappingDialog, setMappingDialog] = React.useState(false)
  const [fieldMappings, setFieldMappings] = React.useState<any>({})
  const [previewData, setPreviewData] = React.useState<any[]>([])
  const [confidenceThreshold, setConfidenceThreshold] = React.useState(0.7)
  const [importSummary, setImportSummary] = React.useState<any>(null)
  
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const dropZoneRef = React.useRef<HTMLDivElement>(null)
  
  // Load profile data
  React.useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch('/api/profile')
        
        const result = await response.json()
        
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch profile')
        }
        
        // Map the data correctly
        setUserData({
          user_id: result.user.user_id,
          email: result.user.email,
          full_name: result.user.full_name,
          role: result.user.role
        })
        
        setBrandData({
          brand_id: result.brand.brand_id,
          brand_name: result.brand.brand_name || "",
          description: result.brand.description || "",
          website: result.brand.website || "",
          category: result.brand.category || "",
          founded_year: result.brand.founded_year?.toString() || "",
          target_age_min: result.brand.target_age_min || 18,
          target_age_max: result.brand.target_age_max || 65,
          target_gender: result.brand.target_gender || "all",
          target_locations: result.brand.target_locations || [],
          target_income_level: result.brand.target_income_level || "medium",
          target_lifestyle: result.brand.target_lifestyle || [],
          target_interests: result.brand.target_interests || []
        })
        
        setUserRole(result.user.role)
      } catch (error: any) {
        toast.error(error.message || 'Failed to load profile')
        console.error('Profile fetch error:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    loadProfile()
  }, [])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAlert({ type: null, message: "" })
    
    // Validate passwords match
    if (newPassword && newPassword !== confirmPassword) {
      setAlert({
        type: "error",
        message: "Passwords don't match"
      })
      return
    }
    
    setIsSaving(true)
    
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userData,
          brandData,
          newPassword: newPassword || null,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update profile')
      }
      
      setAlert({
        type: "success",
        message: result.message || "Profile updated successfully!"
      })
      
      // Clear password fields
      setNewPassword("")
      setConfirmPassword("")
      
      // Clear success message after 5 seconds
      setTimeout(() => {
        setAlert({ type: null, message: "" })
      }, 5000)
      
    } catch (error: any) {
      setAlert({
        type: "error",
        message: error.message || 'Failed to update profile'
      })
    } finally {
      setIsSaving(false)
    }
  }
  
  // File upload handlers
  const handleFileUpload = async (files: File[]) => {
    if (files.length === 0) return
    
    setIsUploading(true)
    setUploadProgress(0)
    
    try {
      for (const file of files) {
        // Validate file size (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 50MB limit`)
          continue
        }
        
        setProcessingStatus(`📁 Reading ${file.name}...`)
        setUploadProgress(10)
        
        // Parse file content first to show preview
        const fileContent = await parseFileContent(file)
        
        setUploadProgress(40)
        setProcessingStatus(`📊 Parsing ${file.name.endsWith('.csv') ? 'CSV' : 'JSON'} data...`)
        
        if (fileContent.length > 0) {
          setProcessingStatus(`✅ Found ${fileContent.length} products. Showing preview...`)
          setUploadProgress(80)
          
          // Show preview data
          setPreviewData(fileContent.slice(0, 5))
          setMappingDialog(true)
          
          // Store file for later upload
          setCatalogFiles(prev => [...prev, {
            file: file,
            name: file.name,
            type: file.name.endsWith('.csv') ? 'csv' : 'json',
            size: formatFileSize(file.size),
            uploadedAt: new Date().toLocaleString(),
            content: fileContent
          }])
        }
        
        setUploadProgress(100)
        setProcessingStatus(`✅ File parsed successfully!`)
        
        // Clear status after 2 seconds
        setTimeout(() => {
          setProcessingStatus("")
        }, 2000)
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to process files')
      setProcessingStatus("")
    } finally {
      setIsUploading(false)
    }
  }
  
  const parseFileContent = async (file: File): Promise<any[]> => {
    const text = await file.text()
    
    if (file.name.endsWith('.csv')) {
      // Simple CSV parser
      const lines = text.split('\n').filter(line => line.trim())
      const headers = lines[0].split(',').map(h => h.trim())
      
      return lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim())
        return headers.reduce((obj, header, index) => {
          obj[header] = values[index] || ''
          return obj
        }, {} as any)
      })
    } else if (file.name.endsWith('.json')) {
      return JSON.parse(text)
    }
    
    return []
  }
  
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }
  
  const handleProcessProducts = async () => {
    try {
      setMappingDialog(false)
      setProcessingStatus('🔄 Starting product processing...')
      setIsUploading(true)
      setUploadProgress(0)
      
      // Check if AI enhancement is enabled
      const enableAI = (document.getElementById('ai-enhance') as HTMLInputElement)?.checked
      
      setProcessingStatus('📋 Validating product data...')
      setUploadProgress(10)
      
      // Simulate processing delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500))
      
      setProcessingStatus('🔍 Analyzing product attributes...')
      setUploadProgress(25)
      
      if (enableAI) {
        setProcessingStatus('🤖 Enhancing products with AI...')
        setUploadProgress(40)
      }
      
      // Upload file to Supabase Storage first
      const currentFile = catalogFiles[catalogFiles.length - 1]
      if (currentFile && currentFile.file) {
        const fileName = `${brandData.brand_id}/${Date.now()}-${currentFile.name}`
        
        setProcessingStatus(`☁️ Uploading to cloud storage...`)
        setUploadProgress(50)
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('product-catalogs')
          .upload(fileName, currentFile.file)
        
        if (uploadError) {
          throw new Error('Failed to upload file')
        }
      }
      
      setUploadProgress(60)
      
      if (enableAI) {
        setProcessingStatus('🎯 Matching products with fashion trends...')
        setUploadProgress(75)
      } else {
        setProcessingStatus('💾 Saving products to database...')
        setUploadProgress(75)
      }
      
      // Send to API for processing
      const response = await fetch('/api/products/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          products: previewData,
          fieldMappings,
          brandId: brandData.brand_id,
          enableAI,
          confidenceThreshold
        })
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to process products')
      }
      
      setUploadProgress(90)
      setProcessingStatus('✨ Finalizing product import...')
      
      // Update import summary
      setImportSummary(result.results)
      
      setUploadProgress(100)
      setProcessingStatus('✅ Products processed successfully!')
      
      // Show success message
      toast.success(`Processed ${result.results.totalProducts} products successfully!`)
      
      // Clear preview data
      setPreviewData([])
      setFieldMappings({})
      
      // Clear status after 2 seconds
      setTimeout(() => {
        setProcessingStatus("")
      }, 2000)
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to process products')
      setProcessingStatus("")
    } finally {
      setIsUploading(false)
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
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Profile Settings</h1>
            <p className="text-muted-foreground mt-2">Manage your account and brand information</p>
          </div>
          <Badge variant={userRole === 'admin' ? 'default' : 'secondary'}>
            {userRole}
          </Badge>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {alert.type && (
          <Alert 
            variant={alert.type === "success" ? "success" : "destructive"}
            className="animate-in slide-in-from-top-2"
          >
            {alert.type === "success" && <CheckCircle className="h-4 w-4" />}
            {alert.type === "error" && <AlertCircle className="h-4 w-4" />}
            <AlertDescription>{alert.message}</AlertDescription>
          </Alert>
        )}
        
        {/* User Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            <CardDescription>
              Update your personal details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email"
                  type="email"
                  value={userData.email}
                  disabled
                  className="bg-muted"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input 
                  id="full_name"
                  value={userData.full_name || ""}
                  onChange={(e) => setUserData({...userData, full_name: e.target.value})}
                  placeholder="Your full name"
                />
              </div>
            </div>
            
            {/* Password Change */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">Change Password</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new_password">New Password</Label>
                  <Input 
                    id="new_password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm_password">Confirm Password</Label>
                  <Input 
                    id="confirm_password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Brand Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Brand Information
            </CardTitle>
            <CardDescription>
              Update your brand details and target demographics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="brand_name">Brand Name</Label>
                <Input 
                  id="brand_name"
                  value={brandData.brand_name || ""}
                  onChange={(e) => setBrandData({...brandData, brand_name: e.target.value})}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input 
                  id="website"
                  type="url"
                  value={brandData.website || ""}
                  onChange={(e) => setBrandData({...brandData, website: e.target.value})}
                  placeholder="https://example.com"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select 
                  value={brandData.category || ""}
                  onValueChange={(value) => setBrandData({...brandData, category: value})}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="luxury">Luxury</SelectItem>
                    <SelectItem value="fast-fashion">Fast Fashion</SelectItem>
                    <SelectItem value="streetwear">Streetwear</SelectItem>
                    <SelectItem value="athletic">Athletic/Sportswear</SelectItem>
                    <SelectItem value="sustainable">Sustainable Fashion</SelectItem>
                    <SelectItem value="accessories">Accessories</SelectItem>
                    <SelectItem value="footwear">Footwear</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="founded_year">Founded Year</Label>
                <Input 
                  id="founded_year"
                  value={brandData.founded_year || ""}
                  onChange={(e) => setBrandData({...brandData, founded_year: e.target.value})}
                  placeholder="e.g. 2020"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Brand Description</Label>
              <Textarea 
                id="description"
                value={brandData.description || ""}
                onChange={(e) => setBrandData({...brandData, description: e.target.value})}
                placeholder="Tell us about your brand..."
                rows={4}
              />
            </div>
            
            {/* Demographics Section */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">Target Demographics</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Age Range</Label>
                  <div className="flex gap-2 items-center">
                    <Input 
                      type="number"
                      value={brandData.target_age_min}
                      onChange={(e) => setBrandData({...brandData, target_age_min: parseInt(e.target.value)})}
                      placeholder="Min"
                      min="0"
                      max="100"
                      className="w-20"
                    />
                    <span>to</span>
                    <Input 
                      type="number"
                      value={brandData.target_age_max}
                      onChange={(e) => setBrandData({...brandData, target_age_max: parseInt(e.target.value)})}
                      placeholder="Max"
                      min="0"
                      max="100"
                      className="w-20"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="gender">Target Gender</Label>
                  <Select 
                    value={brandData.target_gender}
                    onValueChange={(value) => setBrandData({...brandData, target_gender: value})}
                  >
                    <SelectTrigger id="gender">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Genders</SelectItem>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="non-binary">Non-binary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="income">Income Level</Label>
                  <Select 
                    value={brandData.target_income_level}
                    onValueChange={(value) => setBrandData({...brandData, target_income_level: value})}
                  >
                    <SelectTrigger id="income">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Income</SelectItem>
                      <SelectItem value="medium">Medium Income</SelectItem>
                      <SelectItem value="high">High Income</SelectItem>
                      <SelectItem value="luxury">Luxury</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="locations">Target Locations</Label>
                  <Input 
                    id="locations"
                    value={brandData.target_locations?.join(', ') || ""}
                    onChange={(e) => setBrandData({
                      ...brandData, 
                      target_locations: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="e.g. New York, Paris, Tokyo"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Product Catalog Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Product Catalog
            </CardTitle>
            <CardDescription>
              Upload your fashion catalog via CSV or JSON
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">File Upload</TabsTrigger>
                <TabsTrigger value="manage">Manage Data</TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  ref={dropZoneRef}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                    "hover:border-primary hover:bg-primary/5",
                    isUploading && "opacity-50 pointer-events-none"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.add("border-primary", "bg-primary/5")
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove("border-primary", "bg-primary/5")
                  }}
                  onDrop={async (e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove("border-primary", "bg-primary/5")
                    const files = Array.from(e.dataTransfer.files)
                    await handleFileUpload(files)
                  }}
                >
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">
                    Drag and drop your catalog files here
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Supports CSV and JSON files (max 50MB)
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Browse Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".csv,.json"
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      handleFileUpload(files)
                    }}
                  />
                </div>
                
                {/* Upload Progress */}
                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{processingStatus}</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <Progress value={uploadProgress} />
                  </div>
                )}
                
                {/* Data Preview */}
                {previewData.length > 0 && !mappingDialog && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Data Preview</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {Object.keys(previewData[0]).map(key => (
                              <TableHead key={key} className="text-xs">{key}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {previewData.slice(0, 3).map((row, index) => (
                            <TableRow key={index}>
                              {Object.values(row).map((value: any, i) => (
                                <TableCell key={i} className="text-xs">
                                  {String(value).slice(0, 50)}
                                </TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Showing first 3 of {previewData.length} products
                    </p>
                  </div>
                )}
                
                {/* AI Enhancement Options */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <Label>AI Data Enhancement</Label>
                    </div>
                    <Checkbox
                      id="ai-enhance"
                      defaultChecked
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Use AI to automatically fill missing product attributes, generate descriptions, and estimate trend alignments
                  </p>
                  <div className="flex items-center gap-4">
                    <Label htmlFor="confidence" className="text-sm">
                      Confidence Threshold
                    </Label>
                    <Input
                      id="confidence"
                      type="number"
                      min="0"
                      max="1"
                      step="0.1"
                      value={confidenceThreshold}
                      onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                      className="w-20"
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="manage" className="space-y-4">
                {importSummary && (
                  <Alert>
                    <Database className="h-4 w-4" />
                    <AlertDescription>
                      <div className="space-y-1">
                        <p className="font-medium font-geist">Last Import Summary</p>
                        <p className="text-sm font-geist">
                          {importSummary.totalProducts} products imported • 
                          {importSummary.newProducts} new • 
                          {importSummary.updatedProducts} updated • 
                          {importSummary.aiEnriched} AI enriched
                        </p>
                      </div>
                    </AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-2">
                  <h4 className="font-medium font-geist">Product Data Overview</h4>
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium font-geist">
                          Total Products
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold font-geist">0</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium font-geist">
                          Categories
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold font-geist">0</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium font-geist">
                          Trend Alignments
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold font-geist">0</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export All Products
                  </Button>
                  <Button variant="outline" className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear All Data
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        
        <div className="flex justify-end">
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
      
      {/* Field Mapping Dialog */}
      <Dialog open={mappingDialog} onOpenChange={setMappingDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Map CSV Fields to Product Attributes</DialogTitle>
            <DialogDescription>
              Match your CSV columns to the product database fields
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {/* Preview Table */}
              <div>
                <h4 className="text-sm font-medium mb-2">Data Preview</h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {previewData.length > 0 && Object.keys(previewData[0]).map(key => (
                          <TableHead key={key} className="text-xs">{key}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.slice(0, 3).map((row, index) => (
                        <TableRow key={index}>
                          {Object.values(row).map((value: any, i) => (
                            <TableCell key={i} className="text-xs">
                              {String(value).slice(0, 50)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              <Separator />
              
              {/* Field Mappings */}
              <div>
                <h4 className="text-sm font-medium mb-2">Field Mappings</h4>
                <div className="grid gap-3">
                  {[
                    { field: 'product_code', label: 'Product Code', required: true },
                    { field: 'product_name', label: 'Product Name', required: true },
                    { field: 'current_price', label: 'Current Price', required: true },
                    { field: 'original_price', label: 'Original Price', required: false },
                    { field: 'description', label: 'Description', required: false },
                    { field: 'category', label: 'Category', required: false },
                    { field: 'stock_status', label: 'Stock Status', required: false },
                  ].map(({ field, label, required }) => (
                    <div key={field} className="grid grid-cols-2 gap-4 items-center">
                      <Label className="text-sm">
                        {label} {required && <span className="text-destructive">*</span>}
                      </Label>
                      <Select
                        value={fieldMappings[field] || ''}
                        onValueChange={(value) => setFieldMappings((prev: any) => ({
                          ...prev,
                          [field]: value
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select CSV column" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {previewData.length > 0 && Object.keys(previewData[0]).map(key => (
                            <SelectItem key={key} value={key}>{key}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleProcessProducts}>
              Process Products
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 