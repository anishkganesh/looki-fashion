"use client"

import React from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console except for Chrome translate errors
    if (!error.message.includes('removeChild')) {
      console.error('Error caught by boundary:', error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      // Check if it's a Chrome translate error
      if (this.state.error?.message.includes('removeChild')) {
        // For Chrome translate errors, just re-render the children
        // Reset the error boundary
        setTimeout(() => {
          this.setState({ hasError: false, error: null })
        }, 0)
        return this.props.children
      }

      // For other errors, show an error message
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
} 