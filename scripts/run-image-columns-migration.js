const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function runMigration() {
  try {
    console.log('Running image columns migration...')
    
    const migrationPath = path.join(__dirname, 'migrations', 'add_image_url_columns.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    const { data, error } = await supabase.rpc('exec_sql', { query: sql })
    
    if (error) {
      console.error('Migration error:', error)
      process.exit(1)
    }
    
    console.log('Migration completed successfully!')
    console.log('Added/verified columns:')
    console.log('- trends.generated_image_url')
    console.log('- recommendations.generated_image_url')
    console.log('- campaigns.hero_image_url')
    console.log('- brands.catalog_source')
    console.log('- brands.last_catalog_sync')
    console.log('- products.attributes')
    
  } catch (error) {
    console.error('Error running migration:', error)
    process.exit(1)
  }
}

runMigration()