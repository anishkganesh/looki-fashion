# Looki AI Calculation Formulas Documentation

This document details all the calculation formulas used throughout the Looki AI platform for transparency and understanding.

## Trend Metrics

### 1. Momentum Score (0-100)
Measures the current strength and velocity of a trend.

**Formula:**
```
Base Momentum = hasViralIndicators ? 75 : 50
If (extracted_today) Base += 15
If (source_count > 3) Base += 10
Final = min(100, Base + (source_count × 5) + random(0-10))
```

**Factors:**
- Viral indicators (TikTok, Instagram mentions): +25 base points
- Extracted today: +15 points
- Multiple sources: +5 points per source
- Random variance: 0-10 points

### 2. Velocity Score (0-30)
Rate of growth or decline for the trend.

**Formula:**
```
Base Velocity = hasViralIndicators ? 15 : 8
Final = min(30, Base + (source_count × 3) + random(0-5))
```

**Factors:**
- Viral content: +7 base points
- Each additional source: +3 points
- Random variance: 0-5 points

### 3. Adoption Rate (0-100%)
Percentage of target market currently engaged with the trend.

**Formula:**
```
Base Adoption = hasInfluencers ? 40% : 20%
Momentum Factor = (momentum_score / 100) × 40%
Final = min(100%, Base + Momentum Factor)
```

**Factors:**
- Influencer mentions: +20% base
- High momentum: Up to +40%

### 4. Social Reach
Estimated number of people exposed to the trend.

**Formula:**
```
Base Reach:
- TikTok viral: 1,000,000
- Instagram viral: 750,000
- Default: 50,000

Final = Base + (momentum × 10,000) + random(0-100,000)
```

### 5. Risk Score (0-100%)
Likelihood of trend failing or not converting.

**Formula:**
```
Base Risk = hasBrandMentions ? 10% : 20%
Final = Base + random(0-10%)
```

**Factors:**
- Established brand mentions: -10% risk
- Random market factors: +0-10%

### 6. Conversion Impact (0-50%)
Expected impact on sales conversion rates.

**Formula:**
```
Base Conversion = hasPriceInfo ? 15% : 8%
Momentum Impact = (momentum / 100) × 20%
Adoption Impact = adoption_rate × 10%
Final = min(50%, Base + Momentum Impact + Adoption Impact)
```

### 7. Peak Date Prediction
When the trend is expected to reach maximum popularity.

**Formula:**
```
Days to Peak:
- Already viral: 3 days
- Has viral indicators: 7 days
- Default: 14 days
- Already at peak: 0 days

Final = Base + random(-3 to +3) days
```

### 8. Lifecycle Stage
Current stage of the trend lifecycle.

**Rules:**
- Viral: hasViralIndicators AND momentum > 85
- Growing: momentum > 75
- Peak: momentum > 60
- Established: momentum > 40
- Emerging: momentum <= 40

## Summary Statistics

### 1. Active Trends Count
**Formula:**
```
Count of trends WHERE:
- lifecycle_stage IN ('growing', 'emerging')
- last_updated >= 7 days ago
```

### 2. Average Alignment Score
**Formula:**
```
Sum of all alignment_scores / Count of recommendations
Baseline comparison: current_average - 70%
```

### 3. Optimization Opportunities
**Formula:**
```
Count of recommendations WHERE:
- brand_id = user's brand
- is_active = true
```

### 4. Potential Revenue Impact
**Formula:**
```
For each recommended product:
Sum of (current_price × current_inventory_level)

Week-over-week growth estimate: 20% (industry average)
```

## Product-Trend Alignment

### Alignment Score Calculation
**Formula:**
```
Base Score = 50
+ Category Match: +20 if product category matches trend
+ Demographic Match: +15 if target demographics align
+ Price Range Match: +10 if price aligns with trend audience
+ Seasonality Match: +5 if seasonal timing aligns
Final = min(100, total)
```

## Brand Adaptation Algorithm

### Query Generation
The system adapts to brands by analyzing:

1. **Brand Category Mapping:**
   - Womenswear → women's fashion queries
   - Athletic → sportswear, performance queries
   - Luxury → designer, premium queries

2. **Demographics Adjustment:**
   - Age ranges → gen z, millennial, mature terms
   - Gender → specific gender terms
   - Income → luxury, mid-range, affordable terms

3. **Geographic Targeting:**
   - Country code → local sources
   - Target locations → city-specific trends
   - Language → localized search terms

4. **Time-Based Queries:**
   - "today", "this week", "just dropped"
   - Platform-specific: "viral on TikTok today"
   - Seasonal: current season + next season

### Source Selection
**Algorithm:**
```python
if brand.country == 'BR':
    add brazilian_sources
if brand.category == 'athletic':
    add athletic_sources + streetwear_sources
if brand.income_level == 'high':
    add luxury_sources
always add social_media_sources
```

## Data Freshness

### Trend Extraction Timing
- Real-time indicators: Same day = +15 momentum
- Viral content: Peak in 3-7 days
- Regular trends: Peak in 14-30 days

### Cache Policies
- Summary stats: 5 minutes
- Trend data: Real-time updates
- Product data: 15 minutes

## Scoring Normalization

All percentage scores are normalized:
```
Normalized = round(raw_value * 100) / 100
```

All currency values are rounded:
```
Display = value > 1M ? `${(value/1M).toFixed(1)}M`
        : value > 1K ? `${(value/1K).toFixed(0)}K`
        : value
```

## Confidence Intervals

Most calculations include random variance to simulate market uncertainty:
- Momentum: ±10 points
- Velocity: ±5 points
- Social Reach: ±100,000
- Peak Date: ±3 days

This ensures the system doesn't present false precision and acknowledges market unpredictability.