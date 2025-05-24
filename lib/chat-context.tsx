"use client"

import React, { createContext, useContext, useState } from "react"

type ChatMode = "closed" | "sidebar" | "fullscreen"

interface ChatContextType {
  chatMode: ChatMode
  setChatMode: (mode: ChatMode) => void
  toggleChat: () => void
  closeChat: () => void
  openChat: (mode?: ChatMode) => void
  isOpen: boolean
  isFullscreen: boolean
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [chatMode, setChatMode] = useState<ChatMode>("closed")

  const toggleChat = () => {
    setChatMode(prev => {
      if (prev === "closed") return "sidebar"
      if (prev === "sidebar") return "fullscreen"
      return "closed"
    })
  }

  const closeChat = () => setChatMode("closed")
  
  const openChat = (mode: ChatMode = "sidebar") => setChatMode(mode)
  
  const isOpen = chatMode !== "closed"
  const isFullscreen = chatMode === "fullscreen"

  return (
    <ChatContext.Provider
      value={{
        chatMode,
        setChatMode,
        toggleChat,
        closeChat,
        openChat,
        isOpen,
        isFullscreen
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider")
  }
  return context
} 