"use client"

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import '../lib/i18n'

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  
  useEffect(() => {
    // Ensure i18n is initialized on client side
    import('../lib/i18n')
  }, [])

  useEffect(() => {
    // Update the html lang attribute when language changes
    document.documentElement.lang = i18n.language
  }, [i18n.language])

  return <>{children}</>
} 