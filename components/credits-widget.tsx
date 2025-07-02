"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Coins, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useRequireAuth } from "@/lib/auth-utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

// Credit costs for operations
export const CREDIT_COSTS = {
  trend_agent: 50,
  recommendations: 30,
  chat: 2,
  image_generation: 10,
  web_search: 5,
  file_analysis: 3,
}

export function CreditsWidget() {
  const { user } = useRequireAuth()
  const [credits, setCredits] = React.useState<number>(0)
  const [loading, setLoading] = React.useState(true)
  const maxCredits = 1000

  // Fetch user credits
  const fetchCredits = React.useCallback(async () => {
    if (!user?.email) return

    try {
      const { data, error } = await supabase
        .from('usr')
        .select('credits')
        .eq('email', user.email)
        .single()

      if (data) {
        setCredits(data.credits || 0)
      }
    } catch (error) {
      console.error('Error fetching credits:', error)
    } finally {
      setLoading(false)
    }
  }, [user])

  // Initial fetch
  React.useEffect(() => {
    fetchCredits()
  }, [fetchCredits])

  // Listen for credit updates
  React.useEffect(() => {
    const handleCreditUpdate = () => {
      fetchCredits()
    }

    window.addEventListener('creditsUpdated', handleCreditUpdate)
    return () => {
      window.removeEventListener('creditsUpdated', handleCreditUpdate)
    }
  }, [fetchCredits])

  // Set up real-time subscription
  React.useEffect(() => {
    if (!user?.email) return

    const subscription = supabase
      .channel('credits-changes')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'usr',
          filter: `email=eq.${user.email}`
        },
        (payload) => {
          if (payload.new && 'credits' in payload.new) {
            setCredits(payload.new.credits)
          }
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user])

  if (loading) {
    return null
  }

  const percentage = (credits / maxCredits) * 100
  const isLow = credits < 100
  const variant = isLow ? "destructive" : "secondary"

  return (
    <div className="w-full">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-3 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Coins className={`h-4 w-4 ${isLow ? 'text-destructive' : 'text-primary'}`} />
                <span className="text-sm font-medium">
                  {credits.toLocaleString()} / {maxCredits.toLocaleString()}
                </span>
                {isLow && <AlertCircle className="h-3 w-3 text-destructive" />}
              </div>
              <Progress 
                value={percentage} 
                className="h-1.5 mb-1"
              />
              <Badge variant={variant} className="text-xs w-full justify-center font-medium">
                {isLow ? 'Low Credits' : 'Credits Available'}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <div className="space-y-2">
              <p className="font-semibold">Credit Costs:</p>
              <ul className="text-sm space-y-1">
                <li>• Trend Agent: {CREDIT_COSTS.trend_agent} credits</li>
                <li>• Recommendations: {CREDIT_COSTS.recommendations} credits</li>
                <li>• Chat Message: {CREDIT_COSTS.chat} credits</li>
                <li>• Image Generation: {CREDIT_COSTS.image_generation} credits</li>
                <li>• Web Search: {CREDIT_COSTS.web_search} credits</li>
                <li>• File Analysis: {CREDIT_COSTS.file_analysis} credits</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Credits reset to 1,000 on the 1st of each month
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

// Helper function to check and deduct credits
export async function useCredits(
  userEmail: string, 
  operation: keyof typeof CREDIT_COSTS,
  description?: string
): Promise<{ success: boolean; message?: string; remainingCredits?: number }> {
  try {
    const cost = CREDIT_COSTS[operation]
    
    // Get current credits
    const { data: userData, error: fetchError } = await supabase
      .from('usr')
      .select('id, credits')
      .eq('email', userEmail)
      .single()

    if (fetchError || !userData) {
      return { success: false, message: 'Failed to fetch user data' }
    }

    if (userData.credits < cost) {
      return { 
        success: false, 
        message: `Insufficient credits. You need ${cost} credits but only have ${userData.credits}.` 
      }
    }

    // Deduct credits
    const newBalance = userData.credits - cost
    const { error: updateError } = await supabase
      .from('usr')
      .update({ credits: newBalance })
      .eq('id', userData.id)

    if (updateError) {
      return { success: false, message: 'Failed to update credits' }
    }

    // Log transaction
    await supabase
      .from('credit_transactions')
      .insert({
        user_id: userData.id,
        amount: -cost,
        balance_after: newBalance,
        operation_type: operation,
        description: description || `Used ${cost} credits for ${operation}`
      })

    // Emit event to update widget
    window.dispatchEvent(new Event('creditsUpdated'))

    return { success: true, remainingCredits: newBalance }
  } catch (error) {
    console.error('Error using credits:', error)
    return { success: false, message: 'An error occurred' }
  }
} 