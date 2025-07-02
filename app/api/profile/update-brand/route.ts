import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userEmail, selectedBrand } = body
    
    if (!userEmail || !selectedBrand) {
      return NextResponse.json(
        { error: 'User email and selected brand are required' },
        { status: 400 }
      )
    }
    
    // Update user's selected brand
    const { data, error } = await supabaseService
      .from('usr')
      .update({ selected_brand: selectedBrand })
      .eq('email', userEmail)
      .select()
      .single()
    
    if (error) {
      console.error('Error updating selected brand:', error)
      return NextResponse.json(
        { error: 'Failed to update selected brand' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error in update-brand route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 