"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"

export function SiteHeader() {

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <SidebarTrigger />
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">Looki Trend Intelligence</h1>
      </div>
    </header>
  )
}
