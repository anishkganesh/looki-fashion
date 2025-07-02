"use client"

import * as React from "react"
import { Info, Calculator } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CalculationStep {
  label: string
  value: string | number
  formula?: string
}

interface CalculationTooltipProps {
  title: string
  value: string | number
  steps: CalculationStep[]
  description?: string
  className?: string
  size?: "sm" | "default"
}

export function CalculationTooltip({
  title,
  value,
  steps,
  description,
  className,
  size = "sm"
}: CalculationTooltipProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              size === "sm" ? "h-4 w-4 p-0" : "h-6 w-6 p-0",
              "hover:bg-transparent",
              className
            )}
          >
            <Info className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
            <span className="sr-only">Show calculation details</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          align="center" 
          sideOffset={5} 
          collisionPadding={10}
          avoidCollisions={true}
          className="w-80 p-4 z-50"
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <h4 className="font-semibold">{title}</h4>
            </div>
            
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            
            <div className="space-y-2">
              <div className="text-sm font-medium">Calculation Steps:</div>
              <div className="space-y-1.5">
                {steps.map((step, index) => (
                  <div key={index} className="text-sm">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-muted-foreground">{step.label}:</span>
                      <span className="font-mono font-medium">{step.value}</span>
                    </div>
                    {step.formula && (
                      <div className="text-xs text-muted-foreground font-mono ml-4 mt-0.5">
                        = {step.formula}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="pt-2 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Final Value:</span>
                <span className="font-mono font-bold text-base">{value}</span>
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Preset calculation formulas for common metrics
export const CALCULATION_FORMULAS = {
  momentum: {
    title: "Momentum Score",
    description: "Measures the current strength and velocity of a trend",
    getSteps: (data: any) => [
      { label: "Base Score", value: data.baseMomentum || 50, formula: "viral ? 75 : 50" },
      { label: "Today Bonus", value: data.todayBonus || 0, formula: "extracted today ? +15 : 0" },
      { label: "Source Multiplier", value: data.sourceCount || 1, formula: `${data.sourceCount} sources × 5` },
      { label: "Random Variance", value: data.variance || 5, formula: "random(0-10)" },
      { label: "Cap at Maximum", value: 100, formula: "min(total, 100)" }
    ]
  },
  velocity: {
    title: "Velocity Score",
    description: "Rate of growth or decline for the trend",
    getSteps: (data: any) => [
      { label: "Base Velocity", value: data.baseVelocity || 8, formula: "viral ? 15 : 8" },
      { label: "Source Boost", value: data.sourceBoost || 0, formula: `${data.sourceCount} × 3` },
      { label: "Random Factor", value: data.randomFactor || 2, formula: "random(0-5)" },
      { label: "Cap at Maximum", value: 30, formula: "min(total, 30)" }
    ]
  },
  adoption: {
    title: "Adoption Rate",
    description: "Percentage of target market currently engaged with the trend",
    getSteps: (data: any) => [
      { label: "Base Adoption", value: data.baseAdoption || "20%", formula: "has influencers ? 40% : 20%" },
      { label: "Momentum Factor", value: data.momentumFactor || "0%", formula: `momentum ÷ 100 × 40%` },
      { label: "Cap at Maximum", value: "100%", formula: "min(total, 100%)" }
    ]
  },
  socialReach: {
    title: "Social Reach",
    description: "Estimated number of people exposed to the trend",
    getSteps: (data: any) => [
      { label: "Base Reach", value: data.baseReach?.toLocaleString() || "50,000", formula: "default: 50k" },
      { label: "Platform Multiplier", value: data.platform || "none", formula: "TikTok: 20x, Instagram: 15x" },
      { label: "Momentum Boost", value: data.momentumBoost?.toLocaleString() || "0", formula: "momentum × 10,000" },
      { label: "Random Variance", value: data.variance?.toLocaleString() || "0", formula: "random(0-100k)" }
    ]
  },
  risk: {
    title: "Risk Score",
    description: "Likelihood of trend failing or not converting",
    getSteps: (data: any) => [
      { label: "Base Risk", value: data.baseRisk || "20%", formula: "has brands ? 10% : 20%" },
      { label: "Random Factor", value: data.randomFactor || "10%", formula: "random(0-10%)" },
      { label: "Total Risk", value: data.total || "30%", formula: "base + random" }
    ]
  },
  conversion: {
    title: "Conversion Impact",
    description: "Expected impact on sales conversion rates",
    getSteps: (data: any) => [
      { label: "Base Conversion", value: data.baseConversion || "8%", formula: "has price ? 15% : 8%" },
      { label: "Momentum Impact", value: data.momentumImpact || "0%", formula: "momentum ÷ 100 × 20%" },
      { label: "Adoption Impact", value: data.adoptionImpact || "0%", formula: "adoption × 10%" },
      { label: "Cap at Maximum", value: "50%", formula: "min(total, 50%)" }
    ]
  },
  peakPrediction: {
    title: "Peak Date Prediction",
    description: "When the trend is expected to reach maximum popularity",
    getSteps: (data: any) => [
      { label: "Current Date", value: data.currentDate || "Today" },
      { label: "Days to Peak", value: data.daysToPeak || 14, formula: data.formula || "viral ? 7 : 14 days" },
      { label: "Variance", value: data.variance || "±3", formula: "random(-3 to +3) days" },
      { label: "Final Date", value: data.finalDate || "2 weeks" }
    ]
  }
}