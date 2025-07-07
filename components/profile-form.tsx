"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/lib/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useTranslation } from 'react-i18next'

interface UserData {
  id: number
  name: string
  email: string
  brand_id: number
}

interface BrandData {
  brand_id: number
  brand_name: string
  description: string
  category: string
  website: string
  founded_year: number | null
}

export function ProfileForm() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [brandData, setBrandData] = useState<BrandData | null>(null)
  
  const [alert, setAlert] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" })

  // Form data state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    brand_name: "",
    description: "",
    category: "",
    website: "",
    founded_year: ""
  })

  // Fetch user and brand data on mount
  useEffect(() => {
    if (user?.email) {
      fetchProfileData()
    }
  }, [user])

  const fetchProfileData = async () => {
    try {
      setIsLoading(true)
      
      // Fetch user data from usr table
      const { data: userResult, error: userError } = await supabase
        .from('usr')
        .select('id, name, email, brand_id')
        .eq('email', user!.email)
        .single()

      if (userError) {
        console.error('Error fetching user data:', userError)
        setAlert({
          type: "error",
          message: t('profile.errors.loadUserData')
        })
        return
      }

      if (!userResult) {
        setAlert({
          type: "error",
          message: t('profile.errors.userNotFound')
        })
        return
      }

      setUserData(userResult)

      // Fetch brand data
      const { data: brandResult, error: brandError } = await supabase
        .from('brands')
        .select('brand_id, brand_name, description, category, website, founded_year')
        .eq('brand_id', userResult.brand_id)
        .single()

      if (brandError) {
        console.error('Error fetching brand data:', brandError)
        setAlert({
          type: "error",
          message: "Failed to load brand data"
        })
        return
      }

      if (!brandResult) {
        setAlert({
          type: "error",
          message: "Brand data not found"
        })
        return
      }

      setBrandData(brandResult)

      // Set form data
      setFormData({
        name: userResult.name || "",
        email: userResult.email || "",
        brand_name: brandResult.brand_name || "",
        description: brandResult.description || "",
        category: brandResult.category || "",
        website: brandResult.website || "",
        founded_year: brandResult.founded_year?.toString() || ""
      })

    } catch (error) {
      console.error('Error loading profile:', error)
      setAlert({
        type: "error",
        message: "An unexpected error occurred"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target
    setFormData(prev => ({ ...prev, [id]: value }))
  }
  
  const handleSelectChange = (value: string) => {
    setFormData(prev => ({ ...prev, category: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAlert({ type: null, message: "" })
    
    if (!userData || !brandData) {
      setAlert({
        type: "error",
        message: "Profile data not loaded"
      })
      return
    }

    // Validate required fields
    if (!formData.name || !formData.brand_name || !formData.description || !formData.category) {
      setAlert({
        type: "error",
        message: "Please fill in all required fields"
      })
      return
    }

    // Validate website URL if provided
    if (formData.website) {
      try {
        new URL(formData.website)
      } catch (e) {
        setAlert({
          type: "error",
          message: "Please enter a valid website URL"
        })
        return
      }
    }

    setIsSaving(true)

    try {
      // Update user data
      const { error: userUpdateError } = await supabase
        .from('usr')
        .update({
          name: formData.name
        })
        .eq('id', userData.id)

      if (userUpdateError) {
        console.error('Error updating user:', userUpdateError)
        setAlert({
          type: "error",
          message: "Failed to update account information"
        })
        return
      }

      // Update brand data
      const { error: brandUpdateError } = await supabase
        .from('brands')
        .update({
          brand_name: formData.brand_name,
          description: formData.description,
          category: formData.category,
          website: formData.website,
          founded_year: formData.founded_year ? parseInt(formData.founded_year) : null,
          updated_at: new Date().toISOString()
        })
        .eq('brand_id', brandData.brand_id)

      if (brandUpdateError) {
        console.error('Error updating brand:', brandUpdateError)
        setAlert({
          type: "error",
          message: "Failed to update brand information"
        })
        return
      }

      // Show success message
      setAlert({
        type: "success",
        message: "Profile updated successfully!"
      })

      // Clear success message after 5 seconds
      setTimeout(() => {
        setAlert({ type: null, message: "" })
      }, 5000)

    } catch (error) {
      console.error('Error updating profile:', error)
      setAlert({
        type: "error",
        message: "An unexpected error occurred"
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10">
          <div className="text-center">
            <p className="text-muted-foreground">{t('profile.loadingProfile')}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {alert.type && (
        <Alert 
          variant={alert.type === "success" ? "success" : "destructive"}
        >
          {alert.type === "success" && <CheckCircle className="h-4 w-4" />}
          {alert.type === "error" && <AlertCircle className="h-4 w-4" />}
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Account Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.accountInfo.title')}</CardTitle>
              <CardDescription>
                {t('profile.accountInfo.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t('profile.accountInfo.fullName')}</Label>
                <Input
                  id="name"
                  placeholder="John Smith"
                  required
                  value={formData.name}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">{t('profile.accountInfo.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  {t('profile.accountInfo.emailNote')}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Brand Information */}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.brandInfo.title')}</CardTitle>
              <CardDescription>
                {t('profile.brandInfo.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="brand_name">Brand Name</Label>
                <Input
                  id="brand_name"
                  placeholder="Your Fashion Brand"
                  required
                  value={formData.brand_name}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Brand Description</Label>
                <Textarea
                  id="description"
                  placeholder="Tell us about your brand and what makes it unique..."
                  className="min-h-24"
                  required
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Primary Category</Label>
                <Select required value={formData.category} onValueChange={handleSelectChange}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="womenswear">{t('profile.categories.womenswear')}</SelectItem>
                    <SelectItem value="menswear">{t('profile.categories.menswear')}</SelectItem>
                    <SelectItem value="accessories">{t('profile.categories.accessories')}</SelectItem>
                    <SelectItem value="footwear">{t('profile.categories.footwear')}</SelectItem>
                    <SelectItem value="jewelry">{t('profile.categories.jewelry')}</SelectItem>
                    <SelectItem value="childrenswear">{t('profile.categories.childrenswear')}</SelectItem>
                    <SelectItem value="other">{t('profile.categories.other')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder="https://yourbrand.com"
                  value={formData.website}
                  onChange={handleChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="founded_year">Founded Year</Label>
                <Input
                  id="founded_year"
                  type="number"
                  placeholder="2025"
                  min="1900"
                  max="2025"
                  value={formData.founded_year}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isSaving}>
            {isSaving ? t('profile.savingChanges') : t('profile.saveChanges')}
          </Button>
        </div>
      </form>
    </div>
  )
} 