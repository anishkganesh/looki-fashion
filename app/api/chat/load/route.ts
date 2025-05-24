import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');
    const userEmail = searchParams.get('userEmail');
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Get email from parameter or session
    let email = userEmail;
    
    if (!email) {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (user?.email) {
        email = user.email;
      }
    }
    
    if (!email) {
      console.error('No email found for loading chat');
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 401 }
      );
    }
    
    console.log('Loading chats for email:', email);
    
    // Get user data with chat history
    const { data: userData, error: userError } = await supabase
      .from('usr')
      .select('chat_history')
      .eq('email', email)
      .single();
    
    if (userError || !userData) {
      console.error('User not found:', userError);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    const chatHistory = userData.chat_history || [];
    
    // If specific chat ID is requested
    if (chatId) {
      const chat = chatHistory.find((c: any) => c.id === chatId);
      if (!chat) {
        return NextResponse.json(
          { error: 'Chat not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ chat });
    }
    
    // Return all chats (sorted by most recent)
    const sortedChats = chatHistory.sort((a: any, b: any) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    console.log(`Returning ${sortedChats.length} chats for user:`, email);
    return NextResponse.json({ chats: sortedChats });
    
  } catch (error) {
    console.error('Error in load chat API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 