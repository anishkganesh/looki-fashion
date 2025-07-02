# Database Migration: Simplify Recommendations Table

This migration consolidates the recommendations system from multiple tables into a single, simplified table structure.

## What This Migration Does

1. **Creates a new `recommendations` table** with:
   - All recommendation data in one place
   - Reasons stored as JSONB array (no separate table)
   - Alignment factors as JSONB object
   - Proper indexes for performance

2. **Migrates existing data** (if any) from:
   - `recommendations` table
   - `recommendation_reasons` table

3. **Drops old tables** and renames the new one

4. **Sets up RLS policies** for security

## How to Run the Migration

### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy the entire contents of `simplify-recommendations-table.sql`
6. Paste into the SQL editor
7. Click **Run** to execute the migration

### Option 2: Via Node.js Script

```bash
# From the project root
npm run migrate:recommendations
```

Note: This will provide instructions since direct execution requires special permissions.

## Verify the Migration

After running the migration, verify it worked:

```sql
-- Check if the new table exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'recommendations';

-- Check if data was migrated (if you had existing data)
SELECT COUNT(*) FROM recommendations;

-- Check a sample recommendation
SELECT * FROM recommendations LIMIT 1;
```

## Rollback (if needed)

If you need to rollback, you'll need to restore from a backup since the old tables are dropped. Always backup your database before running migrations!

## Changes for the Application

The application code has been updated to work with the new structure:
- API endpoint now stores reasons directly in the table
- No more joins with recommendation_reasons table
- Simpler, faster queries

## Troubleshooting

If you get an error about missing foreign keys:
- Ensure the `brands`, `products`, and `trends` tables exist
- Check that you have products and trends data before generating recommendations

If the migration fails:
- Check the Supabase logs for detailed error messages
- Ensure you're using a user with sufficient privileges (preferably the service role)