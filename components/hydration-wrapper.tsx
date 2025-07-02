"use client"

import * as React from "react"

export function HydrationWrapper({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Suppress hydration warnings
  React.useEffect(() => {
    const originalError = console.error
    console.error = (...args) => {
      if (
        typeof args[0] === 'string' &&
        (args[0].includes('Hydration failed') ||
         args[0].includes('Text content does not match') ||
         args[0].includes('did not match'))
      ) {
        return
      }
      originalError.apply(console, args)
    }
    return () => {
      console.error = originalError
    }
  }, [])

  if (!mounted) {
    return <>{fallback || null}</>
  }

  return <>{children}</>
} 