import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  try {
    const { chatId, title, messages, userEmail } = await req.json();
    
    if (!chatId || !messages) {
      return NextResponse.json(
        { error: 'Chat ID and messages are required' },
        { status: 400 }
      );
    }
    
    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Try to get the email from the request or session
    let email = userEmail;
    
    if (!email) {
      // Try to get from session
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (user?.email) {
        email = user.email;
      }
    }
    
    if (!email) {
      console.error('No email found for saving chat');
      return NextResponse.json(
        { error: 'User email not found' },
        { status: 401 }
      );
    }
    
    console.log('Saving chat for email:', email);
    
    // Get user data with chat history
    const { data: userData, error: userError } = await supabase
      .from('usr')
      .select('email, chat_history')
      .eq('email', email)
      .single();
    
    if (userError || !userData) {
      console.error('User not found in usr table:', userError);
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }
    
    // Get existing chat history or initialize
    const existingHistory = userData.chat_history || [];
    
    // Check if chat already exists
    const existingChatIndex = existingHistory.findIndex((chat: any) => chat.id === chatId);
    
    const chatData = {
      id: chatId,
      title: title || messages[0]?.content || 'New Chat',
      messages: messages,
      createdAt: existingChatIndex >= 0 ? existingHistory[existingChatIndex].createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Update or add chat
    let updatedHistory;
    if (existingChatIndex >= 0) {
      updatedHistory = [...existingHistory];
      updatedHistory[existingChatIndex] = chatData;
    } else {
      updatedHistory = [chatData, ...existingHistory];
    }
    
    // Update the user's chat history
    const { data: updateData, error: updateError } = await supabase
      .from('usr')
      .update({ chat_history: updatedHistory })
      .eq('email', email)
      .select();
    
    if (updateError) {
      console.error('Error updating chat history:', updateError);
      return NextResponse.json(
        { error: 'Failed to save chat history' },
        { status: 500 }
      );
    }
    
    console.log('Chat saved successfully for user:', email);
    return NextResponse.json({ 
      success: true, 
      chatId,
      savedCount: updatedHistory.length 
    });
    
  } catch (error) {
    console.error('Error in save chat API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 