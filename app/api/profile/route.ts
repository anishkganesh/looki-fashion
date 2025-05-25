import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: Request) {
  try {
    // Create a Supabase client with cookies
    const cookieStore = await cookies()
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // Get the current user from auth using the cookie session
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      cookieStore.get('sb-dfxauievbyqwcynwtvib-auth-token')?.value
    )
    
    if (authError || !user) {
      console.error('Auth error:', authError)
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
        user_id: userData.id,
        email: user.email,
        full_name: userData.name || '',
        role: userData.role || 'member'
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
    // Create a Supabase client with cookies
    const cookieStore = await cookies()
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    
    // Get the current user from auth using the cookie session
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      cookieStore.get('sb-dfxauievbyqwcynwtvib-auth-token')?.value
    )
    
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
        })
        .eq('id', currentUser.id)
      
      if (updateUserError) {
        throw updateUserError
      }
    }
    
    // Update brand data - all users can edit
    if (brandData) {
      const updateData: any = {
        brand_name: brandData.brand_name,
        description: brandData.description,
        website: brandData.website,
        category: brandData.category,
        founded_year: brandData.founded_year ? parseInt(brandData.founded_year) : null,
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
      message: 'Profile updated successfully!',
      user: {
        ...updatedUser,
        user_id: updatedUser.id,
        email: user.email,
        full_name: updatedUser.name || '',
        role: updatedUser.role || 'member'
      },
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