"use client"

import * as React from "react"
import { Loader2, PaperclipIcon, PenSquare, SendHorizonal, TrendingUpIcon, ImageIcon, Globe, Search, X, CheckCircle2, Brain, Sparkles, Copy, ThumbsUp, ThumbsDown, RefreshCw, Edit2, Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useChat as useChatContext } from "@/lib/chat-context"
import { useGlobalChat } from "@/lib/global-chat-context"
import { Toggle } from "@/components/ui/toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"

// Function to format message content
const formatMessageContent = (content: string): React.ReactNode => {
  if (!content) return null;
  
  // Handle lists with numbers (1., 2., etc.)
  content = content.replace(/(\d+)\.\s+([^\n]+)/g, '<li class="ml-5 list-decimal">$2</li>');
  
  // Handle bullet points
  content = content.replace(/[-•]\s+([^\n]+)/g, '<li class="ml-5 list-disc">$1</li>');
  
  // Convert ** bold ** to <strong>
  content = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Handle headers
  content = content.replace(/#{3}\s+(.*?)(?:\n|$)/g, '<h3 class="text-lg font-bold mt-3 mb-1">$1</h3>');
  content = content.replace(/#{2}\s+(.*?)(?:\n|$)/g, '<h2 class="text-xl font-bold mt-4 mb-2">$1</h2>');
  content = content.replace(/#{1}\s+(.*?)(?:\n|$)/g, '<h1 class="text-2xl font-bold mt-5 mb-3">$1</h1>');
  
  // Convert paragraphs (double newlines)
  content = content.replace(/\n\n/g, '</p><p class="mb-2">');
  
  // Wrap the content in a paragraph
  content = `<p class="mb-2">${content}</p>`;
  
  // Fix nested tags from replacements
  content = content.replace(/<p class="mb-2"><(h[1-3])/g, '<$1');
  content = content.replace(/<\/(h[1-3])><\/p>/g, '</$1>');
  
  // Fix list items
  content = content.replace(/<p class="mb-2"><li/g, '<li');
  content = content.replace(/<\/li><\/p>/g, '</li>');
  
  // Group adjacent list items into proper lists
  content = content.replace(/(<li class="ml-5 list-decimal">.*?<\/li>)+/g, '<ol class="list-decimal ml-5 mb-3">$&</ol>');
  content = content.replace(/(<li class="ml-5 list-disc">.*?<\/li>)+/g, '<ul class="list-disc ml-5 mb-3">$&</ul>');
  
  return <div dangerouslySetInnerHTML={{ __html: content }} />;
};

export function ChatSidebar({
  variant = "sidebar",
  isFullscreen = false,
  onClose
}: {
  variant?: "sidebar" | "inset" | "floating"
  isFullscreen?: boolean
  onClose?: () => void
}) {
  const [userAvatar, setUserAvatar] = React.useState("")
  const [isLoggedIn, setIsLoggedIn] = React.useState(true) // Set to true for demo
  const [isSettingName, setIsSettingName] = React.useState(false)
  const [tempUserName, setTempUserName] = React.useState("John")
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const scrollAreaRef = React.useRef<HTMLDivElement>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const { closeChat } = useChatContext()
  const [isSearching, setIsSearching] = React.useState(false)
  
  // Use global chat context
  const {
    messages,
    setMessages,
    currentChatId,
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
    createNewChat,
    loadChat,
    currentUser
  } = useGlobalChat()
  
  // Get username from current user
  const userName = currentUser?.name || currentUser?.email?.split('@')[0] || 'User'
  
  // Listen for new chat event
  React.useEffect(() => {
    const handleNewChat = () => {
      createNewChat()
    };
    
    window.addEventListener('newChat', handleNewChat);
    return () => window.removeEventListener('newChat', handleNewChat);
  }, [createNewChat]);
  
  // Listen for load chat event
  React.useEffect(() => {
    const handleLoadChat = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { chatId } = customEvent.detail;
      if (!chatId) return;
      
      await loadChat(chatId);
    };
    
    window.addEventListener('loadChat', handleLoadChat);
    return () => window.removeEventListener('loadChat', handleLoadChat);
  }, [loadChat]);
  
  // Listen for add context event
  React.useEffect(() => {
    const handleAddContext = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.context) {
        // Use functional update to avoid dependency on input
        setInput(prevInput => {
          // Check if this context is already in the input to prevent duplicates
          if (prevInput.includes(detail.context)) {
            return prevInput;
          }
          // Add context with proper spacing
          const separator = prevInput.trim() ? '\n\n' : '';
          return prevInput + separator + detail.context;
        });
      }
      
      // Auto-resize the textarea after adding context
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 250)}px`;
        }
      }, 0);
    };
    
    window.addEventListener('addChatContext', handleAddContext);
    return () => window.removeEventListener('addChatContext', handleAddContext);
  }, [setInput]);
  
  // Function to handle sending messages
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (input.trim() === "" || isLoading) return;
    
    // Add user message to the chat
    const userMessage = {
      id: Date.now().toString(),
      role: "user" as const,
      content: input,
      createdAt: new Date()
    };
    
    setMessages([...messages, userMessage]);
    setInput("");
    setIsLoading(true);
    
    // Store the current files and then reset the file state
    const currentUploadedFiles = [...uploadedFiles];
    setUploadedFiles([]);
    
    try {
      let response;
      
      // If image generation is active
      if (isGeneratingImage) {
        console.log("Sending image generation request");
        // Call the API with image tool parameter
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            tool: 'image',
          }),
        });
      }
      // If web search is active
      else if (isSearchingWeb) {
        setIsSearching(true);
        
        console.log("Sending web search request");
        // First perform a web search
        const searchQuery = userMessage.content;
        const searchResponse = await fetch('/api/web-search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: searchQuery,
          }),
        });
        
        if (!searchResponse.ok) {
          throw new Error('Failed to perform web search');
        }
        
        const searchData = await searchResponse.json();
        setSearchResults(searchData.results);
        setIsSearching(false);
        
        // Now call the OpenAI API with the search results
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            webSearch: { results: searchData.results },
          }),
        });
      }
      // If file is uploaded
      else if (currentUploadedFiles.length > 0) {
        console.log("Sending file analysis request");
        
        const fileContents = await Promise.all(currentUploadedFiles.map(async (file) => {
          if (file.content) {
            return {
              fileName: file.file.name,
              fileType: file.file.type,
              fileContent: file.content
            };
          }
          return null;
        }));
        
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            fileContents: fileContents.filter(Boolean) as any[],
          }),
        });
      } 
      // Default chat completion case
      else {
        console.log("Sending regular chat request");
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
          }),
        });
      }
      
      console.log("API Response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log("Response data:", responseData);
      
      // Add the assistant's response to the chat
      setMessages([...messages, userMessage, {
        id: responseData.id || Date.now().toString(),
        role: responseData.role || "assistant",
        content: responseData.content || "I'm not sure how to respond to that.",
        createdAt: responseData.createdAt ? new Date(responseData.createdAt) : new Date()
      }]);
    } catch (error) {
      console.error("Error sending message:", error);
      // Add error message
      setMessages([...messages, userMessage, {
        id: Date.now().toString(),
        role: "assistant",
        content: "I'm sorry, there was an error processing your request. Please try again.",
        createdAt: new Date()
      }]);
    } finally {
      setIsLoading(false);
      setIsGeneratingImage(false);
      setIsSearchingWeb(false);
      setSearchResults(null);
    }
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };
  
  // Handle input change and auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    setInput(textarea.value);
    
    // Auto-resize
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  React.useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleNameSubmit = () => {
    if (tempUserName.trim() !== "") {
      setIsLoggedIn(true)
    }
    setIsSettingName(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      const form = e.currentTarget.form
      if (form) form.requestSubmit()
    }
  }

  const handleFileSelect = () => {
    fileInputRef.current?.click()
  }

  const handleAttachmentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    
    // Check if we already have 5 files
    if (uploadedFiles.length + files.length > 5) {
      alert('You can only upload up to 5 files at a time.')
      return
    }
    
    // Process all selected files
    const newFiles = Array.from(files)
    const processedFiles: Array<{file: File, content: string | null}> = []
    
    for (const file of newFiles) {
      try {
        let content: string | null = null
        
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
          // For images and PDFs, create base64
          const reader = new FileReader()
          content = await new Promise((resolve) => {
            reader.onload = (event) => resolve(event.target?.result as string)
            reader.readAsDataURL(file)
          })
        } else {
          // For text files, read as text
          content = await file.text()
        }
        
        processedFiles.push({ file, content })
      } catch (error) {
        console.error('Error reading file:', error)
        alert(`Could not read file: ${file.name}`)
      }
    }
    
    setUploadedFiles([...uploadedFiles, ...processedFiles])
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  const removeFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index))
  }
  
  // Handle image generation button click
  const handleImageGenerationClick = () => {
    setIsGeneratingImage(true)
    setIsSearchingWeb(false)
  }
  
  // Handle web search button click
  const handleWebSearchClick = () => {
    setIsSearchingWeb(!isSearchingWeb)
    setIsGeneratingImage(false)
  }

  const [hoveredMessageId, setHoveredMessageId] = React.useState<string | null>(null)
  const [editingMessageId, setEditingMessageId] = React.useState<string | null>(null)
  const [editedContent, setEditedContent] = React.useState("")
  const [copiedMessageId, setCopiedMessageId] = React.useState<string | null>(null)

  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (error) {
      toast.error("Failed to copy")
    }
  }

  const handleEditMessage = (message: any) => {
    setEditingMessageId(message.id)
    setEditedContent(message.content)
  }

  const handleSaveEdit = async (messageId: string) => {
    // Find the index of the edited message
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    // Update the message content directly
    const updatedMessages = [...messages]
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      content: editedContent
    }

    // Remove all messages after the edited one
    const newMessages = updatedMessages.slice(0, messageIndex + 1)
    setMessages(newMessages)
    setEditingMessageId(null)
    
    // Now trigger a regeneration from this point
    setIsLoading(true)
    
    try {
      // Get the conversation up to this point
      const conversationMessages = newMessages.filter(m => m.role !== 'system')
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationMessages,
        }),
      })
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }
      
      const responseData = await response.json()
      
      // Add the assistant's response
      setMessages([...newMessages, {
        id: responseData.id || Date.now().toString(),
        role: responseData.role || "assistant",
        content: responseData.content || "I'm not sure how to respond to that.",
        createdAt: responseData.createdAt ? new Date(responseData.createdAt) : new Date()
      }])
    } catch (error) {
      console.error("Error regenerating response:", error)
      setMessages([...newMessages, {
        id: Date.now().toString(),
        role: "assistant",
        content: "I'm sorry, there was an error processing your request. Please try again.",
        createdAt: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditedContent("")
  }

  const handleRegenerate = async (messageIndex: number) => {
    // Get the actual message from the filtered list
    const filteredMessages = messages.filter(m => m.role !== 'system')
    const targetMessage = filteredMessages[messageIndex]
    
    if (!targetMessage || targetMessage.role !== 'assistant') return
    
    // Find the index in the full messages array
    const fullMessageIndex = messages.findIndex(m => m.id === targetMessage.id)
    if (fullMessageIndex === -1) return
    
    // Remove this assistant message and all messages after it
    const newMessages = messages.slice(0, fullMessageIndex)
    setMessages(newMessages)
    setIsLoading(true)
    
    try {
      // Get the conversation up to this point (excluding system messages)
      const conversationMessages = newMessages.filter(m => m.role !== 'system')
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: conversationMessages,
        }),
      })
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }
      
      const responseData = await response.json()
      
      // Add the new assistant response
      setMessages([...newMessages, {
        id: responseData.id || Date.now().toString(),
        role: responseData.role || "assistant",
        content: responseData.content || "I'm not sure how to respond to that.",
        createdAt: responseData.createdAt ? new Date(responseData.createdAt) : new Date()
      }])
    } catch (error) {
      console.error("Error regenerating response:", error)
      setMessages([...newMessages, {
        id: Date.now().toString(),
        role: "assistant",
        content: "I'm sorry, there was an error regenerating the response. Please try again.",
        createdAt: new Date()
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleThumbsUp = async (messageId: string) => {
    try {
      // Send feedback to backend
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          chat_id: currentChatId,
          feedback: 'thumbs_up'
        })
      })
      toast.success("Thanks for your feedback!")
    } catch (error) {
      console.error('Failed to save feedback:', error)
    }
  }

  const handleThumbsDown = async (messageId: string) => {
    try {
      // Send feedback to backend
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_id: messageId,
          chat_id: currentChatId,
          feedback: 'thumbs_down'
        })
      })
      toast.info("Thanks for your feedback. We'll improve!")
    } catch (error) {
      console.error('Failed to save feedback:', error)
    }
  }

  // Login view when user is not logged in
  if (!isLoggedIn) {
    return (
      <div className={cn(
        "flex flex-col h-full font-sans bg-background items-center justify-center",
        isFullscreen && "pt-12"
      )}>
        <div className="w-full max-w-md space-y-4 p-6">
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <TrendingUpIcon className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold mb-1">Sign in to Looki Chat</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Get personalized trend intelligence for your products
            </p>
          </div>

          <div className="space-y-3">
            <Button
              variant="outline" 
              className="w-full py-6 flex items-center justify-center gap-2 text-base"
              onClick={() => setIsSettingName(true)}
            >
              <PenSquare className="h-5 w-5" />
              {isSettingName ? "Enter your name" : "Continue with username"}
            </Button>

            {isSettingName && (
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tempUserName}
                    onChange={(e) => setTempUserName(e.target.value)}
                    placeholder="Enter your name"
                    className="flex-1 h-10 px-3 border rounded-md bg-background"
                    autoFocus
                  />
                  <Button onClick={handleNameSubmit}>Continue</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full font-sans">
      {!isFullscreen && (
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <TrendingUpIcon className="h-4 w-4 text-primary" />
            <span className="text-base font-medium">Looki AI Intelligence</span>
          </div>
        </div>
      )}
      
      {/* Web search results display */}
      {searchResults && (
        <div className="px-4 py-2 bg-muted/30 border-b">
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-medium flex items-center gap-1">
              <Search className="h-3.5 w-3.5" />
              Web Search Results
            </div>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSearchResults(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-2 text-xs">
            {searchResults.map((result, index) => (
              <div key={index} className="pb-2 border-b border-border/40 last:border-0">
                <div className="font-medium text-blue-600">{result.title}</div>
                <div className="text-muted-foreground line-clamp-2 mt-0.5">{result.snippet}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Loading indicator for web search */}
      {isSearching && (
        <div className="px-4 py-3 bg-muted/30 border-b flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Searching the web...</span>
        </div>
      )}
      
      <ScrollArea 
        className={cn(
          "flex-1", 
          isFullscreen ? "px-4 md:px-0 max-w-3xl mx-auto w-full" : "p-4"
        )} 
        ref={scrollAreaRef}
      >
        <div className="flex flex-col gap-4 pb-2 pt-4">
          {messages.filter(message => message.role !== "system").map((message, index, filteredMessages) => {
            const isLatestMessage = index === filteredMessages.length - 1
            const showActions = isLatestMessage || hoveredMessageId === message.id
            
            return (
              <div
                key={message.id}
                className={cn(
                  "group relative flex gap-3 animate-in fade-in-0 slide-in-from-bottom-3 duration-200",
                  message.role === "user" ? "flex-row-reverse" : ""
                )}
                onMouseEnter={() => setHoveredMessageId(message.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
              >
                <Avatar className="flex-shrink-0 w-8 h-8">
                  {message.role === "user" ? (
                    <>
                      <AvatarImage src={userAvatar} alt={userName} />
                      <AvatarFallback className="bg-primary/10 text-primary">{userName ? userName[0] : "U"}</AvatarFallback>
                    </>
                  ) : (
                    <>
                      <AvatarImage src="/chatbot-avatar.png" alt="Assistant" />
                      <AvatarFallback className="bg-primary/10">
                        <TrendingUpIcon className="h-4 w-4 text-primary" />
                      </AvatarFallback>
                    </>
                  )}
                </Avatar>
                <div className="flex flex-col gap-1 flex-1 max-w-[80%]">
                  <div 
                    className={cn(
                      "py-1.5 px-3.5 rounded-lg text-base shadow-sm",
                      message.role === "user" 
                        ? "bg-primary text-primary-foreground ml-auto" 
                        : "bg-muted"
                    )}
                  >
                    {editingMessageId === message.id ? (
                      <div className="flex flex-col gap-2">
                        <Textarea
                          value={editedContent}
                          onChange={(e) => setEditedContent(e.target.value)}
                          className={cn(
                            "min-h-[60px] resize-none",
                            "bg-background/10 backdrop-blur-sm",
                            "border-primary/20 focus:border-primary/40",
                            "text-primary-foreground placeholder:text-primary-foreground/60"
                          )}
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            className="text-primary-foreground/80 hover:text-primary-foreground"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleSaveEdit(message.id)}
                          >
                            Save & Send
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Support for markdown content including images */}
                        {message.content.startsWith("![Generated image]") ? (
                          <div>
                            <div className="mb-1 text-sm">Here's the image I generated:</div>
                            <img 
                              src={message.content.match(/\((.*?)\)/)?.[1] || ''} 
                              alt="Generated image" 
                              className="rounded-md max-w-full"
                              style={{ maxHeight: '300px' }}
                            />
                          </div>
                        ) : (
                          <div className="formatted-content">
                            {formatMessageContent(message.content)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Message Actions - Always visible for latest message */}
                  {showActions && editingMessageId !== message.id && (
                    <div className={cn(
                      "flex gap-0.5 mt-1 transition-all duration-200",
                      message.role === "user" ? "justify-end" : "justify-start",
                      isLatestMessage ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    )}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 hover:bg-muted"
                              onClick={() => handleCopyMessage(message.content, message.id)}
                            >
                              {copiedMessageId === message.id ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">Copy</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {message.role === "user" ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-muted"
                                onClick={() => handleEditMessage(message)}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">Edit</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 hover:bg-muted"
                                  onClick={() => handleThumbsUp(message.id)}
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="text-xs">Good response</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 hover:bg-muted"
                                  onClick={() => handleThumbsDown(message.id)}
                                >
                                  <ThumbsDown className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="text-xs">Bad response</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 hover:bg-muted"
                                  onClick={() => handleRegenerate(index)}
                                >
                                  <RefreshCw className="h-3 w-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="text-xs">Regenerate</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          
          {isLoading && (
            <div className="flex gap-3 animate-in fade-in-0 duration-200">
              <Avatar className="flex-shrink-0 w-8 h-8">
                <AvatarImage src="/chatbot-avatar.png" alt="Assistant" />
                <AvatarFallback className="bg-primary/10">
                  <TrendingUpIcon className="h-4 w-4 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <div className="flex items-center py-3 px-4 rounded-lg bg-muted shadow-sm">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm text-muted-foreground animate-pulse">
                      {isSearchingWeb ? "Searching the web..." : 
                       isGeneratingImage ? "Generating image..." :
                       "Thinking..."}
                    </span>
                  </div>
                </div>
                {/* Step-by-step thinking indicators */}
                <div className="flex flex-col gap-1 ml-12 text-xs text-muted-foreground">
                  {isSearchingWeb && searchResults === null && (
                    <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                      <Search className="w-3 h-3" />
                      <span>Searching relevant sources...</span>
                    </div>
                  )}
                  {isSearchingWeb && searchResults !== null && (
                    <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span>Found {searchResults.length} results</span>
                    </div>
                  )}
                  {isGeneratingImage && (
                    <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                      <ImageIcon className="w-3 h-3" />
                      <span>Creating visual representation...</span>
                    </div>
                  )}
                  {!isSearchingWeb && !isGeneratingImage && (
                    <>
                      <div className="flex items-center gap-2 animate-in slide-in-from-left-2">
                        <Brain className="w-3 h-3" />
                        <span>Analyzing your request...</span>
                      </div>
                      <div className="flex items-center gap-2 animate-in slide-in-from-left-2 delay-150">
                        <Sparkles className="w-3 h-3" />
                        <span>Generating response...</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className={cn(
        "px-4 py-3 border-t bg-background",
        isFullscreen && "pb-6"
      )}>
        {/* Tool indicators */}
        {(isGeneratingImage || isSearchingWeb || uploadedFiles.length > 0) && (
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            {isGeneratingImage && (
              <div className="text-xs bg-blue-500/10 text-blue-500 py-1 px-2 rounded-full flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                <span>Image Generation</span>
              </div>
            )}
            {isSearchingWeb && (
              <div className="text-xs bg-green-500/10 text-green-500 py-1 px-2 rounded-full flex items-center gap-1">
                <Globe className="h-3 w-3" />
                <span>Web Search</span>
              </div>
            )}
            {uploadedFiles.map((uploadedFile, index) => (
              <div 
                key={index}
                className={cn(
                  "text-xs py-1 px-2 rounded-full flex items-center gap-1",
                  uploadedFile.file.type.startsWith('image/') ? "bg-orange-500/10 text-orange-500" :
                  uploadedFile.file.type === 'application/pdf' ? "bg-red-500/10 text-red-500" :
                  uploadedFile.file.type === 'application/json' ? "bg-purple-500/10 text-purple-500" :
                  "bg-blue-500/10 text-blue-500"
                )}
              >
                <PaperclipIcon className="h-3 w-3" />
                <span>
                  {uploadedFile.file.name.length > 15 
                    ? uploadedFile.file.name.substring(0, 12) + '...' 
                    : uploadedFile.file.name}
                </span>
                <button 
                  onClick={() => removeFile(index)}
                  className={cn(
                    "ml-1",
                    uploadedFile.file.type.startsWith('image/') ? "text-orange-500 hover:text-orange-700" :
                    uploadedFile.file.type === 'application/pdf' ? "text-red-500 hover:text-red-700" :
                    uploadedFile.file.type === 'application/json' ? "text-purple-500 hover:text-purple-700" :
                    "text-blue-500 hover:text-blue-700"
                  )}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className={cn(
          "relative",
          isFullscreen && "max-w-3xl mx-auto"
        )}>
          <div className="relative rounded-md overflow-hidden border border-input focus-within:ring-1 focus-within:ring-ring">
            <div className="flex flex-col">
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleAttachmentChange}
                accept=".txt,.md,.json,.csv,.html,.xml,.js,.ts,.jsx,.tsx,.css,.py,.png,.jpg,.jpeg,.pdf"
                multiple
              />
              
              {/* Tool buttons positioned at top */}
              <div className="flex gap-1 p-1 pb-0">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        type="button" 
                        variant="ghost"
                        size="icon"
                        onClick={handleFileSelect}
                        className="h-8 w-8 rounded-full bg-transparent hover:bg-muted"
                      >
                        <PaperclipIcon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Upload files (max 5)</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        type="button" 
                        variant="ghost"
                        size="icon"
                        onClick={handleImageGenerationClick}
                        className={cn(
                          "h-8 w-8 rounded-full bg-transparent hover:bg-muted",
                          isGeneratingImage && "bg-blue-500/10 text-blue-500"
                        )}
                      >
                        <ImageIcon className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Generate image</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        type="button" 
                        variant="ghost"
                        size="icon"
                        onClick={handleWebSearchClick}
                        className={cn(
                          "h-8 w-8 rounded-full bg-transparent hover:bg-muted",
                          isSearchingWeb && "bg-green-500/10 text-green-500"
                        )}
                      >
                        <Globe className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Web search</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isGeneratingImage 
                  ? "Describe the image you want to generate..." 
                  : "Ask me anything..."}
                className="px-3 pr-12 min-h-[69px] max-h-[250px] border-0 resize-none py-2 bg-background shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 align-top text-2xl"
                disabled={isLoading}
              />
            </div>
            <Button 
              type="submit" 
              size="icon" 
              disabled={input.trim() === "" || isLoading}
              className="absolute right-1 bottom-2 h-10 w-10 rounded-full transition-opacity duration-200 bg-transparent hover:bg-transparent"
              data-state={input.trim() === "" || isLoading ? "disabled" : "active"}
            >
              <SendHorizonal className="h-5 w-5 text-primary" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
} 