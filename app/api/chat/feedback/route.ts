import { NextResponse } from 'next/server'
import { supabaseService } from '@/lib/supabase-service'

export async function POST(request: Request) {
  try {
    const { message_id, chat_id, feedback } = await request.json()
    
    if (!message_id || !chat_id || !feedback) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Insert feedback into the database
    const { data, error } = await supabaseService
      .from('chat_feedback')
      .insert({
        message_id,
        chat_id,
        feedback,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error saving feedback:', error)
      return NextResponse.json(
        { error: 'Failed to save feedback' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error in feedback API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 