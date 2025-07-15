# Database Migration Required

## Important: Run This Migration in Supabase

To fix the campaign products display issue, you need to run the following migration in your Supabase SQL editor:

### Steps:
1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste the contents of `scripts/migrations/fix_campaigns_and_products.sql`
5. Click **Run**

### What This Migration Does:
- ✅ Adds `display_order` column to `campaign_products` table
- ✅ Creates indexes for better performance
- ✅ Ensures `trend_id` column exists in campaigns table
- ✅ Migrates data from old `campaign_trends` table to new structure
- ✅ Updates display order for existing campaign products

### Alternative: Run Individual Migration
If you prefer, you can run just the display_order migration:
```sql
-- Add display_order column to campaign_products table
ALTER TABLE campaign_products 
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 1;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_campaign_products_display_order 
ON campaign_products(campaign_id, display_order);
```

## After Migration
Once the migration is complete:
1. Refresh your application
2. Campaign products should now display correctly
3. Individual trend campaign generation should work
4. Export buttons should show text properly

## Troubleshooting
If you still see issues after the migration:
1. Check browser console for errors
2. Verify the migration ran successfully in Supabase logs
3. Try generating a new campaign to test 