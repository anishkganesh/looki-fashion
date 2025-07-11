// Centralized AI configuration
export const AI_CONFIG = {
  // Model to use across all features
  model: 'gpt-4o' as const,
  
  // Temperature settings for different use cases
  temperature: {
    creative: 0.8,      // For campaign names, marketing copy
    analytical: 0.3,    // For trend analysis, calculations
    balanced: 0.6,      // For general use, recommendations
    structured: 0.2     // For structured data extraction
  },
  
  // Max tokens for different features
  maxTokens: {
    chat: 2000,
    campaigns: 1500,
    trends: 1000,
    inventory: 800,
    imagePrompt: 500
  },
  
  // System prompts for consistency
  systemPrompts: {
    fashionExpert: "You are an expert fashion retail analyst with deep knowledge of trends, inventory management, and marketing strategies. Provide data-driven insights while being creative and forward-thinking.",
    marketingStrategist: "You are a creative fashion marketing strategist. Create unique, compelling campaigns that leverage trends and product attributes. Be diverse in your suggestions and avoid repetitive naming patterns.",
    trendAnalyst: "You are a fashion trend analyst specializing in identifying emerging patterns and market opportunities. Provide actionable insights based on data.",
    inventoryOptimizer: "You are an inventory optimization specialist. Provide clear, actionable recommendations to maximize revenue and minimize waste."
  }
}

// Helper function to get model config for specific use case
export function getAIConfig(useCase: 'creative' | 'analytical' | 'balanced' | 'structured' = 'balanced') {
  return {
    model: AI_CONFIG.model,
    temperature: AI_CONFIG.temperature[useCase]
  }
} 