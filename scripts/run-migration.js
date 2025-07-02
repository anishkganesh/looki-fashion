#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Check for required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Missing required environment variables')
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set')
  process.exit(1)
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  try {
    // Get migration file from command line argument
    const migrationFile = process.argv[2] || 'simplify-recommendations-table.sql'
    const migrationName = path.basename(migrationFile, '.sql')
    
    console.log(`🚀 Starting migration: ${migrationName}...`)
    
    // Read the SQL migration file
    const migrationPath = migrationFile.startsWith('/') 
      ? migrationFile 
      : path.join(__dirname, '..', migrationFile)
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`)
      process.exit(1)
    }
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Running migration script...')
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    })
    
    if (error) {
      // If RPC doesn't exist, try direct execution
      console.log('⚠️  RPC function not found, attempting direct execution...')
      
      // Split the SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))
      
      console.log(`📊 Found ${statements.length} SQL statements to execute`)
      
      // Note: This is a simplified approach - in production you'd use a proper migration tool
      console.log('\n⚠️  IMPORTANT: This script cannot directly execute the migration.')
      console.log('Please run the following SQL in your Supabase SQL editor:\n')
      console.log('1. Go to your Supabase dashboard')
      console.log('2. Navigate to SQL Editor')
      console.log(`3. Copy and paste the contents of ${migrationPath}`)
      console.log('4. Click "Run" to execute the migration\n')
      
      console.log('The migration will:')
      console.log('✅ Create a new simplified recommendations table')
      console.log('✅ Migrate existing data (if any)')
      console.log('✅ Drop the old tables')
      console.log('✅ Set up proper indexes and RLS policies')
      
      return
    }
    
    console.log('✅ Migration completed successfully!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
runMigration()