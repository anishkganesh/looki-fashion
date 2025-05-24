import { createClient } from '@supabase/supabase-js'
import { toast } from 'sonner'

// Simple in-memory trend scraper implementation
class TrendScraperWorker {
  private isRunning = false
  private intervalId: NodeJS.Timeout | null = null
  private lastRunTime: Date | null = null
  private nextRunTime: Date | null = null
  private supabase: any
  private testMode = false

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  setTestMode(enabled: boolean) {
    this.testMode = enabled
    // If worker is running, restart with new interval
    if (this.intervalId) {
      this.stop()
      this.start()
    }
  }

  async checkStatus() {
    try {
      const response = await fetch(`/api/trends/scrape?testMode=${this.testMode}`, {
        method: 'GET',
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.lastRun) {
          this.lastRunTime = new Date(data.lastRun)
        }
        if (data.nextRun) {
          this.nextRunTime = new Date(data.nextRun)
        }
        return data
      }
    } catch (error) {
      console.error('Error checking scraper status:', error)
    }
    return null
  }

  async checkAndRunIfNeeded() {
    const status = await this.checkStatus()
    if (status && status.canRunNow) {
      toast.info('Running scheduled trend agent...')
      await this.scrapeAndUpdateTrends(false)
    } else if (status && status.nextRun) {
      const nextRun = new Date(status.nextRun)
      const timeUntil = nextRun.getTime() - Date.now()
      const hours = Math.floor(timeUntil / (1000 * 60 * 60))
      const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60))
      
      toast.info(
        `Next auto-run in ${hours}h ${minutes}m (${nextRun.toLocaleTimeString()})`,
        { duration: 5000 }
      )
    }
  }

  async scrapeAndUpdateTrends(isManual = false) {
    if (this.isRunning) {
      console.log('Trend agent already running, skipping...')
      return
    }

    this.isRunning = true
    console.log('Starting trend agent...')

    try {
      // Get current user's email from auth state
      let userEmail = null
      try {
        const authData = localStorage.getItem('supabase.auth.token')
        if (authData) {
          const parsed = JSON.parse(authData)
          userEmail = parsed?.currentSession?.user?.email
        }
      } catch (e) {
        console.log('Could not get user email from auth')
      }

      // Run the scraper via API route
      const response = await fetch('/api/trends/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          autoCheck: !isManual,
          testMode: this.testMode,
          userEmail
        })
      })

      if (!response.ok) {
        throw new Error('Failed to run trend agent')
      }

      const result = await response.json()
      console.log('Trend agent completed:', result)
      
      // Show toast notification
      if (result.success) {
        if (result.skipped) {
          // Auto-check was skipped because not enough time has passed
          toast.info(result.message, { duration: 5000 })
        } else {
          // Scraping completed successfully
          toast.success(
            `${isManual ? 'Manual' : 'Auto'} trend agent completed! Found ${result.insertedTrends} new trends and updated ${result.updatedTrends} existing trends.`,
            { duration: 5000 }
          )
          
          // Show next run time
          if (result.nextRun) {
            this.nextRunTime = new Date(result.nextRun)
            setTimeout(() => {
              toast.info(result.nextRunMessage, { duration: 5000 })
            }, 1000)
          }
        }
      } else {
        toast.error(`${isManual ? 'Manual' : 'Auto'} trend agent failed: ` + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error running trend agent:', error)
      toast.error(`${isManual ? 'Manual' : 'Auto'} trend agent error: ` + (error instanceof Error ? error.message : 'Unknown error'))
    } finally {
      this.isRunning = false
    }
  }

  start(intervalHours = 3) {
    if (this.intervalId) {
      console.log('Agent already running')
      return
    }

    // Override interval for test mode
    const actualInterval = this.testMode ? 1 : intervalHours

    // Check and run if needed
    this.checkAndRunIfNeeded()

    // Then check every hour (or every minute in test mode)
    const checkInterval = this.testMode ? 60 * 1000 : 60 * 60 * 1000
    this.intervalId = setInterval(() => {
      this.checkAndRunIfNeeded()
    }, checkInterval)

    console.log(`Trend agent started, checking every ${this.testMode ? 'minute' : 'hour'}`)
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('Trend agent stopped')
    }
  }

  isActive() {
    return this.intervalId !== null
  }

  getNextRunTime() {
    return this.nextRunTime
  }
}

// Export singleton instance
export const trendWorker = new TrendScraperWorker() 