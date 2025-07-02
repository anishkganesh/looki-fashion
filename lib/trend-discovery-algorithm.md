# Looki AI Trend Discovery Algorithm

## Overview
The Looki AI Trend Discovery Algorithm is a comprehensive system that monitors multiple data sources to identify fashion trends in real-time. It combines social media virality, celebrity influence, event-driven fashion, and traditional fashion media to provide a 360-degree view of what's trending.

## Algorithm Structure

### 1. Core Trend Discovery (Always Run)
These queries run for EVERY brand to capture universal trends:

#### Social Media Monitoring
- **TikTok**: `tiktok fashion [TODAY] viral fyp trending`
  - Monitors ForYouPage viral content
  - Tracks #fashiontok, #ootd hashtags
  - Identifies trending sounds with fashion content

- **Instagram**: `instagram reels fashion [THIS WEEK] trending explore`
  - Explores page trending content
  - Reels with high engagement
  - Story mentions and saves

- **Reddit**: `reddit fashion [THIS WEEK] hot posts upvoted`
  - r/fashion, r/streetwear, r/femalefashionadvice
  - High upvote posts indicate emerging trends
  - Community discussions reveal pain points

- **Twitter/X**: `twitter fashion [TODAY] trending topics viral`
  - Real-time trending hashtags
  - Quote tweets indicating viral moments
  - Fashion discourse and debates

#### Celebrity & Influencer Tracking
- `celebrity outfits [TODAY] red carpet street style`
- `celebrity airport fashion [MONTH] paparazzi`
- `influencer fashion [NOW] outfit ideas looks`
- `met gala coachella festival fashion [YEAR]`

#### Event-Driven Fashion
- `concert outfits [THIS WEEK] taylor swift beyonce`
  - Major tours drive fashion trends
  - Fan outfit coordination
  - Merchandise influence

- `music festival fashion [SEASON] coachella lollapalooza`
  - Festival fashion sets summer trends
  - Bohemian and alternative styles
  - Weather-appropriate innovations

- `fashion week street style [MONTH] paris milan nyfw`
  - Runway to reality translation
  - Street style photography
  - Buyer and editor picks

#### Market Signals
- `fashion sold out [TODAY] restock viral`
  - Items selling out = high demand
  - Restock alerts indicate sustained interest

- `fashion dupes alternatives [THIS WEEK] affordable`
  - High-end items getting duped = mainstream adoption
  - Price accessibility indicators

- `fashion waiting list [NOW] pre-order`
  - Pre-order volume indicates future trends
  - Anticipation metrics

### 2. Brand-Specific Queries
Layered on top of core queries based on brand profile:

#### For Marisa Lojas (Brazilian Women's Retail)
```
- "moda feminina" brasil tendencias novas
- sao paulo rio fashion week street style
- instagram brazil fashion influencer looks
- tiktok brasil moda viral outfits
- anitta pabllo vittar brazilian celebrity fashion
```

#### For Nike (Athletic)
```
- nike sneaker drops releases [TODAY]
- athletic wear technology innovation
- athlete collaborations new
- sneakerhead culture releases
- athleisure street style
```

#### For Luxury Brands
```
- luxury fashion week front row
- celebrity luxury brand ambassadors
- high jewelry red carpet
- private jet airport fashion
- luxury resale trending items
```

### 3. Source Prioritization

#### Tier 1: Real-Time (Check Every Hour)
- TikTok viral content
- Twitter trending topics
- Instagram explore page
- Reddit hot posts

#### Tier 2: Daily Trends
- Celebrity paparazzi photos
- Fashion blog posts
- YouTube hauls
- Pinterest trending boards

#### Tier 3: Weekly Analysis
- Fashion week coverage
- Magazine features
- Runway reports
- Retail bestsellers

### 4. Trend Scoring Algorithm

Each discovered trend is scored based on:

1. **Virality Score (0-40 points)**
   - TikTok views/likes: up to 20 points
   - Instagram engagement: up to 10 points
   - Platform spread: up to 10 points

2. **Celebrity Influence (0-20 points)**
   - A-list celebrity: 20 points
   - Influencer (1M+ followers): 15 points
   - Micro-influencer: 10 points
   - Regular user: 5 points

3. **Recency (0-20 points)**
   - Today: 20 points
   - This week: 15 points
   - This month: 10 points
   - Older: 5 points

4. **Brand Relevance (0-20 points)**
   - Perfect demographic match: 20 points
   - Price point alignment: ±10 points
   - Style alignment: ±10 points

### 5. Trend Lifecycle Detection

```
Discovery → Emerging → Growing → Peak → Declining → Archive

Discovery (0-3 days)
- First mentions on social media
- Early adopter purchases
- Influencer trials

Emerging (3-7 days)
- Viral moment begins
- Media coverage starts
- Dupes appear

Growing (1-2 weeks)
- Mainstream adoption
- Retail availability
- Peak social mentions

Peak (2-4 weeks)
- Maximum visibility
- Full retail saturation
- Declining social velocity

Declining (1-2 months)
- Reduced mentions
- Clearance sales
- Next trend emerging
```

### 6. Data Processing Pipeline

1. **Query Execution** (every 15 mins for hot trends)
   - 15 parallel searches
   - 6 results per search
   - ~90 URLs processed

2. **Content Extraction**
   - AI extracts specific items, colors, styles
   - Not generic categories but exact products
   - Example: "Adidas Samba Black/White" not "sneakers"

3. **Deduplication**
   - Same trend from multiple sources = higher confidence
   - Source diversity scoring
   - Influence weighting

4. **Storage & Updates**
   - New trends: Insert with full metrics
   - Existing trends: Update momentum/velocity
   - Archive old trends: Move to historical

### 7. Success Metrics

- **Speed**: Identify trends within 24 hours of emergence
- **Accuracy**: 80% of identified trends should show market adoption
- **Relevance**: 90% brand alignment for suggested trends
- **Coverage**: Capture trends across all demographics

## Implementation Notes

### Rate Limiting
- Firecrawl API: 500 requests/hour
- Cache searches for 5 minutes
- Prioritize high-signal queries

### Quality Control
- Minimum 3 sources for trend confirmation
- Filter out promotional content
- Verify through multiple platforms

### Continuous Learning
- Track which trends convert to sales
- Adjust scoring weights based on outcomes
- Add new platforms as they emerge

## Future Enhancements

1. **Live Stream Monitoring**
   - TikTok Live fashion hauls
   - Instagram Live shopping
   - YouTube livestream events

2. **Geo-Targeting**
   - City-specific trends
   - Weather-driven fashion
   - Regional style variations

3. **Predictive Modeling**
   - ML model for trend trajectory
   - Seasonal pattern recognition
   - Cross-category influence mapping