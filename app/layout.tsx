import "./globals.css"
import { GeistSans } from "geist/font/sans"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/lib/auth-context"
import { ChatProvider } from "@/lib/chat-context"
import { GlobalChatProvider } from "@/lib/global-chat-context"
import { CatalogImportProvider } from "@/lib/catalog-import-context"
import { CatalogImportProgress } from "@/components/catalog-import-progress"
import { CreditsWidget } from "@/components/credits-widget"
import { Toaster } from "@/components/ui/toaster"
import { cn } from "@/lib/utils"
import type { Metadata } from "next"

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000"

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Looki - Fashion Trend Intelligence Platform",
  description: "Transform your fashion business with AI-powered trend intelligence. Track emerging trends, optimize inventory, and boost sales with data-driven insights.",
  icons: {
    icon: [
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon.png', type: 'image/png' },
      { url: '/favicon.avif', type: 'image/avif' },
    ],
    shortcut: '/favicon.ico',
    apple: '/favicon.png',
  },
  openGraph: {
    title: "Looki - Fashion Trend Intelligence Platform",
    description: "Transform your fashion business with AI-powered trend intelligence",
    url: defaultUrl,
    siteName: "Looki",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Looki - Fashion Trend Intelligence Platform",
    description: "Transform your fashion business with AI-powered trend intelligence",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${GeistSans.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="/favicon.png" />
      </head>
      <body
        className={cn(
          "bg-background font-sans antialiased",
          GeistSans.variable
        )}
        suppressHydrationWarning={true}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <GlobalChatProvider>
              <CatalogImportProvider>
                <ChatProvider>
                  {children}
                </ChatProvider>
                <CatalogImportProgress />
                <CreditsWidget />
              </CatalogImportProvider>
            </GlobalChatProvider>
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
