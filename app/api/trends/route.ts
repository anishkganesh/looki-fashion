import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

export async function GET(request: NextRequest) {
  try {
    // Fetch all trends
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

    // Fetch trend sources for all trends
    if (trends && trends.length > 0) {
      const trendIds = trends.map(t => t.trend_id)
      const { data: sources, error: sourcesError } = await supabaseService
        .from('trend_sources')
        .select('*')
        .in('trend_id', trendIds)
        .order('extracted_at', { ascending: false })

      if (!sourcesError && sources) {
        // Group sources by trend_id
        const sourcesByTrend = sources.reduce((acc, source) => {
          if (!acc[source.trend_id]) {
            acc[source.trend_id] = []
          }
          acc[source.trend_id].push(source)
          return acc
        }, {} as Record<number, any[]>)

        // Add sources to each trend
        trends.forEach(trend => {
          trend.sources = sourcesByTrend[trend.trend_id] || []
        })
      }
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