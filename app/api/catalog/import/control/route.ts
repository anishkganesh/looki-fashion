import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  try {
    const { importProgressId, action } = await request.json()
    
    if (!importProgressId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate action
    if (!['pause', 'stop', 'resume'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be pause, stop, or resume' },
        { status: 400 }
      )
    }

    // Get current import progress
    const { data: importProgress, error: fetchError } = await supabase
      .from('catalog_import_progress')
      .select('*')
      .eq('id', importProgressId)
      .single()

    if (fetchError || !importProgress) {
      return NextResponse.json(
        { error: 'Import progress not found' },
        { status: 404 }
      )
    }

    let updateData: any = {
      updated_at: new Date().toISOString()
    }

    switch (action) {
      case 'pause':
        if (!['processing', 'enriching'].includes(importProgress.status)) {
          return NextResponse.json(
            { error: 'Can only pause active imports' },
            { status: 400 }
          )
        }
        updateData.status = 'paused'
        updateData.metadata = {
          ...importProgress.metadata,
          paused_at: new Date().toISOString(),
          paused_reason: 'user_requested'
        }
        break

      case 'stop':
        if (['completed', 'failed'].includes(importProgress.status)) {
          return NextResponse.json(
            { error: 'Import already finished' },
            { status: 400 }
          )
        }
        updateData.status = 'failed'
        updateData.error_message = 'Import stopped by user'
        updateData.completed_at = new Date().toISOString()
        updateData.metadata = {
          ...importProgress.metadata,
          stopped_at: new Date().toISOString(),
          stopped_reason: 'user_requested'
        }
        break

      case 'resume':
        if (importProgress.status !== 'paused') {
          return NextResponse.json(
            { error: 'Can only resume paused imports' },
            { status: 400 }
          )
        }
        
        // Resume the import by triggering bulk import again
        const response = await fetch(`${request.nextUrl.origin}/api/catalog/marisa/bulk-import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            importProgressId: importProgress.id,
            brandId: importProgress.brand_id,
            resumeFromPage: importProgress.current_page || 0
          })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to resume import')
        }

        updateData.status = 'processing'
        updateData.metadata = {
          ...importProgress.metadata,
          resumed_at: new Date().toISOString()
        }
        break
    }

    // Update import progress
    const { error: updateError } = await supabase
      .from('catalog_import_progress')
      .update(updateData)
      .eq('id', importProgressId)

    if (updateError) {
      throw new Error(`Failed to ${action} import: ${updateError.message}`)
    }

    return NextResponse.json({
      success: true,
      action,
      importProgressId
    })

  } catch (error) {
    console.error('Import control error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to control import' },
      { status: 500 }
    )
  }
}