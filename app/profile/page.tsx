"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Loader2, Save, User, Building2, CheckCircle, AlertCircle } from "lucide-react"
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

export default function ProfilePage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [userRole, setUserRole] = React.useState<string>("")
  const [alert, setAlert] = React.useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" })
  
  // User data
  const [userData, setUserData] = React.useState({
    user_id: "",
    email: "",
    full_name: "",
    title: "",
    department: "",
    phone: "",
    timezone: "",
    language: "",
    notification_preferences: {} as any,
  })
  
  // Brand data
  const [brandData, setBrandData] = React.useState({
    brand_id: "",
    brand_name: "",
    description: "",
    website: "",
    primary_category: "",
    secondary_categories: [] as string[],
    founding_year: "",
    headquarters_location: "",
    company_size: "",
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
  
  // Load profile data
  React.useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch('/api/profile')
        const result = await response.json()
        
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to fetch profile')
        }
        
        setUserData(result.user)
        setBrandData(result.brand)
        setUserRole(result.user.role)
      } catch (error: any) {
        toast.error(error.message || 'Failed to load profile')
        console.error('Profile fetch error:', error)
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchProfile()
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
          brandData: userRole === 'admin' ? brandData : null,
          newPassword: newPassword || null,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update profile')
      }
      
      setAlert({
        type: "success",
        message: "Profile updated successfully!"
      })
      
      // Clear password fields
      setNewPassword("")
      setConfirmPassword("")
      
      // Update with fresh data
      setUserData(result.user)
      setBrandData(result.brand)
      
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
              Update your personal details and preferences
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
              
              <div className="space-y-2">
                <Label htmlFor="title">Job Title</Label>
                <Input 
                  id="title"
                  value={userData.title || ""}
                  onChange={(e) => setUserData({...userData, title: e.target.value})}
                  placeholder="e.g. Marketing Manager"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input 
                  id="department"
                  value={userData.department || ""}
                  onChange={(e) => setUserData({...userData, department: e.target.value})}
                  placeholder="e.g. Marketing"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input 
                  id="phone"
                  type="tel"
                  value={userData.phone || ""}
                  onChange={(e) => setUserData({...userData, phone: e.target.value})}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select 
                  value={userData.timezone || "America/New_York"}
                  onValueChange={(value) => setUserData({...userData, timezone: value})}
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Europe/Paris">Paris</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  </SelectContent>
                </Select>
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
        
        {/* Brand Information - Only editable by admins */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Brand Information
            </CardTitle>
            <CardDescription>
              {userRole === 'admin' 
                ? 'Update your brand details and target demographics'
                : 'View your brand information (admin access required to edit)'}
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
                  disabled={userRole !== 'admin'}
                  className={userRole !== 'admin' ? 'bg-muted' : ''}
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
                  disabled={userRole !== 'admin'}
                  className={userRole !== 'admin' ? 'bg-muted' : ''}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="primary_category">Primary Category</Label>
                <Select 
                  value={brandData.primary_category || ""}
                  onValueChange={(value) => setBrandData({...brandData, primary_category: value})}
                  disabled={userRole !== 'admin'}
                >
                  <SelectTrigger id="primary_category" className={userRole !== 'admin' ? 'bg-muted' : ''}>
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
                <Label htmlFor="founding_year">Founded Year</Label>
                <Input 
                  id="founding_year"
                  value={brandData.founding_year || ""}
                  onChange={(e) => setBrandData({...brandData, founding_year: e.target.value})}
                  placeholder="e.g. 2020"
                  disabled={userRole !== 'admin'}
                  className={userRole !== 'admin' ? 'bg-muted' : ''}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="headquarters">Headquarters</Label>
                <Input 
                  id="headquarters"
                  value={brandData.headquarters_location || ""}
                  onChange={(e) => setBrandData({...brandData, headquarters_location: e.target.value})}
                  placeholder="e.g. New York, NY"
                  disabled={userRole !== 'admin'}
                  className={userRole !== 'admin' ? 'bg-muted' : ''}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="company_size">Company Size</Label>
                <Select 
                  value={brandData.company_size || ""}
                  onValueChange={(value) => setBrandData({...brandData, company_size: value})}
                  disabled={userRole !== 'admin'}
                >
                  <SelectTrigger id="company_size" className={userRole !== 'admin' ? 'bg-muted' : ''}>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10">1-10 employees</SelectItem>
                    <SelectItem value="11-50">11-50 employees</SelectItem>
                    <SelectItem value="51-200">51-200 employees</SelectItem>
                    <SelectItem value="201-500">201-500 employees</SelectItem>
                    <SelectItem value="500+">500+ employees</SelectItem>
                  </SelectContent>
                </Select>
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
                disabled={userRole !== 'admin'}
                className={userRole !== 'admin' ? 'bg-muted' : ''}
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
                      className={cn("w-20", userRole !== 'admin' && 'bg-muted')}
                      disabled={userRole !== 'admin'}
                    />
                    <span>to</span>
                    <Input 
                      type="number"
                      value={brandData.target_age_max}
                      onChange={(e) => setBrandData({...brandData, target_age_max: parseInt(e.target.value)})}
                      placeholder="Max"
                      min="0"
                      max="100"
                      className={cn("w-20", userRole !== 'admin' && 'bg-muted')}
                      disabled={userRole !== 'admin'}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="gender">Target Gender</Label>
                  <Select 
                    value={brandData.target_gender}
                    onValueChange={(value) => setBrandData({...brandData, target_gender: value})}
                    disabled={userRole !== 'admin'}
                  >
                    <SelectTrigger id="gender" className={userRole !== 'admin' ? 'bg-muted' : ''}>
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
                    disabled={userRole !== 'admin'}
                  >
                    <SelectTrigger id="income" className={userRole !== 'admin' ? 'bg-muted' : ''}>
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
                    disabled={userRole !== 'admin'}
                    className={userRole !== 'admin' ? 'bg-muted' : ''}
                  />
                </div>
              </div>
            </div>
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
    </div>
  )
} 