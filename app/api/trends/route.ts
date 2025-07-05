import { NextRequest, NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

export async function GET(request: NextRequest) {
  console.log('Trends API called')
  
  try {
    // Add CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
    
    // Fetch all trends
    console.log('Fetching trends from database...')
    const { data: trends, error } = await supabaseService
      .from('trends')
      .select('*')
      .order('last_updated', { ascending: false })

    if (error) {
      console.error('Error fetching trends:', error)
      return NextResponse.json(
        { success: false, error: error.message, details: error },
        { status: 500, headers }
      )
    }

    console.log(`Found ${trends?.length || 0} trends`)

    // Fetch trend sources for all trends
    if (trends && trends.length > 0) {
      const trendIds = trends.map(t => t.trend_id)
      console.log('Fetching trend sources...')
      const { data: sources, error: sourcesError } = await supabaseService
        .from('trend_sources')
        .select('*')
        .in('trend_id', trendIds)
        .order('extracted_at', { ascending: false })

      if (sourcesError) {
        console.warn('Error fetching trend sources:', sourcesError)
        // Don't fail the whole request if sources fail
      } else if (sources) {
        console.log(`Found ${sources.length} trend sources`)
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
    }, { headers })
  } catch (error) {
    console.error('Unexpected error in trends API:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch trends', details: error },
      { status: 500 }
    )
  }
} 