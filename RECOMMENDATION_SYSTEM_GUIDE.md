# Looki Recommendation System Guide

## Overview
The Looki recommendation system uses a hybrid approach combining algorithmic matching with AI-powered insights to generate inventory recommendations based on fashion trends.

## System Architecture

### 1. Algorithmic Matching (Manual)
The system first performs algorithmic matching between products and trends based on:

- **Category Compatibility** (30% weight)
  - Product categories are detected from product names, descriptions, and attributes
  - Trends are categorized and checked for compatibility with product categories
  - Incompatible combinations are filtered out (e.g., footwear trends won't match with tops)

- **Style Matching** (25% weight)
  - Color alignment
  - Pattern matching
  - Silhouette compatibility
  - Material matching

- **Demographic Alignment** (15% weight)
  - Gender match
  - Age range overlap
  - Income level compatibility
  - Lifestyle alignment

- **Seasonality Match** (10% weight)
  - Current season relevance
  - Seasonal keyword matching
  - Trend momentum adjustments

- **Lifecycle Compatibility** (10% weight)
  - Emerging trends: 90 points
  - Growing trends: 80 points
  - Peak trends: 60 points
  - Declining trends: 30 points

- **Trend Momentum** (10% weight)
  - Based on the trend's momentum score

### 2. AI-Powered Refinement (GPT-3.5-turbo)
After algorithmic matching, GPT-3.5-turbo refines the recommendations by:
- Generating detailed, actionable reasons for each recommendation
- Adjusting confidence scores based on contextual understanding
- Providing specific inventory actions

## Recommendation Actions

The system generates the following types of recommendations:

1. **Strong Promote** (Match Score ≥ 85%)
   - High confidence in trend alignment
   - Recommend prominent placement and marketing

2. **Promote** (Match Score ≥ 70%)
   - Good trend alignment
   - Recommend increased visibility

3. **Hold** (Match Score ≥ 55%)
   - Moderate alignment
   - Maintain current strategy

4. **Markdown** (Match Score ≥ 40%)
   - Limited alignment
   - Consider price reductions

5. **Phase Out** (Match Score < 40%)
   - Poor alignment
   - Consider discontinuing

6. **Urgent Restock**
   - Triggered when inventory < 20 units for promote/strong promote items

## Database Schema

### Recommendations Table
```sql
recommendations
- recommendation_id (integer, primary key)
- brand_id (integer, foreign key)
- product_id (integer, foreign key)
- matched_trend_id (integer, foreign key)
- category_path (text)
- recommendation_type (varchar)
- recommendation_action (varchar)
- confidence_score (double precision, 0-1)
- alignment_score (double precision, 0-100)
- alignment_factors (jsonb)
- reasons (jsonb) -- Array of recommendation reasons
- generated_by (varchar)
- is_active (boolean)
- expires_at (timestamp)
- created_at (timestamp)
```

### Reasons Structure
```json
[
  {
    "reason_type": "trend_alignment",
    "reason_code": "strong_match",
    "reason_description": "Product shows strong alignment with sustainable fashion trend",
    "impact_score": 0.85,
    "supporting_data": {
      "match_score": 85,
      "trend_stage": "growing"
    }
  }
]
```

## Setup Instructions

### 1. Database Migration
Run the migration to add the reasons column:
```bash
npm run migrate:add-reasons
```

Or manually execute:
```sql
ALTER TABLE recommendations 
ADD COLUMN IF NOT EXISTS reasons JSONB;
```

### 2. Environment Variables
Ensure these are set in your `.env.local`:
```
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Generate Recommendations
1. Navigate to Dashboard > Inventory Actions tab
2. Click "Generate Recommendations"
3. The system will:
   - Analyze your product catalog
   - Match products with relevant trends
   - Calculate alignment scores
   - Generate AI-powered recommendations
   - Display results in the inventory actions table

## API Endpoints

### Generate Recommendations
```
POST /api/recommendations/generate
Body: { brand_id: number }
```

This endpoint:
1. Fetches active products for the brand
2. Fetches relevant trends (emerging, growing, peak)
3. Performs algorithmic matching
4. Uses GPT-3.5-turbo to refine recommendations
5. Stores results in the database

### Simple Fallback (No AI)
```
POST /api/recommendations/generate-simple
Body: { brand_id: number }
```

Used when OpenAI is not configured or as a fallback option.

## Troubleshooting

### Empty Response Error
If you get an empty response ({}), check:
1. OpenAI API key is valid
2. Products exist for the brand
3. Trends are available in the database
4. Check browser console and server logs

### No Recommendations Generated
Possible causes:
1. No compatible product-trend matches
2. All match scores below threshold (45%)
3. No active products or trends

### Performance Optimization
- Processes top 1000 products by revenue
- Matches with top 30 trends by momentum
- Maximum 2 recommendations per product
- Batch processing (20 recommendations at a time)

## Best Practices

1. **Regular Updates**: Generate recommendations weekly or when new trends emerge
2. **Review High Confidence**: Focus on recommendations with >80% confidence
3. **Monitor Inventory**: Pay special attention to "Urgent Restock" actions
4. **Seasonal Adjustments**: The system accounts for seasonality automatically
5. **Trend Lifecycle**: Prioritize emerging and growing trends for maximum impact 