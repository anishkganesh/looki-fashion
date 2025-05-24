# Fashion Trends Scraper

A sophisticated web scraper that discovers and analyzes upcoming fashion trends from various sources and automatically uploads them to a Supabase database.

## Features

- **Automated Trend Discovery**: Searches multiple sources including fashion weeks, social media, celebrity events, and fashion publications
- **Smart Trend Analysis**: Calculates custom metrics for each trend including:
  - Momentum score (0-100)
  - Velocity (growth rate)
  - Lifecycle stage (emerging, growing, peak, declining, dormant)
  - Adoption rate
  - Demographic segmentation
  - Risk assessment
  - Predicted peak and decline dates
- **Multi-Source Integration**: Extracts data from:
  - Fashion week coverage
  - Music festivals and events
  - Celebrity fashion spotting
  - Social media trends (TikTok, Instagram)
  - Fashion technology news
  - Sustainable fashion movements
- **Automatic Database Upload**: Seamlessly uploads analyzed trends to Supabase

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd fashion-trends-scraper
```

2. Install dependencies:
```bash
npm install
```

3. Configure your API keys in `config.js` (already configured with provided keys)

## Usage

Run the scraper:
```bash
npm start
```

The scraper will:
1. Search for fashion trends across 12+ different query patterns
2. Extract and analyze content from search results
3. Identify specific trend names and items
4. Calculate all metrics using AI-driven analysis
5. Remove duplicates and upload unique trends to Supabase

## Trend Categories

- **Color**: Color trends, palettes, shades
- **Style**: Overall fashion aesthetics and looks
- **Material**: Fabric and textile trends
- **Pattern**: Print and pattern trends
- **Silhouette**: Fit, cut, and shape trends

## Metrics Explained

- **Momentum Score**: Overall trend strength (0-100)
- **Velocity**: Growth rate indicator
- **Lifecycle Stage**: Current position in trend cycle
- **Adoption Rate**: Market penetration (0-1)
- **Demographic Segments**: Target audiences (age, gender, location, income)
- **Competitor Adoption**: Brand involvement rate
- **Seasonality Factor**: Seasonal dependency
- **Social Reach**: Combined social media impact
- **Conversion Impact**: Potential sales influence
- **Risk Score**: Investment risk assessment

## Database Schema

The scraper populates the `trends` table with the following fields:
- `trend_identifier`: Unique trend name
- `trend_category`: Category classification
- `momentum_score`: Trend strength
- `velocity`: Growth rate
- `lifecycle_stage`: Current stage
- `adoption_rate`: Market adoption
- `demographic_segments`: JSON object with target demographics
- `competitor_adoption`: Brand adoption rate
- `seasonality_factor`: Seasonal dependency
- `predicted_peak_date`: Estimated peak date
- `predicted_decline_date`: Estimated decline date
- `social_reach`: Social media reach
- `conversion_impact`: Sales impact potential
- `risk_score`: Risk assessment
- `last_updated`: Last update timestamp
- `created_at`: Creation timestamp

## Customization

You can modify search queries in the `getSearchQueries()` method in `index.js` to target specific:
- Time periods
- Geographic regions
- Event types
- Fashion categories
- Social platforms

## License

ISC 