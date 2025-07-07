"use client"

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations directly as modules
const enTranslation = require('../locales/en/translation.json');
const ptTranslation = require('../locales/pt/translation.json');

const resources = {
  en: { translation: enTranslation },
  pt: { translation: ptTranslation }
};

// Only initialize if not already initialized
if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en',
      lng: 'en', // default language
      interpolation: {
        escapeValue: false // React already escapes values
      },
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage']
      }
    });
}

export default i18n; 