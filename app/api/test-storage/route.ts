import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // List buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    // List files in catalog-files bucket
    const { data: files, error: filesError } = await supabase.storage
      .from('catalog-files')
      .list()
    
    return NextResponse.json({
      buckets: buckets || [],
      bucketsError,
      files: files || [],
      filesError,
      catalogBucketExists: buckets?.some(b => b.name === 'catalog-files')
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message
    }, { status: 500 })
  }
} 