import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

async function resetProducts() {
  console.log('Resetting products table...')
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  // Delete all products
  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .neq('product_id', 0) // Delete all rows
  
  if (deleteError) {
    console.error('Error deleting products:', deleteError)
    return
  }
  
  // Reset all import progress records
  const { error: resetError } = await supabase
    .from('catalog_import_progress')
    .delete()
    .neq('id', 0) // Delete all rows
    
  if (resetError) {
    console.error('Error resetting import progress:', resetError)
    return
  }
  
  // Reset all import failures
  const { error: failuresError } = await supabase
    .from('catalog_import_failures')
    .delete()
    .neq('id', 0) // Delete all rows
    
  if (failuresError) {
    console.error('Error resetting import failures:', failuresError)
    return
  }
  
  console.log('Products table reset successfully!')
}

resetProducts()