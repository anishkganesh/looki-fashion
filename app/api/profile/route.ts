import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    // Get the authorization header
    const headersList = await headers()
    const authorization = headersList.get('authorization')
    
    // Create a Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            authorization: authorization || '',
          },
        },
      }
    )
    
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
        user_id: userData.id, // Map id to user_id for frontend compatibility
        email: user.email, // Add email from auth
        full_name: userData.name || '', // Map name to full_name
        title: '',
        department: '',
        phone: '',
        timezone: 'America/New_York',
        language: 'en',
        notification_preferences: {},
      },
      brand: {
        ...brandData,
        primary_category: brandData.category || '', // Map category to primary_category
        secondary_categories: [],
        headquarters_location: '',
        company_size: '',
        founding_year: brandData.founded_year?.toString() || '',
      }
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
    // Get the authorization header
    const headersList = await headers()
    const authorization = headersList.get('authorization')
    
    // Create a Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            authorization: authorization || '',
          },
        },
      }
    )
    
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
      .select('brand_id, role, id')
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
          name: userData.full_name || userData.name,
          // Other fields from userData are not in the database, so we skip them
        })
        .eq('id', currentUser.id)
      
      if (updateUserError) {
        throw updateUserError
      }
    }
    
    // Update brand data - remove admin check to allow all users to edit
    if (brandData) {
      const updateData: any = {
        brand_name: brandData.brand_name,
        description: brandData.description,
        website: brandData.website,
        category: brandData.primary_category || brandData.category,
        founded_year: brandData.founding_year ? parseInt(brandData.founding_year) : null,
        // Demographics
        target_age_min: brandData.target_age_min,
        target_age_max: brandData.target_age_max,
        target_gender: brandData.target_gender,
        target_locations: brandData.target_locations,
        target_income_level: brandData.target_income_level,
        target_lifestyle: brandData.target_lifestyle,
        target_interests: brandData.target_interests,
        updated_at: new Date().toISOString()
      }
      
      const { error: updateBrandError } = await supabaseService
        .from('brands')
        .update(updateData)
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
      user: {
        ...updatedUser,
        user_id: updatedUser.id,
        email: user.email,
        full_name: updatedUser.name || '',
        title: '',
        department: '',
        phone: '',
        timezone: 'America/New_York',
        language: 'en',
        notification_preferences: {},
      },
      brand: {
        ...updatedBrand,
        primary_category: updatedBrand.category || '',
        secondary_categories: [],
        headquarters_location: '',
        company_size: '',
        founding_year: updatedBrand.founded_year?.toString() || '',
      }
    })
  } catch (error: any) {
    console.error('Profile update error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update profile' },
      { status: 500 }
    )
  }
} 