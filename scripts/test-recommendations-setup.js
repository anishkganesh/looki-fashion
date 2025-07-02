#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

console.log('🔍 Testing Recommendations Setup...\n')

// 1. Check environment variables
console.log('1️⃣ Checking Environment Variables:')
console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✅ Set' : '❌ Missing')
console.log('   NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing')
console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing')

if (!process.env.OPENAI_API_KEY) {
  console.log('\n❌ ERROR: OPENAI_API_KEY is not set in .env.local')
  console.log('   Please add: OPENAI_API_KEY=your_api_key_here')
  process.exit(1)
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log('\n❌ ERROR: SUPABASE_SERVICE_ROLE_KEY is not set in .env.local')
  console.log('   Please add: SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here')
  console.log('   You can find this in your Supabase project settings under API')
  console.log('\n   Steps to get your service role key:')
  console.log('   1. Go to https://supabase.com/dashboard')
  console.log('   2. Select your project')
  console.log('   3. Click on "Settings" in the sidebar')
  console.log('   4. Click on "API" under Configuration')
  console.log('   5. Copy the "service_role" key (NOT the "anon" key)')
  console.log('   6. Add it to your .env.local file')
  process.exit(1)
}

// 2. Test Supabase connection
console.log('\n2️⃣ Testing Supabase Connection:')
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function testSupabase() {
  try {
    // Test recommendations table exists
    const { data: recommendations, error: recError } = await supabase
      .from('recommendations')
      .select('recommendation_id')
      .limit(1)
    
    if (recError) {
      if (recError.message.includes('relation') && recError.message.includes('does not exist')) {
        console.log('   ❌ Recommendations table does not exist')
        console.log('   Run: npm run migrate:add-reasons')
        return false
      }
      console.log('   ❌ Error accessing recommendations table:', recError.message)
      return false
    }
    
    console.log('   ✅ Recommendations table exists')
    
    // Check if reasons column exists
    const { data: columns, error: colError } = await supabase
      .rpc('get_table_columns', { table_name: 'recommendations' })
      .catch(() => ({ data: null, error: 'RPC not available' }))
    
    if (columns && Array.isArray(columns)) {
      const hasReasons = columns.some(col => col.column_name === 'reasons')
      if (!hasReasons) {
        console.log('   ⚠️  Reasons column missing - run migration')
      } else {
        console.log('   ✅ Reasons column exists')
      }
    }
    
    // Test products table
    const { count: productCount, error: prodError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
    
    if (prodError) {
      console.log('   ❌ Error accessing products table:', prodError.message)
      return false
    }
    
    console.log(`   ✅ Products table exists (${productCount || 0} products)`)
    
    // Test trends table
    const { count: trendCount, error: trendError } = await supabase
      .from('trends')
      .select('*', { count: 'exact', head: true })
      .in('lifecycle_stage', ['emerging', 'growing', 'peak'])
    
    if (trendError) {
      console.log('   ❌ Error accessing trends table:', trendError.message)
      return false
    }
    
    console.log(`   ✅ Trends table exists (${trendCount || 0} active trends)`)
    
    if (productCount === 0) {
      console.log('\n⚠️  WARNING: No products found. Please import products first.')
    }
    
    if (trendCount === 0) {
      console.log('\n⚠️  WARNING: No active trends found. Please run the trend agent first.')
    }
    
    return true
  } catch (error) {
    console.log('   ❌ Unexpected error:', error.message)
    return false
  }
}

// 3. Test OpenAI
console.log('\n3️⃣ Testing OpenAI Connection:')
async function testOpenAI() {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    })
    
    if (!response.ok) {
      const error = await response.json()
      console.log('   ❌ OpenAI API error:', error.error?.message || 'Invalid API key')
      return false
    }
    
    const data = await response.json()
    const hasGPT35 = data.data.some(model => model.id.includes('gpt-3.5-turbo'))
    
    if (hasGPT35) {
      console.log('   ✅ OpenAI API key is valid and GPT-3.5-turbo is available')
    } else {
      console.log('   ⚠️  OpenAI API key is valid but GPT-3.5-turbo not found')
    }
    
    return true
  } catch (error) {
    console.log('   ❌ Failed to connect to OpenAI:', error.message)
    return false
  }
}

// Run tests
async function runTests() {
  const supabaseOk = await testSupabase()
  const openaiOk = await testOpenAI()
  
  console.log('\n📊 Summary:')
  if (supabaseOk && openaiOk) {
    console.log('✅ All systems ready! You can now generate recommendations.')
    console.log('\nNext steps:')
    console.log('1. Make sure you have products imported')
    console.log('2. Run the trend agent to get trends')
    console.log('3. Click "Generate Recommendations" in the Inventory Actions tab')
  } else {
    console.log('❌ Some issues need to be fixed before generating recommendations.')
    console.log('\nPlease fix the errors above and run this test again.')
  }
}

runTests() 