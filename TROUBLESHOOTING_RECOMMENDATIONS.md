# Troubleshooting Recommendations Generation

## Common Issues and Solutions

### 1. Empty Response Error ({})

**Symptoms:**
- Console shows "API Error: {}"
- No recommendations are generated
- Toast shows "Failed to generate recommendations"

**Diagnosis Steps:**
1. Run the test script:
   ```bash
   npm run test:recommendations
   ```

2. Check browser console for detailed logs:
   - Look for "Response status:", "Response text:", etc.
   - Check for any error messages about missing API keys

3. Check server logs:
   ```bash
   npm run dev
   ```
   Look for console output from the API route

**Common Causes & Solutions:**

#### Missing SUPABASE_SERVICE_ROLE_KEY
```bash
# In .env.local, add:
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

To find your service role key:
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the "service_role" key (NOT the anon key)

#### Missing or Invalid OpenAI API Key
```bash
# In .env.local, ensure you have:
OPENAI_API_KEY=sk-...your_actual_key_here
```

**Note:** The key in env.example is invalid. You need your own OpenAI API key.

#### Missing Recommendations Table or Reasons Column
Run the migration:
```bash
npm run migrate:add-reasons
```

Then manually execute the SQL in Supabase SQL Editor.

### 2. No Products or Trends Found

**Symptoms:**
- API returns "No products found for this brand"
- API returns "No active trends found"

**Solutions:**
1. Import products via Catalog Integration tab
2. Run the trend agent in the Dashboard

### 3. Build Errors

**Symptoms:**
- "Expected a semicolon" errors
- Build fails

**Solution:**
Ensure you've accepted all the file changes and the syntax is correct.

### 4. Recommendations Not Showing in UI

**Symptoms:**
- API succeeds but inventory table is empty

**Solutions:**
1. Check if recommendations were actually inserted:
   - Go to Supabase dashboard
   - Check the recommendations table
2. Refresh the page
3. Make sure you're on the correct brand account

## Quick Checklist

Before generating recommendations, ensure:

- [ ] `.env.local` has all required keys:
  ```
  OPENAI_API_KEY=sk-...
  NEXT_PUBLIC_SUPABASE_URL=https://...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  ```

- [ ] Products are imported (check Catalog Matches tab)
- [ ] Trends exist (run trend agent)
- [ ] Recommendations table has reasons column (run migration)
- [ ] You're logged in with the correct brand account

## Testing Your Setup

Run the comprehensive test:
```bash
npm run test:recommendations
```

This will check:
- Environment variables
- Supabase connection
- Table existence
- OpenAI API validity

## Still Having Issues?

1. Clear browser cache and cookies
2. Restart the development server
3. Check Supabase logs for any database errors
4. Verify your OpenAI account has API access and credits

## Debug Mode

To enable detailed logging, add to your `.env.local`:
```
NODE_ENV=development
```

This will show additional console output in both browser and server. 