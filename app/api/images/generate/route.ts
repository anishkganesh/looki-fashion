import { NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

export async function POST(request: Request) {
  try {
    // Check if API key is configured
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const { prompt } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: prompt.slice(0, 1000), // DALL-E 3 has a 1000 char limit
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      style: 'natural'
    })

    if (!response.data || response.data.length === 0) {
      return NextResponse.json(
        { error: 'No image generated' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      url: response.data[0].url 
    })
  } catch (error: any) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate image' },
      { status: 500 }
    )
  }
} 