"use client"

import { CatalogIntegrationForm } from "@/components/catalog-integration-form"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"

export default function CatalogIntegrationPage() {
  const router = useRouter()

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Integrate Your Catalog</h1>
        <p className="text-muted-foreground mt-2">
          Upload your product catalog or connect via API to start getting trend-based recommendations
        </p>
      </div>
      <CatalogIntegrationForm />
    </div>
  )
} 