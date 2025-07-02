import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export async function POST(request: NextRequest) {
  try {
    const { data } = await request.json()
    
    if (!data || typeof data !== 'string') {
      return NextResponse.json(
        { error: 'Invalid data provided' },
        { status: 400 }
      )
    }

    // Use GPT-3.5-turbo to extract products
    const prompt = `Extract product information from the following data. Return a JSON array of products with these fields:
    - name (string)
    - price (number)
    - currency (string, default "USD")
    - color (string, optional)
    - size (string, optional)
    - sku (string, optional)
    - description (string, optional)
    - category (string, optional)
    - brand (string, optional)
    - availability (string, optional)
    
    The data might be HTML, JSON, or plain text. Extract as many products as you can find.
    
    Data:
    ${data.substring(0, 8000)} // Limit to avoid token limits
    
    Return ONLY a valid JSON array, no other text.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a product data extraction expert. Extract product information and return only valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    })

    const responseText = completion.choices[0].message.content || '[]'
    
    // Try to parse the response
    let products = []
    try {
      // Clean the response in case there's extra text
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        products = JSON.parse(jsonMatch[0])
      } else {
        products = JSON.parse(responseText)
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse extracted products', products: [] },
        { status: 200 }
      )
    }

    // Validate and clean products
    const validProducts = products
      .filter((p: any) => p && typeof p === 'object' && p.name)
      .map((p: any) => ({
        name: String(p.name || ''),
        price: parseFloat(p.price) || 0,
        currency: p.currency || 'USD',
        color: p.color || null,
        size: p.size || null,
        sku: p.sku || null,
        description: p.description || null,
        category: p.category || null,
        brand: p.brand || null,
        availability: p.availability || 'InStock'
      }))

    return NextResponse.json({ products: validProducts })

  } catch (error) {
    console.error('Preview error:', error)
    return NextResponse.json(
      { error: 'Failed to extract products', products: [] },
      { status: 500 }
    )
  }
} 