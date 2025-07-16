import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

// Function to enhance prompts for realistic fashion photography
function enhancePrompt(originalPrompt: string, brandContext?: any): string {
  // Remove any futuristic or techno-style keywords
  let enhancedPrompt = originalPrompt
    .replace(/futuristic|techno|cyber|neon|holographic|sci-fi|digital art/gi, '')
    .trim()
  
  // Add realistic fashion photography modifiers
  const realisticModifiers = [
    'photorealistic',
    'professional fashion photography',
    'natural lighting',
    'high-end editorial',
    'commercial fashion shoot',
    'realistic textures and materials',
    'authentic fashion styling',
    'clean minimalist background',
    'professional model photography',
    'fashion magazine quality',
    'natural color grading',
    'authentic brand aesthetic',
    'no text',
    'no logos',
    'no watermarks',
    'no captions',
    'no typography'
  ]
  
  // Add brand-specific context if available
  if (brandContext) {
    const brandStyle = brandContext.style || 'contemporary'
    const pricePoint = brandContext.price_point || 'premium'
    
    enhancedPrompt += ` ${brandStyle} ${pricePoint} fashion brand aesthetic.`
  }
  
  // Ensure the prompt emphasizes realism and no text
  enhancedPrompt = `${enhancedPrompt}. ${realisticModifiers.join(', ')}. No digital art, no futuristic elements, no techno styling, no text overlays, no written words. Focus on authentic, wearable fashion with realistic materials and natural poses.`
  
  // Limit prompt length for DALL-E 3
  return enhancedPrompt.slice(0, 1000)
}

export async function POST(request: Request) {
  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const { prompt, brandContext } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Enhance the prompt for realistic fashion photography
    const enhancedPrompt = enhancePrompt(prompt, brandContext)
    
    console.log('Original prompt:', prompt)
    console.log('Enhanced prompt:', enhancedPrompt)

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'natural' // Always use natural style for realism
    })

    if (!response.data || response.data.length === 0) {
      return NextResponse.json(
        { error: 'No image generated' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      url: response.data[0].url,
      prompt_used: enhancedPrompt // Return the enhanced prompt for transparency
    })
  } catch (error: any) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate image' },
      { status: 500 }
    )
  }
} 