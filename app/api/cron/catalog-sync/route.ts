import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all brands that have catalog integrated
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('brand_id, brand_name')
      .eq('has_catalog_integrated', true)
      .eq('is_active', true)

    if (brandsError || !brands) {
      throw new Error('Failed to fetch brands')
    }

    const results = []

    for (const brand of brands) {
      try {
        // Check if there's already an active import for this brand
        const { data: activeImport } = await supabase
          .from('catalog_import_progress')
          .select('id')
          .eq('brand_id', brand.brand_id)
          .in('status', ['pending', 'processing', 'enriching'])
          .single()

        if (activeImport) {
          results.push({
            brand_id: brand.brand_id,
            brand_name: brand.brand_name,
            status: 'skipped',
            reason: 'Import already in progress'
          })
          continue
        }

        // Check last successful import
        const { data: lastImport } = await supabase
          .from('catalog_import_progress')
          .select('completed_at')
          .eq('brand_id', brand.brand_id)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(1)
          .single()

        // Only run if last import was more than 12 hours ago
        if (lastImport?.completed_at) {
          const lastImportTime = new Date(lastImport.completed_at).getTime()
          const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000)
          
          if (lastImportTime > twelveHoursAgo) {
            results.push({
              brand_id: brand.brand_id,
              brand_name: brand.brand_name,
              status: 'skipped',
              reason: 'Recently synced'
            })
            continue
          }
        }

        // Create import progress record
        const { data: importProgress, error: importError } = await supabase
          .from('catalog_import_progress')
          .insert({
            brand_id: brand.brand_id,
            import_type: 'marisa_api_cron',
            status: 'pending',
            total_products: 0,
            processed_products: 0,
            successful_products: 0,
            failed_products: 0,
            enriched_products: 0,
            current_page: 0,
            metadata: { triggered_by: 'cron' }
          })
          .select()
          .single()

        if (importError || !importProgress) {
          throw new Error(`Failed to create import progress: ${importError?.message}`)
        }

        // Trigger the bulk import
        const response = await fetch(`${request.nextUrl.origin}/api/catalog/marisa/bulk-import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            importProgressId: importProgress.id,
            brandId: brand.brand_id,
            resumeFromPage: 0
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to start import')
        }

        results.push({
          brand_id: brand.brand_id,
          brand_name: brand.brand_name,
          status: 'started',
          import_progress_id: importProgress.id
        })

      } catch (error) {
        console.error(`Error processing brand ${brand.brand_id}:`, error)
        results.push({
          brand_id: brand.brand_id,
          brand_name: brand.brand_name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      brands_processed: brands.length,
      results
    })

  } catch (error) {
    console.error('Cron job error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}