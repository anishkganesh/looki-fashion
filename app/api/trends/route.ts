import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

export async function GET() {
  try {
    const { data: trends, error } = await supabaseService
      .from('trends')
      .select('*')
      .order('last_updated', { ascending: false })

    if (error) {
      console.error('Error fetching trends:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      trends: trends || []
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trends' },
      { status: 500 }
    )
  }
} 