"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Define types
interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: Date;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
}

interface GlobalChatContextType {
  // Current chat state
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  currentChatId: string | null;
  setCurrentChatId: (id: string) => void;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  
  // Tool states
  isGeneratingImage: boolean;
  setIsGeneratingImage: (generating: boolean) => void;
  isSearchingWeb: boolean;
  setIsSearchingWeb: (searching: boolean) => void;
  searchResults: any[] | null;
  setSearchResults: (results: any[] | null) => void;
  uploadedFiles: any[];
  setUploadedFiles: (files: any[]) => void;
  
  // Chat history
  chatHistory: Chat[];
  setChatHistory: (history: Chat[]) => void;
  selectedChatId: string | null;
  setSelectedChatId: (id: string) => void;
  
  // Functions
  createNewChat: () => void;
  loadChat: (chatId: string) => Promise<void>;
  saveCurrentChat: () => Promise<void>;
  loadChatHistory: () => Promise<void>;
  
  // User info
  currentUser: any;
  setCurrentUser: (user: any) => void;
  
  // Brand context
  activeBrandContext: any;
  setActiveBrandContext: (brand: any) => void;
}

const GlobalChatContext = createContext<GlobalChatContextType | undefined>(undefined)

export function GlobalChatProvider({ children }: { children: React.ReactNode }) {
  // Initialize with system message
  const getInitialMessages = (brandContext: any = null): Message[] => {
    let systemContent = "You are a fashion analyst AI assistant with real-time web search capabilities. You can search the web for current fashion trends, analyze fashion-related files and images, generate fashion imagery, and provide up-to-date fashion industry insights. When web search is enabled, you have access to current information beyond your training data. You should never say you don't have access to current information or that your knowledge is limited to a certain date when web search is available. Instead, use the web search feature to find the most recent information.";
    
    if (brandContext) {
      systemContent += `\n\nCurrent Brand Context: You are analyzing for ${brandContext.brand_name}. ${brandContext.description || ''} 
Target Demographics: ${brandContext.target_gender || 'all genders'}, ages ${brandContext.target_age_min || 18}-${brandContext.target_age_max || 65}, ${brandContext.target_income_level || 'all'} income level.
Category: ${brandContext.category || 'fashion'}
Target Locations: ${brandContext.target_locations?.join(', ') || 'global'}
Target Lifestyle: ${brandContext.target_lifestyle?.join(', ') || 'general'}
Target Interests: ${brandContext.target_interests?.join(', ') || 'fashion'}

When providing recommendations, analysis, or insights, tailor them specifically to this brand's target market and positioning.`;
    }
    
    return [
      {
        id: "1",
        role: "system",
        content: systemContent
      },
      {
        id: "2",
        role: "assistant",
        content: "Hello! I'm your fashion industry assistant with real-time web search capabilities. I can help you with trend analysis, generate fashion images, analyze fashion-related files, and search the web for the latest fashion insights and trends from 2025 and beyond. How can I assist you today?"
      }
    ];
  };
  
  const initialMessages = getInitialMessages();

  // Current chat state
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [currentChatId, setCurrentChatId] = useState<string>('');
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  // Tool states
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Array<{file: File, content: string | null}>>([]);
  
  // Chat history
  const [chatHistory, setChatHistory] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  
  // User info
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Brand context
  const [activeBrandContext, setActiveBrandContext] = useState<any>(null);
  
  // Listen for brand context changes
  useEffect(() => {
    const handleBrandContextChange = (event: CustomEvent) => {
      setActiveBrandContext(event.detail.brand);
      
      // Update system message with new brand context
      const newMessages = getInitialMessages(event.detail.brand);
      setMessages(prev => {
        // Keep existing messages but update the system message
        const updatedMessages = [...prev];
        if (updatedMessages[0]?.role === 'system') {
          updatedMessages[0] = newMessages[0];
        }
        return updatedMessages;
      });
    };
    
    window.addEventListener('brandContextChanged', handleBrandContextChange as any);
    
    return () => {
      window.removeEventListener('brandContextChanged', handleBrandContextChange as any);
    };
  }, []);
  
  // Get current user on mount
  useEffect(() => {
    const getCurrentUser = async () => {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (user) {
        console.log("Current authenticated user:", user.email);
        setCurrentUser(user);
        
        // Also get the user data from the usr table
        const { data: userData, error: userError } = await supabase
          .from('usr')
          .select('*')
          .eq('email', user.email)
          .single();
          
        if (userData) {
          console.log("User data from usr table:", userData);
          setCurrentUser({ ...user, ...userData });
        }
      } else {
        console.log("No authenticated user found");
      }
    };
    
    getCurrentUser();
  }, []);
  
  // Initialize chat ID on mount
  useEffect(() => {
    if (!currentChatId) {
      setCurrentChatId(`chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    }
  }, []);
  
  // Load chat history on mount
  useEffect(() => {
    loadChatHistory();
  }, [currentUser]);
  
  // Save chat after each message (but not the initial messages)
  useEffect(() => {
    if (messages.length > 2 && currentChatId) {
      saveCurrentChat();
    }
  }, [messages, currentChatId]);
  
  const createNewChat = () => {
    // Generate new chat ID
    const newChatId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create placeholder in chat history
    const newChat: Chat = {
      id: newChatId,
      title: "New Chat",
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Add to chat history and select it
    setChatHistory(prev => [newChat, ...prev]);
    setSelectedChatId(newChatId);
    setCurrentChatId(newChatId);
    
    // Reset messages
    setMessages(initialMessages);
    setInput('');
    setUploadedFiles([]);
    setIsGeneratingImage(false);
    setIsSearchingWeb(false);
    setSearchResults(null);
  };
  
  const loadChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chat/load?chatId=${chatId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.chat) {
          setCurrentChatId(data.chat.id);
          setSelectedChatId(data.chat.id);
          
          // Restore messages (add system message back)
          const restoredMessages = [
            initialMessages[0], // System message
            ...data.chat.messages
          ];
          
          setMessages(restoredMessages);
          
          // Clear any active states
          setInput('');
          setUploadedFiles([]);
          setIsGeneratingImage(false);
          setIsSearchingWeb(false);
          setSearchResults(null);
        }
      }
    } catch (error) {
      console.error('Failed to load chat:', error);
    }
  };
  
  const saveCurrentChat = async () => {
    try {
      // Get title from first user message or use default
      const firstUserMessage = messages.find(m => m.role === 'user');
      const title = firstUserMessage?.content.substring(0, 50) || 'New Chat';
      
      const userEmail = currentUser?.email || 'john@example.com';
      console.log("Saving chat for user:", userEmail);
      
      const response = await fetch('/api/chat/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: currentChatId,
          title,
          messages: messages.filter(m => m.role !== 'system'), // Don't save system messages
          userEmail // Pass the user email explicitly
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error("Failed to save chat:", error);
      } else {
        // Update the chat in history if title changed
        setChatHistory(prev => prev.map(chat => 
          chat.id === currentChatId ? { ...chat, title, updatedAt: new Date().toISOString() } : chat
        ));
        
        // Dispatch event to update other components
        window.dispatchEvent(new CustomEvent('chatSaved'));
      }
    } catch (error) {
      console.error('Failed to save chat:', error);
    }
  };
  
  const loadChatHistory = async () => {
    try {
      const userEmail = currentUser?.email;
      if (!userEmail) {
        console.log("No user email available for loading chat history");
        return;
      }
      
      const response = await fetch(`/api/chat/load?userEmail=${userEmail}`);
      if (response.ok) {
        const data = await response.json();
        setChatHistory(data.chats || []);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };
  
  return (
    <GlobalChatContext.Provider
      value={{
        messages,
        setMessages,
        currentChatId,
        setCurrentChatId,
        input,
        setInput,
        isLoading,
        setIsLoading,
        isGeneratingImage,
        setIsGeneratingImage,
        isSearchingWeb,
        setIsSearchingWeb,
        searchResults,
        setSearchResults,
        uploadedFiles,
        setUploadedFiles,
        chatHistory,
        setChatHistory,
        selectedChatId,
        setSelectedChatId,
        createNewChat,
        loadChat,
        saveCurrentChat,
        loadChatHistory,
        currentUser,
        setCurrentUser,
        activeBrandContext,
        setActiveBrandContext
      }}
    >
      {children}
    </GlobalChatContext.Provider>
  )
}

export function useGlobalChat() {
  const context = useContext(GlobalChatContext)
  if (context === undefined) {
    throw new Error("useGlobalChat must be used within a GlobalChatProvider")
  }
  return context
} 