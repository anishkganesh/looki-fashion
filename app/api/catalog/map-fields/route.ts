import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

export async function POST(request: NextRequest) {
  try {
    const { headers } = await request.json()
    
    if (!headers || !Array.isArray(headers) || headers.length === 0) {
      return NextResponse.json(
        { error: 'No headers provided' },
        { status: 400 }
      )
    }

    // Create prompt for OpenAI
    const prompt = `
      You are an expert at mapping CSV column headers to standard e-commerce product fields.
      
      Given these CSV headers: ${headers.join(', ')}
      
      Map them to these standard fields:
      - product_code (SKU, product ID, item number)
      - product_name (product title, name)
      - current_price (selling price, price, sale price)
      - original_price (regular price, list price, MSRP)
      - category (product category, type, breadcrumbs)
      - description (product description, details)
      - stock (inventory, quantity, stock level)
      - currency (currency code like USD, EUR)
      - brand (brand name, manufacturer)
      - color (color, colour)
      - size (size, dimensions)
      - material (material, fabric)
      
      Return a JSON object mapping standard field names to the actual CSV header names.
      Only include mappings where you find a matching header.
      If multiple headers could match, choose the most likely one.
      
      Example output:
      {
        "product_code": "sku",
        "product_name": "name",
        "current_price": "selling_price"
      }
    `

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert at mapping CSV headers to e-commerce fields. Always return valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })

    const mapping = JSON.parse(response.choices[0].message.content!)
    
    console.log('AI Field mapping result:', mapping)
    
    return NextResponse.json(mapping)
    
  } catch (error: any) {
    console.error('Field mapping error:', error)
    return NextResponse.json(
      { error: error.message || 'Field mapping failed' },
      { status: 500 }
    )
  }
} 