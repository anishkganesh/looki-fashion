"use client"

import { useEffect, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

export function ChromeTranslateNotice() {
  const [isTranslating, setIsTranslating] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    // Check if Chrome translate is active
    const checkTranslate = () => {
      // Chrome adds a class to html element when translating
      const htmlElement = document.documentElement
      const isActive = htmlElement.classList.contains('translated-ltr') || 
                      htmlElement.classList.contains('translated-rtl') ||
                      document.querySelector('.skiptranslate') !== null

      setIsTranslating(isActive)
    }

    // Check initially
    checkTranslate()

    // Set up observer for changes
    const observer = new MutationObserver(checkTranslate)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true
    })

    return () => observer.disconnect()
  }, [])

  if (!isTranslating || isDismissed) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Alert className="border-yellow-600 bg-yellow-50 dark:bg-yellow-900/20">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="pr-8 text-yellow-800 dark:text-yellow-200">
          <strong>Chrome Translation Active</strong>
          <br />
          You're using Chrome's automatic translation. For the best experience, use our built-in language switcher (globe icon in the header) instead.
          <br />
          <span className="text-xs opacity-80">
            Some features may not work correctly with Chrome translate.
          </span>
        </AlertDescription>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1 h-6 w-6"
          onClick={() => setIsDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </Alert>
    </div>
  )
} 