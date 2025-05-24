import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'
import { supabase } from '@/lib/supabase'

export async function GET(request: Request) {
  try {
    // Get the current user from auth
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    // Fetch user data from usr table
    const { data: userData, error: userError } = await supabaseService
      .from('usr')
      .select('*')
      .eq('email', user.email)
      .single()
    
    if (userError) {
      console.error('Error fetching user:', userError)
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Fetch brand data
    const { data: brandData, error: brandError } = await supabaseService
      .from('brands')
      .select('*')
      .eq('brand_id', userData.brand_id)
      .single()
    
    if (brandError) {
      console.error('Error fetching brand:', brandError)
      return NextResponse.json(
        { success: false, error: 'Brand not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      user: {
        ...userData,
        email: user.email, // Add email from auth
      },
      brand: brandData
    })
  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      )
    }
    
    const body = await request.json()
    const { userData, brandData, newPassword } = body
    
    // Get user's brand_id
    const { data: currentUser } = await supabaseService
      .from('usr')
      .select('brand_id, role')
      .eq('email', user.email)
      .single()
    
    if (!currentUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }
    
    // Update user data
    if (userData) {
      const { error: updateUserError } = await supabaseService
        .from('usr')
        .update({
          full_name: userData.full_name,
          title: userData.title,
          department: userData.department,
          phone: userData.phone,
          timezone: userData.timezone,
          language: userData.language,
          notification_preferences: userData.notification_preferences,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userData.user_id)
      
      if (updateUserError) {
        throw updateUserError
      }
    }
    
    // Update brand data (only if user is admin)
    if (brandData && currentUser.role === 'admin') {
      const { error: updateBrandError } = await supabaseService
        .from('brands')
        .update({
          brand_name: brandData.brand_name,
          description: brandData.description,
          website: brandData.website,
          primary_category: brandData.primary_category,
          secondary_categories: brandData.secondary_categories,
          founding_year: brandData.founding_year,
          headquarters_location: brandData.headquarters_location,
          company_size: brandData.company_size,
          // Demographics
          target_age_min: brandData.target_age_min,
          target_age_max: brandData.target_age_max,
          target_gender: brandData.target_gender,
          target_locations: brandData.target_locations,
          target_income_level: brandData.target_income_level,
          target_lifestyle: brandData.target_lifestyle,
          target_interests: brandData.target_interests,
          updated_at: new Date().toISOString()
        })
        .eq('brand_id', currentUser.brand_id)
      
      if (updateBrandError) {
        throw updateBrandError
      }
    }
    
    // Update password if provided
    if (newPassword) {
      const { error: passwordError } = await supabase.auth.updateUser({
        password: newPassword
      })
      
      if (passwordError) {
        throw passwordError
      }
    }
    
    // Fetch updated data
    const { data: updatedUser } = await supabaseService
      .from('usr')
      .select('*')
      .eq('email', user.email)
      .single()
    
    const { data: updatedBrand } = await supabaseService
      .from('brands')
      .select('*')
      .eq('brand_id', currentUser.brand_id)
      .single()
    
    return NextResponse.json({
      success: true,
      user: updatedUser,
      brand: updatedBrand
    })
  } catch (error: any) {
    console.error('Profile update error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update profile' },
      { status: 500 }
    )
  }
} 