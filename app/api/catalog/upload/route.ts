import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    // Create service client for bypassing RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileName = formData.get('fileName') as string
    const brandId = formData.get('brandId') as string
    const userId = formData.get('userId') as string
    
    if (!file || !fileName || !brandId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Convert file to buffer
    const buffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(buffer)
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('catalog-files')
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false
      })
    
    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      )
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('catalog-files')
      .getPublicUrl(fileName)
    
    // Create catalog record
    const { data: catalogRecord, error: catalogError } = await supabase
      .from('catalog_uploads')
      .insert({
        brand_id: parseInt(brandId),
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        status: 'pending',
        uploaded_by: parseInt(userId)
      })
      .select()
      .single()
    
    if (catalogError) {
      console.error('Catalog record error:', catalogError)
      return NextResponse.json(
        { error: 'Failed to create catalog record' },
        { status: 500 }
      )
    }
    
    // Update brand catalog status
    await supabase
      .from('brands')
      .update({ 
        has_catalog_integrated: true,
        catalog_integrated_at: new Date().toISOString()
      })
      .eq('brand_id', parseInt(brandId))

    // Generate recommendations automatically
    try {
      const recommendationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'}/api/recommendations/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ brand_id: parseInt(brandId) })
      })

      if (!recommendationResponse.ok) {
        console.error('Failed to generate recommendations:', await recommendationResponse.text())
      } else {
        const recResult = await recommendationResponse.json()
        console.log('Recommendations generated:', recResult)
      }
    } catch (recError) {
      console.error('Error generating recommendations:', recError)
    }

    return NextResponse.json({
      success: true,
      uploadId: catalogRecord.id,
      publicUrl
    })
    
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json(
      { error: error.message || 'Upload failed' },
      { status: 500 }
    )
  }
} 