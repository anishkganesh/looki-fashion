import { NextResponse } from 'next/server'
import FirecrawlApp from '@mendable/firecrawl-js'
import { supabaseService } from '@/lib/supabase-service'
import OpenAI from 'openai'

// Initialize services
const firecrawl = new FirecrawlApp({ 
  apiKey: process.env.FIRECRAWL_API_KEY! 
})

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
})

// Helper function for fuzzy matching of trend names
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '')
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  // If either string is very short, use exact match
  if (s1.length < 3 || s2.length < 3) {
    return s1 === s2 ? 1 : 0
  }
  
  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.9
  }
  
  // Calculate Levenshtein distance
  const matrix = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(null))
  
  for (let i = 0; i <= s1.length; i++) matrix[0][i] = i
  for (let j = 0; j <= s2.length; j++) matrix[j][0] = j
  
  for (let j = 1; j <= s2.length; j++) {
    for (let i = 1; i <= s1.length; i++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[j][i] = matrix[j - 1][i - 1]
      } else {
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1,
          matrix[j - 1][i - 1] + 1
        )
      }
    }
  }
  
  const distance = matrix[s2.length][s1.length]
  const maxLength = Math.max(s1.length, s2.length)
  return 1 - (distance / maxLength)
}

// Find similar trends using fuzzy matching
function findSimilarTrend(trendName: string, existingTrends: Map<string, any>): string | null {
  const threshold = 0.85 // Increased to 85% to allow more similar trends
  
  for (const [id, trend] of existingTrends) {
    // Compare with trend name
    if (trend.trend_name) {
      const similarity = calculateSimilarity(trendName, trend.trend_name)
      if (similarity >= threshold) return id
    }
    
    // Compare with identifier
    const idSimilarity = calculateSimilarity(trendName, trend.trend_identifier || id)
    if (idSimilarity >= threshold) return id
  }
  
  return null
}

// Progress update helper
function createProgressStream() {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController | null = null
  
  const stream = new ReadableStream({
    start(c) {
      controller = c
    }
  })
  
  const sendProgress = (message: string, data?: any) => {
    if (controller) {
      const event = `data: ${JSON.stringify({ message, data, timestamp: Date.now() })}\n\n`
      controller.enqueue(encoder.encode(event))
    }
  }
  
  const close = () => {
    if (controller) {
      controller.close()
    }
  }
  
  return { stream, sendProgress, close }
}

// Comprehensive source pools for trend discovery
const fashionSources = {
  // Traditional fashion media
  publications: ['vogue.com', 'harpersbazaar.com', 'elle.com', 'wwd.com', 'businessoffashion.com', 'fashionista.com', 'refinery29.com', 'glamour.com', 'cosmopolitan.com', 'marieclaire.com'],
  
  // Social media platforms - where trends are born
  social: ['tiktok.com', 'instagram.com', 'pinterest.com', 'twitter.com', 'youtube.com', 'reddit.com/r/fashion', 'reddit.com/r/streetwear', 'reddit.com/r/femalefashionadvice', 'reddit.com/r/malefashionadvice', 'tumblr.com'],
  
  // Celebrity and entertainment news
  celebrity: ['tmz.com', 'eonline.com', 'perezhilton.com', 'justjared.com', 'dailymail.co.uk/tvshowbiz', 'hollywoodreporter.com', 'variety.com', 'billboard.com', 'rollingstone.com'],
  
  // Fashion events and runway
  events: ['fashionweekdaily.com', 'nowfashion.com', 'livingly.com', 'style.com', 'fashionweekonline.com', 'vogue.com/fashion-shows'],
  
  // Trend forecasting and analytics
  trends: ['wgsn.com', 'trendhunter.com', 'trendstop.com', 'fashionsnoops.com', 'stylus.com', 'lyst.com', 'tagwalk.com', 'launchmetrics.com'],
  
  // Retail and shopping
  retail: ['ssense.com', 'net-a-porter.com', 'farfetch.com', 'matchesfashion.com', 'shopbop.com', 'revolve.com', 'asos.com', 'nordstrom.com'],
  
  // Streetwear and youth culture
  streetwear: ['hypebeast.com', 'highsnobiety.com', 'complex.com', 'grailed.com', 'sneakernews.com', 'kicksonfire.com', 'nicekicks.com'],
  
  // Athletic and sportswear
  athletic: ['nike.com', 'adidas.com', 'puma.com', 'underarmour.com', 'lululemon.com', 'gymshark.com', 'athleta.com', 'outdoor-voices.com'],
  
  // Regional sources
  brazilian: ['vogue.com.br', 'elle.com.br', 'glamour.globo.com', 'harpersbazaar.uol.com.br', 'marieclaire.globo.com', 'ffw.uol.com.br'],
  asian: ['vogue.jp', 'elle.kr', 'fashionsnap.com', 'wear.jp', 'fashionpress.jp'],
  european: ['vogue.fr', 'vogue.it', 'elle.fr', 'grazia.it', 'lofficiel.com'],
  
  // Fast fashion monitoring
  fast_fashion: ['zara.com', 'hm.com', 'forever21.com', 'uniqlo.com', 'mango.com', 'shein.com', 'boohoo.com', 'prettylittlething.com'],
  
  // Luxury brands
  luxury: ['burberry.com', 'gucci.com', 'louisvuitton.com', 'chanel.com', 'dior.com', 'prada.com', 'balenciaga.com', 'bottegaveneta.com'],
  
  // Technology and innovation
  tech: ['techcrunch.com', 'theverge.com', 'wired.com', 'engadget.com', 'digitaltrends.com'],
  
  // Sustainability
  sustainability: ['fashionrevolution.org', 'goodonyou.eco', 'eco-age.com', 'sustainablefashion.com', 'remake.world'],
  
  // Music and concert influence
  music: ['coachella.com', 'pitchfork.com', 'nme.com', 'stereogum.com', 'consequenceofsound.net', 'brooklynvegan.com'],
  
  // Influencer platforms
  influencer: ['liketoknow.it', '21buttons.com', 'rewardstyle.com', 'shopstyle.com']
}

// Get brand-specific sources
function getBrandSpecificSources(brandInfo: any): string[] {
  const brandName = brandInfo?.brand_name?.toLowerCase() || ''
  const brandCategory = brandInfo?.category?.toLowerCase() || ''
  const brandId = brandInfo?.brand_id
  
  // Determine brand country based on known brands
  let brandCountry = brandInfo?.country || 'US'
  
  // Convert brandId to number for consistent comparison
  const numericBrandId = typeof brandId === 'string' ? parseInt(brandId) : brandId
  
  // Brazilian brands
  if (brandName.includes('marisa') || numericBrandId === 13 ||
      brandName.includes('track') || numericBrandId === 7 ||
      brandName.includes('cris barros') || numericBrandId === 2) {
    brandCountry = 'BR'
  }
  
  // Indian brands
  if (brandName.includes('arvind') || numericBrandId === 1) {
    brandCountry = 'IN'
  }
  
  // US brands
  if (brandName.includes('walmart') || numericBrandId === 5 ||
      brandName.includes('zara') || numericBrandId === 6) {
    brandCountry = 'US'
  }
  
  // Debug log to verify correct assignment
  console.log(`getBrandSpecificSources Debug:`, {
    brandName,
    brandId,
    numericBrandId,
    detectedCountry: brandCountry,
    brandIdType: typeof brandId
  })
  
  let selectedSources: string[] = []
  
  // PRIORITIZE REGION-SPECIFIC SOURCES FIRST
  if (brandCountry === 'BR') {
    // For Brazilian brands, use Brazilian sources + social media
    selectedSources.push(...fashionSources.brazilian)
    selectedSources.push('tiktok.com.br', 'instagram.com.br') // Brazilian versions
    selectedSources.push(...fashionSources.fast_fashion.filter(s => ['zara.com', 'hm.com', 'forever21.com'].includes(s))) // Only international brands active in Brazil
    selectedSources.push('mercadolivre.com.br', 'olx.com.br') // Brazilian marketplaces
  } else if (brandCountry === 'IN') {
    // For Indian brands, use Indian sources
    selectedSources.push('vogue.in', 'elle.in', 'grazia.co.in', 'harpersbazaar.in')
    selectedSources.push('instagram.com', 'tiktok.com') // Global versions popular in India
    selectedSources.push('myntra.com', 'ajio.com', 'nykaa.com') // Indian fashion platforms
    selectedSources.push('reddit.com/r/IndianFashionAddicts', 'reddit.com/r/IndianWeddings')
  } else if (brandCountry === 'US') {
    // US sources
    selectedSources.push(...fashionSources.publications.slice(0, 5))
    selectedSources.push(...fashionSources.retail.slice(0, 5))
    selectedSources.push(...fashionSources.social)
  } else if (['FR', 'IT', 'ES', 'DE', 'UK'].includes(brandCountry)) {
    // European sources
    selectedSources.push(...fashionSources.european)
    selectedSources.push(...fashionSources.luxury.slice(0, 5))
  } else if (['JP', 'KR', 'CN'].includes(brandCountry)) {
    // Asian sources
    selectedSources.push(...fashionSources.asian)
  }
  
  // Add category-specific sources only from same region
  if (brandCategory.includes('athletic')) {
    selectedSources.push(...fashionSources.athletic.slice(0, 3))
    selectedSources.push(...fashionSources.streetwear.slice(0, 2))
  }
  
  if (brandCategory.includes('luxury') || brandInfo?.target_income_level === 'high') {
    selectedSources.push(...fashionSources.luxury.slice(0, 3))
  }
  
  if (brandCategory.includes('sustainable')) {
    selectedSources.push(...fashionSources.sustainability.slice(0, 2))
  }
  
  // Add social media but prioritize regional versions
  if (brandCountry === 'BR') {
    selectedSources.push('tiktok.com.br', 'instagram.com.br', 'pinterest.com.br', 'twitter.com.br')
  } else {
    selectedSources.push(...fashionSources.social.slice(0, 5))
  }
  
  // Remove duplicates and return
  return [...new Set(selectedSources)]
}

// Generate comprehensive trend search queries
function generateBrandSpecificQueries(brandInfo: any) {
  const currentDate = new Date()
  const month = currentDate.toLocaleDateString('en-US', { month: 'long' })
  const year = currentDate.getFullYear()
  const week = Math.ceil((currentDate.getDate() + new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()) / 7)
  const season = getSeason()
  const nextSeason = getNextSeason()
  const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' })
  
  // Add randomization to get different results each time
  const randomSeed = Math.random()
  
  // Time-based contexts for ultra-recent trends - shuffle for variety
  const timeContexts = [
    `today ${dayOfWeek}`,
    `this week ${month} ${year}`,
    `${month} ${week} week ${year}`,
    `latest ${month} ${year}`,
    `new today`,
    `just dropped`,
    `trending now`,
    `viral today`,
    `breaking`,
    `hot right now`,
    `${month} ${year} trends`,
    `week ${week} fashion`,
    `newest arrivals`,
    `fresh drops`,
    `just launched`
  ].sort(() => randomSeed - 0.5).slice(0, 10)
  
  // Extract brand context from actual user data
  const brandName = brandInfo?.brand_name || 'fashion'
  const brandCategory = brandInfo?.category || 'general'
  const brandId = brandInfo?.brand_id
  const targetGender = brandInfo?.target_gender || 'all'
  const targetAgeMin = brandInfo?.target_age_min || 18
  const targetAgeMax = brandInfo?.target_age_max || 65
  const targetLifestyle = brandInfo?.target_lifestyle || []
  const targetInterests = brandInfo?.target_interests || ['fashion']
  const targetIncomeLevel = brandInfo?.target_income_level || 'medium'
  const targetLocations = brandInfo?.target_locations || []
  
  // Determine brand country based on known brands
  let brandCountry = brandInfo?.country || 'US'
  
  // Convert brandId to number for consistent comparison
  const numericBrandId = typeof brandId === 'string' ? parseInt(brandId) : brandId
  
  // Brazilian brands
  if (brandName.toLowerCase().includes('marisa') || numericBrandId === 13 ||
      brandName.toLowerCase().includes('track') || numericBrandId === 7 ||
      brandName.toLowerCase().includes('cris barros') || numericBrandId === 2) {
    brandCountry = 'BR'
  }
  
  // Indian brands
  if (brandName.toLowerCase().includes('arvind') || numericBrandId === 1) {
    brandCountry = 'IN'
  }
  
  // US brands
  if (brandName.toLowerCase().includes('walmart') || numericBrandId === 5 ||
      brandName.toLowerCase().includes('zara') || numericBrandId === 6) {
    brandCountry = 'US'
  }
  
  // Debug log
  console.log(`generateBrandSpecificQueries Debug:`, {
    brandName,
    brandId,
    numericBrandId,
    detectedCountry: brandCountry,
    brandIdType: typeof brandId
  })
  
  // Gender-specific context
  const genderTerms: Record<string, string[]> = {
    female: ['women', 'womens', 'ladies', 'female', 'girl', 'feminine'],
    male: ['men', 'mens', 'guys', 'male', 'masculine'],
    all: ['unisex', 'gender-neutral', 'everyone']
  }
  const genderContext = genderTerms[targetGender as string] || genderTerms.all
  
  // Age-specific context with more granularity
  let ageContext: string[] = []
  if (targetAgeMax <= 18) {
    ageContext = ['teen', 'teenager', 'high school', 'young']
  } else if (targetAgeMin >= 18 && targetAgeMax <= 25) {
    ageContext = ['gen z', 'college', 'university', 'young adult']
  } else if (targetAgeMin >= 25 && targetAgeMax <= 35) {
    ageContext = ['millennial', 'young professional', 'career']
  } else if (targetAgeMin >= 35 && targetAgeMax <= 45) {
    ageContext = ['established', 'professional', 'family']
  } else if (targetAgeMin >= 45) {
    ageContext = ['mature', 'sophisticated', 'executive', 'luxury']
  }
  
  // Price-specific terms
  const priceTerms: Record<string, string[]> = {
    high: ['luxury', 'designer', 'premium', 'haute couture', 'exclusive'],
    medium: ['contemporary', 'mid-range', 'accessible luxury', 'premium casual'],
    low: ['affordable', 'budget', 'value', 'fast fashion', 'bargain']
  }
  const priceContext = priceTerms[targetIncomeLevel as string] || priceTerms.medium
  
  // Location-specific context
  const locationContext = targetLocations.length > 0 ? targetLocations[0] : brandCountry
  
  // Core trend discovery queries - REGION-SPECIFIC
  let allCoreTrendQueries = []
  
  if (brandCountry === 'BR') {
    // Brazilian-specific queries
    allCoreTrendQueries = [
      // Brazilian TikTok trends
      `site:tiktok.com.br #moda ${timeContexts[0]} trending viral brasil`,
      `site:tiktok.com.br #lookdodia #modabrasileira ${timeContexts[1]} fyp`,
      `site:tiktok.com.br #tendencias ${month} ${year} viral`,
      `site:tiktok.com.br moda desafio ${timeContexts[2]} trend`,
      `site:tiktok.com.br truque estilo ${timeContexts[3]} viral`,
      
      // Brazilian Instagram
      `site:instagram.com.br #moda #trending ${timeContexts[0]}`,
      `site:instagram.com.br #streetstyle #fashionista brasil ${timeContexts[1]}`,
      `site:instagram.com.br moda reels trending ${timeContexts[2]}`,
      `site:instagram.com.br ideias look ${month} ${year}`,
      
      // Brazilian Pinterest
      `site:pinterest.com.br moda tendencias ${month} ${year}`,
      `site:pinterest.com.br estilo aesthetic ${season} ${year}`,
      
      // Brazilian hashtags
      `#modabrasil #viral #trending ${timeContexts[0]} tiktok instagram`,
      `moda hashtags brasil ${month} ${year} micro tendencias`,
      `#fashionbr #ootdbrasil ${timeContexts[2]} social media`,
      `#lookbrasileiro #estilo ${timeContexts[3]} influencer`
    ]
  } else if (brandCountry === 'IN') {
    // Indian-specific queries
    allCoreTrendQueries = [
      // Indian TikTok/Instagram trends
      `site:instagram.com #indianfashion ${timeContexts[0]} trending viral india`,
      `site:instagram.com #ootdindia #desifashion ${timeContexts[1]} reels`,
      `site:instagram.com #indianstreetstyle ${month} ${year} viral`,
      `indian fashion trends ${timeContexts[2]} bollywood celebrity`,
      
      // Indian fashion hashtags
      `#indianwear #trending ${timeContexts[0]} instagram reels`,
      `#ethnicwear #fusion ${timeContexts[1]} india fashion`,
      `#indowestern #contemporary ${month} ${year} trends`,
      `#sareenotsorry #modernindian ${timeContexts[2]} viral`,
      
      // Indian fashion platforms
      `site:pinterest.in indian fashion ${month} ${year} trends`,
      `myntra fashion trends ${season} ${year} bestsellers`,
      `indian wedding fashion ${timeContexts[3]} trending`,
      
      // Indian specific searches
      `bollywood fashion ${timeContexts[0]} celebrity style`,
      `indian street style ${timeContexts[1]} delhi mumbai bangalore`,
      `festive fashion india ${season} ${year} trends`,
      `indian fashion influencer ${timeContexts[2]} viral looks`
    ]
  } else if (['FR', 'IT', 'ES', 'DE', 'UK'].includes(brandCountry)) {
    // European queries
    allCoreTrendQueries = [
      // European TikTok
      `site:tiktok.com #fashion ${timeContexts[0]} trending viral europe`,
      `site:tiktok.com #ootd #styleinspo ${timeContexts[1]} european style`,
      `site:tiktok.com fashion trends ${month} ${year} paris milan`,
      
      // European Instagram
      `site:instagram.com #fashioneurope #trending ${timeContexts[0]}`,
      `site:instagram.com european street style ${timeContexts[1]}`,
      `site:instagram.com fashion week ${locationContext} ${timeContexts[2]}`,
      
      // European specific
      `european fashion trends ${month} ${year}`,
      `${locationContext} street style ${timeContexts[0]}`,
      `fashion week ${locationContext} ${season} ${year}`
    ]
  } else {
    // Default (US/Global) queries
    allCoreTrendQueries = [
      // TikTok hashtag trends
      `site:tiktok.com #fashion ${timeContexts[0]} trending viral`,
      `site:tiktok.com #ootd #styleinspo ${timeContexts[1]} fyp`,
      `site:tiktok.com #fashiontrends ${month} ${year} viral`,
      `site:tiktok.com fashion challenge ${timeContexts[2]} trend`,
      
      // Instagram hashtag trends
      `site:instagram.com #fashion #trending ${timeContexts[0]}`,
      `site:instagram.com #streetstyle #fashionista ${timeContexts[1]}`,
      `site:instagram.com fashion reels trending ${timeContexts[2]}`,
      
      // Reddit micro-communities
      `site:reddit.com/r/fashion "trending" "viral" ${timeContexts[0]}`,
      `site:reddit.com/r/streetwear "cop or drop" ${timeContexts[1]}`,
      
      // Pinterest trends
      `site:pinterest.com fashion trends ${month} ${year}`,
      `site:pinterest.com outfit aesthetic ${season} ${year}`,
      
      // Hashtag aggregation
      `#fashion #viral #trending ${timeContexts[0]} tiktok instagram`,
      `fashion hashtags trending ${month} ${year} micro trends`
    ]
  }
  
  // Focus on high-yield sources first
  const highYieldQueries = allCoreTrendQueries.filter(q => 
    q.includes('tiktok.com') || 
    q.includes('instagram.com') || 
    q.includes('pinterest.com') ||
    q.includes('#fashion #viral #trending')
  )
  
  const otherQueries = allCoreTrendQueries.filter(q => !highYieldQueries.includes(q))
  
  // Prioritize high-yield sources
  const coreTrendQueries = [
    ...highYieldQueries.sort(() => Math.random() - 0.5).slice(0, 6),
    ...otherQueries.sort(() => Math.random() - 0.5).slice(0, 4)
  ]
  
  // Brand-specific query generation - enhanced with more variety
  let allBrandQueries = []
  
  if (brandName.toLowerCase().includes('marisa')) {
    // Marisa Lojas specific queries - expanded and varied
    allBrandQueries = [
      `site:tiktok.com.br #modafeminina #marisalojas ${timeContexts[0]}`,
      `site:instagram.com.br #lookdodia #modabrasileira ${timeContexts[1]}`,
      `"marisa lojas" #fashion #trending brasil ${timeContexts[2]}`,
      `#modafeminina #tendencias brasil ${month} ${year} viral`,
      `brazilian fashion hashtags tiktok ${timeContexts[0]} #moda`,
      `moda brasileira ${season} ${year} tendencias`,
      `fashion brasil ${timeContexts[3]} nova coleção`,
      `estilo brasileiro ${month} ${year} trends`,
      `#modabrasil #ootdbrasil ${timeContexts[4]}`,
      `brazilian street style ${timeContexts[5]}`,
      `moda feminina brasil microtrends ${timeContexts[6]}`,
      `tendencias moda brasil ${nextSeason} ${year}`,
      `brazilian fashion influencer ${timeContexts[7]}`,
      `#fashionbr #stylebrasil trending`,
      `moda acessível brasil ${timeContexts[8]}`
    ]
  } else if (brandName.toLowerCase().includes('arvind')) {
    // Arvind Fashions specific queries - Indian market
    allBrandQueries = [
      `#indianfashion #arvind ${timeContexts[0]} trending`,
      `indian menswear ${timeContexts[1]} ${season} trends`,
      `arrow tommy hilfiger calvin klein india ${timeContexts[2]}`,
      `indian formal wear ${timeContexts[3]} office fashion`,
      `#mensfashionindia ${month} ${year} trending styles`,
      `indian wedding menswear ${timeContexts[4]} trends`,
      `sustainable fashion india ${timeContexts[5]} eco`,
      `indian streetwear ${timeContexts[6]} youth fashion`,
      `bollywood menswear inspiration ${timeContexts[7]}`,
      `indian fashion retail ${season} ${year} trends`,
      `premium menswear india ${timeContexts[8]} luxury`,
      `indian ethnic fusion menswear ${timeContexts[0]}`,
      `corporate fashion india ${timeContexts[1]} trends`
    ]
  } else if (brandName.toLowerCase().includes('track') || brandName.toLowerCase().includes('cris barros')) {
    // Other Brazilian brands
    allBrandQueries = [
      `#modabrasileira #${brandName.replace(/\s+/g, '').toLowerCase()} ${timeContexts[0]}`,
      `brazilian luxury fashion ${timeContexts[1]} ${season}`,
      `moda premium brasil ${timeContexts[2]} tendencias`,
      `brazilian designer ${timeContexts[3]} nova coleção`,
      `#fashionbrasil ${brandCategory} ${month} ${year}`,
      `brazilian ${genderContext[0]} fashion ${timeContexts[4]}`,
      `são paulo fashion week ${timeContexts[5]} trends`,
      `brazilian sustainable fashion ${timeContexts[6]}`
    ]
  } else if (brandName.toLowerCase().includes('walmart') || brandName.toLowerCase().includes('zara')) {
    // Walmart and Zara - US market focused queries
    allBrandQueries = [
      `#${brandName.replace(/\s+/g, '').toLowerCase()} #fashion ${timeContexts[0]} trending usa`,
      `site:tiktok.com #ootd #${brandName.replace(/\s+/g, '').toLowerCase()} ${timeContexts[1]}`,
      `site:instagram.com ${brandName} fashion haul ${timeContexts[2]} viral`,
      `${brandName} ${season} ${year} collection trending pieces`,
      `${brandName} fashion trends ${month} ${year} must haves`,
      `${brandName} street style ${timeContexts[3]} outfit ideas`,
      `affordable fashion ${brandName} ${timeContexts[4]} trending`,
      `${brandName} viral tiktok ${timeContexts[5]} fashion finds`,
      `${brandName} instagram reels ${timeContexts[6]} style`,
      `${brandName} fashion influencer ${timeContexts[7]} looks`,
      `${brandName} ${genderContext[0]} fashion ${timeContexts[8]} new`,
      `${brandName} sustainable fashion ${timeContexts[0]} eco`,
      `${brandName} fashion dupes alternatives ${timeContexts[1]}`
    ]
  } else if (brandName.toLowerCase().includes('nike') || brandCategory === 'athletic') {
    // Nike/Athletic specific queries
    allBrandQueries = [
      `${brandName} ${timeContexts[0]} sneaker drops releases`,
      `athletic wear technology ${timeContexts[1]} innovation fabric`,
      `${brandName} athlete collaborations ${month} ${year} new`,
      `sportswear trends ${genderContext[0]} ${timeContexts[2]} fitness`,
      `sneakerhead culture ${timeContexts[3]} ${brandName} releases`,
      `athleisure street style ${timeContexts[4]} ${locationContext}`,
      `performance wear innovation ${season} ${year} ${brandName}`,
      `sustainable athletic ${brandName} ${timeContexts[5]} eco`
    ]
  } else if (brandCategory === 'womenswear') {
    allBrandQueries = [
      `#womensfashion #ootd ${timeContexts[0]} trending viral`,
      `site:tiktok.com #fashion #womenstyle ${timeContexts[1]}`,
      `site:instagram.com #fashionista #styleinspo women ${timeContexts[2]}`,
      `#${season}fashion #womensclothing ${locationContext} trending`,
      `fashion hashtags women ${priceContext[0]} ${timeContexts[0]}`
    ]
  } else if (brandCategory === 'menswear') {
    allBrandQueries = [
      `men fashion ${timeContexts[0]} ${priceContext[0]} style`,
      `menswear ${timeContexts[1]} ${locationContext} street looks`,
      `male fashion influencer ${timeContexts[2]} outfit inspiration`,
      `${season} ${year} men clothing ${priceContext[1]} trends`,
      `men ${ageContext[0]} style ${timeContexts[3]} fashion`,
      `men ${targetLifestyle.join(' ')} fashion ${timeContexts[4]}`,
      `men streetwear ${timeContexts[5]} ${priceContext[0]}`,
      `men business casual ${timeContexts[6]} ${year} trends`
    ]
  } else if (brandCategory === 'accessories') {
    allBrandQueries = [
      `accessories ${timeContexts[0]} ${priceContext[0]} trending`,
      `handbag trends ${timeContexts[1]} ${genderContext[0]} new`,
      `jewelry fashion ${timeContexts[2]} ${season} ${year}`,
      `shoes footwear ${timeContexts[3]} ${priceContext[1]} latest`,
      `belt wallet accessories ${timeContexts[4]} ${ageContext[0]}`,
      `designer accessories ${timeContexts[5]} ${locationContext}`,
      `sustainable accessories ${timeContexts[6]} eco friendly`,
      `tech accessories fashion ${timeContexts[7]} innovative`
    ]
  } else if (brandCategory === 'beauty') {
    allBrandQueries = [
      `beauty trends ${timeContexts[0]} makeup skincare new`,
      `${locationContext} beauty influencer ${timeContexts[1]} looks`,
      `tiktok beauty ${timeContexts[2]} viral products ${year}`,
      `${season} ${year} beauty trends ${priceContext[0]} products`,
      `clean beauty ${timeContexts[3]} sustainable ${genderContext[0]}`,
      `beauty tech innovation ${timeContexts[4]} devices tools`,
      `instagram beauty ${timeContexts[5]} ${ageContext[0]} trends`,
      `skincare routine ${timeContexts[6]} ${priceContext[1]} products`
    ]
  } else {
    // Generic but still specific queries
    allBrandQueries = [
      `${brandCategory} fashion ${timeContexts[0]} ${priceContext[0]} trends`,
      `${locationContext} ${brandCategory} ${timeContexts[1]} street style`,
      `${genderContext[0]} ${brandCategory} ${timeContexts[2]} instagram looks`,
      `${season} ${year} ${brandCategory} ${priceContext[1]} new arrivals`,
      `${ageContext[0]} ${brandCategory} fashion ${timeContexts[3]} trending`,
      `${targetLifestyle.join(' ')} ${brandCategory} ${timeContexts[4]} style`,
      `sustainable ${brandCategory} ${timeContexts[5]} eco fashion`,
      `tiktok ${brandCategory} ${timeContexts[6]} viral ${year}`
    ]
  }
  
  // Platform queries already included in core and brand queries
  const platformQueries: string[] = []
  
  // Shuffle brand queries and select varied ones - reduced for speed
  const brandQueries = allBrandQueries.length > 0 
    ? allBrandQueries.sort(() => Math.random() - 0.5).slice(0, 5) // Reduced from 10 to 5
    : []
  
  // Combine all queries - optimized for more trends
  const allQueries = [...coreTrendQueries, ...brandQueries]
    .map(q => q.replace(/\s+/g, ' ').trim())
    .filter((q, index, self) => self.indexOf(q) === index) // Remove duplicates
    .sort(() => Math.random() - 0.5) // Final shuffle
    .slice(0, 12) // 12 queries for balance of speed and coverage
  
  return allQueries
}

function getSeason() {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'spring'
  if (month >= 5 && month <= 7) return 'summer'
  if (month >= 8 && month <= 10) return 'fall'
  return 'winter'
}

function getNextSeason() {
  const month = new Date().getMonth()
  if (month >= 2 && month <= 4) return 'summer'
  if (month >= 5 && month <= 7) return 'fall'
  if (month >= 8 && month <= 10) return 'winter'
  return 'spring'
}

// Parse trends using OpenAI - upgraded to GPT-4 for better extraction
async function parseTrendsWithAI(content: string, url: string, brandInfo?: any) {
  try {
    const brandName = brandInfo?.brand_name || 'fashion'
    const brandCategory = brandInfo?.category || 'general'
    const targetGender = brandInfo?.target_gender || 'all'
    const priceLevel = brandInfo?.target_income_level || 'medium'
    
    // Determine brand country based on known brands
    let brandCountry = brandInfo?.country || 'US'
    
    // Brazilian brands
    if (brandName.toLowerCase().includes('marisa') || brandInfo?.brand_id === 13 ||
        brandName.toLowerCase().includes('track') || brandInfo?.brand_id === 7 ||
        brandName.toLowerCase().includes('cris barros') || brandInfo?.brand_id === 2) {
      brandCountry = 'BR'
    }
    
    // Indian brands
    if (brandName.toLowerCase().includes('arvind') || brandInfo?.brand_id === 1) {
      brandCountry = 'IN'
    }
    
    // US brands
    if (brandName.toLowerCase().includes('walmart') || brandInfo?.brand_id === 5 ||
        brandName.toLowerCase().includes('zara') || brandInfo?.brand_id === 6) {
      brandCountry = 'US'
    }
    
    const prompt = `Extract 5-8 VERY SPECIFIC fashion trends from this content that are relevant to ${brandName} (${brandCategory} brand, ${targetGender} market, ${priceLevel} price point).

IMPORTANT: 
1. Focus on micro-trends and hashtag-driven trends
2. Look for specific hashtags, viral challenges, and niche fashion movements
3. Format trend names properly with correct spacing (e.g., "Dark Academia Style" not "darkacademia")
4. Include hashtags where relevant but ensure the name is readable

Content: ${content.slice(0, 3500)}
Source: ${url}

For each trend, provide a JSON array with these exact fields:
- name: Properly formatted trend name with correct spacing. Examples:
  - "Miu Miu Ballet Flats" (not "MiuMiuBalletFlats")
  - "#DarkAcademia Aesthetic" (hashtag + proper spacing)
  - "Y2K Low Rise Jeans" (not "Y2KLowRiseJeans")
  - "Coastal Grandmother Style" (not "coastalgrandmotherstyle")
- description: Include relevant hashtags, platform where it's trending (1-2 sentences)
- category: One of: hashtag-trend, micro-trend, aesthetic, viral-item, challenge, subculture-style, platform-specific, color, pattern, silhouette, general
- is_forecast: true if future/upcoming, false otherwise
- relevance: 0.5-1.0 based on brand fit (be generous)
- confidence: 0.5-1.0 based on trend strength
- specifics: Object with fields like:
  - hashtags: ["#fashion", "#trending", etc]
  - platforms: ["tiktok", "instagram", "reddit"]
  - engagement: "1M views", "50K posts" if mentioned
  - brands: [specific brands mentioned]
  - colors: [exact colors/colorways]
  - price_range: "$X-Y" if mentioned
  - influencers: [specific people/accounts]
  - viral_platform: "tiktok"/"instagram"/etc
  - originator: who/what started this trend

Important: Return ONLY a valid JSON array. Extract SPECIFIC items with properly formatted names, not general categories.`

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1500
    })
    
    let trendsJson = response.choices[0].message.content?.trim() || '[]'
    
    // Clean up response
    trendsJson = trendsJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
    
    // Try to parse
    let trends = []
    try {
      trends = JSON.parse(trendsJson)
      if (!Array.isArray(trends)) {
        console.error('AI response is not an array:', trendsJson)
        return []
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', trendsJson)
      return []
    }
    
    // Add brand-specific demographics and validate
    return trends
      .filter(trend => trend.name && trend.category) // Must have at least name and category
      .slice(0, 8) // Max 8 trends per source
      .map((trend: any) => ({
        name: trend.name,
        description: trend.description || `${trend.name} is trending in ${brandName}`,
        category: trend.category || 'general',
        is_forecast: trend.is_forecast === true,
        relevance: trend.relevance || 0.8,
        confidence: trend.confidence || 0.8,
        specifics: trend.specifics || {},
        demographics: {
          age_min: trend.demographics?.age_min || 18,
          age_max: trend.demographics?.age_max || 65,
          gender: trend.demographics?.gender || 'unisex',
          locations: trend.demographics?.locations || (
            // Set locations based on brand country
            brandCountry === 'BR' ? ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador'] :
            brandCountry === 'IN' ? ['Mumbai', 'Delhi', 'Bangalore', 'Chennai'] :
            ['New York', 'Los Angeles', 'London', 'Paris']
          ),
          income_level: trend.demographics?.income_level || 'medium',
          lifestyle: trend.demographics?.lifestyle || ['fashion-forward'],
          interests: trend.demographics?.interests || ['fashion', 'style']
        },
        source_url: url,
        extracted_at: new Date().toISOString()
      }))
  } catch (error) {
    console.error('AI parsing error:', error)
    return []
  }
}

// Calculate trend metrics with real-time adjustments
function calculateTrendMetrics(trend: any, sourceCount: number) {
  const now = new Date()
  
  // Check if trend has viral indicators
  const hasViralIndicators = trend.specifics?.viral_platform || 
    trend.description?.toLowerCase().includes('viral') ||
    trend.description?.toLowerCase().includes('trending') ||
    trend.description?.toLowerCase().includes('tiktok') ||
    trend.description?.toLowerCase().includes('instagram')
  
  // Base momentum on recency and viral status
  let baseMomentum = 50
  if (hasViralIndicators) baseMomentum = 75
  if (trend.extracted_at && new Date(trend.extracted_at).getDate() === now.getDate()) baseMomentum += 15
  if (sourceCount > 3) baseMomentum += 10
  
  const momentum = Math.min(100, baseMomentum + (sourceCount * 5) + Math.random() * 10)
  
  // Velocity - higher for viral/recent trends
  const baseVelocity = hasViralIndicators ? 15 : 8
  const velocity = Math.min(30, baseVelocity + (sourceCount * 3) + Math.random() * 5)
  
  // Lifecycle stage based on real indicators
  let lifecycle = 'emerging'
  if (hasViralIndicators && momentum > 85) {
    lifecycle = 'viral'
  } else if (momentum > 75) {
    lifecycle = 'growing'
  } else if (momentum > 60) {
    lifecycle = 'peak'
  } else if (momentum > 40) {
    lifecycle = 'established'
  }
  
  // Adoption rate - based on specifics
  const hasInfluencers = trend.specifics?.influencers?.length > 0
  const baseAdoption = hasInfluencers ? 0.4 : 0.2
  const adoption = Math.min(1, baseAdoption + (momentum / 100) * 0.4)
  
  // Social reach - use real data if available
  let socialReach = 50000
  if (hasViralIndicators) socialReach = 500000
  if (trend.specifics?.viral_platform === 'tiktok') socialReach = 1000000
  if (trend.specifics?.viral_platform === 'instagram') socialReach = 750000
  socialReach = Math.floor(socialReach + (momentum * 10000) + Math.random() * 100000)
  
  // Risk score - lower for established brands/trends
  const hasBrandMentions = trend.specifics?.brands?.length > 0
  const risk = hasBrandMentions ? 0.1 + Math.random() * 0.1 : 0.2 + Math.random() * 0.2
  
  // Conversion impact - higher for specific items with prices
  const hasPriceInfo = trend.specifics?.price_range
  const baseConversion = hasPriceInfo ? 0.15 : 0.08
  const conversion = Math.min(0.5, baseConversion + (momentum / 100) * 0.2 + (adoption * 0.1))
  
  // Peak prediction - much shorter for viral trends
  let daysToPeak = 14 // Default 2 weeks
  if (hasViralIndicators) daysToPeak = 7 // 1 week for viral
  if (lifecycle === 'viral') daysToPeak = 3 // Already viral, peak soon
  if (lifecycle === 'peak') daysToPeak = 0 // Already at peak
  
  daysToPeak = Math.max(0, daysToPeak + Math.floor(Math.random() * 7 - 3)) // Add some variance
  const peakDate = new Date(now.getTime() + daysToPeak * 24 * 60 * 60 * 1000)
  
  // Decline prediction - shorter cycles for fast fashion
  const daysToDecline = hasViralIndicators ? 30 : 60 // 1-2 months after peak
  const declineDate = new Date(peakDate.getTime() + daysToDecline * 24 * 60 * 60 * 1000)
  
  return {
    momentum_score: Math.round(momentum),
    velocity: Math.round(velocity * 10) / 10,
    lifecycle_stage: lifecycle,
    adoption_rate: Math.round(adoption * 100) / 100,
    competitor_adoption: Math.round(Math.random() * 0.6 * 100) / 100,
    seasonality_factor: Math.round((0.5 + Math.random() * 0.5) * 100) / 100,
    predicted_peak_date: peakDate.toISOString().split('T')[0],
    predicted_decline_date: declineDate.toISOString().split('T')[0],
    social_reach: socialReach,
    conversion_impact: Math.round(conversion * 100) / 100,
    risk_score: Math.round(risk * 100) / 100,
    // Add demographics from trend
    target_age_min: trend.demographics?.age_min || 18,
    target_age_max: trend.demographics?.age_max || 65,
    target_gender: trend.demographics?.gender || 'unisex',
    target_locations: trend.demographics?.locations || ['Global'],
    target_income_level: trend.demographics?.income_level || 'medium',
    target_lifestyle: trend.demographics?.lifestyle || ['fashion-forward'],
    target_interests: trend.demographics?.interests || ['fashion', 'style']
  }
}

// Store recently searched URLs in memory (resets on server restart)
const recentlySearchedUrls = new Set<string>()
const MAX_URL_HISTORY = 200 // Keep track of last 200 URLs

// Clean up old URLs periodically
function cleanupUrlHistory() {
  if (recentlySearchedUrls.size > MAX_URL_HISTORY) {
    const urlArray = Array.from(recentlySearchedUrls)
    const toRemove = urlArray.slice(0, urlArray.length - MAX_URL_HISTORY)
    toRemove.forEach(url => recentlySearchedUrls.delete(url))
  }
}

// Determine source type from URL
function determineSourceType(url: string): string {
  const domain = new URL(url).hostname.toLowerCase()
  
  if (domain.includes('tiktok') || domain.includes('instagram') || 
      domain.includes('twitter') || domain.includes('pinterest') || 
      domain.includes('youtube') || domain.includes('reddit')) {
    return 'social'
  } else if (domain.includes('vogue') || domain.includes('elle') || 
             domain.includes('harpersbazaar') || domain.includes('wwd') ||
             domain.includes('fashionista') || domain.includes('glamour')) {
    return 'publication'
  } else if (domain.includes('zara') || domain.includes('hm') || 
             domain.includes('asos') || domain.includes('nordstrom') ||
             domain.includes('ssense') || domain.includes('net-a-porter')) {
    return 'retail'
  } else if (domain.includes('blog') || domain.includes('wordpress')) {
    return 'blog'
  } else if (domain.includes('forum') || domain.includes('community')) {
    return 'forum'
  }
  return 'other'
}

// Save trend sources to the trend_sources table
async function saveTrendSources(trendId: number, sources: string[], allTrends: any[], trendIdentifier: string) {
  if (sources.length === 0) return
  
  try {
    // Prepare source records
    const sourceRecords = sources.map(sourceUrl => {
      // Find the original trend data that came from this source
      const sourceTrend = allTrends.find(t => 
        t.source_url === sourceUrl && 
        t.name.toLowerCase().replace(/^#/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') === trendIdentifier
      )
      
      return {
        trend_id: trendId,
        source_url: sourceUrl,
        source_type: determineSourceType(sourceUrl),
        source_title: sourceTrend?.source_title || null,
        extracted_at: new Date().toISOString(),
        relevance_score: sourceTrend?.confidence || 0.8
      }
    })
    
    // Insert source records (ignore duplicates)
    const { error } = await supabaseService
      .from('trend_sources')
      .upsert(sourceRecords, {
        onConflict: 'trend_id,source_url',
        ignoreDuplicates: true
      })
    
    if (error) {
      console.error(`Error inserting sources for trend ${trendIdentifier}:`, error)
    }
  } catch (error) {
    console.error(`Error saving trend sources:`, error)
  }
}

export async function POST(request: Request) {
  const { stream, sendProgress, close } = createProgressStream()
  
  // Start the async processing
  const processPromise = (async () => {
    try {
      const startTime = Date.now()
      
      sendProgress('Starting Fashion Trend Agent...')
      
      // Get the request body to extract user email
      let userEmail = null
      let selectedBrandId = null
      try {
        const body = await request.json()
        userEmail = body.userEmail
        selectedBrandId = body.selectedBrandId
      } catch (e) {
        // Body might not be JSON, that's okay
        console.log('Could not parse request body:', e)
      }
      
      // Fetch user's brand info from database
      let brandInfo = null
      let brandDataComplete = false
      
      if (selectedBrandId) {
        // Use selected brand if provided
        try {
          const { data: brandData, error: brandError } = await supabaseService
            .from('brands')
            .select('*')
            .eq('brand_id', parseInt(selectedBrandId))
            .single()
          
          if (brandData && !brandError) {
            brandInfo = brandData
            
            // Check if brand data is complete
            brandDataComplete = !!(
              brandData.brand_name &&
              brandData.category &&
              brandData.target_gender &&
              brandData.target_age_min &&
              brandData.target_age_max &&
              brandData.target_income_level
            )
            
            if (brandDataComplete) {
              sendProgress(`Using brand context: ${brandData.brand_name} (${brandData.category})`)
            } else {
              sendProgress(`Warning: Incomplete brand profile. Please complete your account setup for better trend recommendations.`)
            }
          }
        } catch (error) {
          console.error('Error fetching brand info:', error)
        }
      } else if (userEmail) {
        // Fall back to user's default brand
        try {
          // First get the user to find their brand_id
          const { data: userData, error: userError } = await supabaseService
            .from('usr')
            .select('brand_id')
            .eq('email', userEmail)
            .single()
          
          if (userData?.brand_id && !userError) {
            // Then get the brand details
            const { data: brandData, error: brandError } = await supabaseService
              .from('brands')
              .select('*')
              .eq('brand_id', userData.brand_id)
              .single()
            
            if (brandData && !brandError) {
              brandInfo = brandData
              
              // Check if brand data is complete
              brandDataComplete = !!(
                brandData.brand_name &&
                brandData.category &&
                brandData.target_gender &&
                brandData.target_age_min &&
                brandData.target_age_max &&
                brandData.target_income_level
              )
              
              if (brandDataComplete) {
                sendProgress(`Using brand context: ${brandData.brand_name} (${brandData.category})`)
              } else {
                sendProgress(`Warning: Incomplete brand profile. Please complete your account setup for better trend recommendations.`)
              }
            }
          }
        } catch (error) {
          console.error('Error fetching brand info:', error)
        }
      }
      
      // If no brand info found, use defaults
      if (!brandInfo) {
        brandInfo = { 
          brand_name: 'Fashion Brand', 
          category: 'general',
          target_gender: 'all',
          target_age_min: 18,
          target_age_max: 65,
          target_income_level: 'medium',
          target_lifestyle: ['urban', 'fashion-forward'],
          target_interests: ['fashion', 'style']
        }
        sendProgress('Using default fashion context')
      }
      
      // Generate brand-specific queries
      const queries = generateBrandSpecificQueries(brandInfo)
      sendProgress(`Generated ${queries.length} brand-specific queries`)
      
      // Get brand-specific sources
      const brandSources = getBrandSpecificSources(brandInfo)
      sendProgress(`Using ${brandSources.length} brand-relevant sources`)
      
      // Debug logging to understand the issue
      const brandName = brandInfo?.brand_name?.toLowerCase() || ''
      const brandId = brandInfo?.brand_id
      const numericBrandId = typeof brandId === 'string' ? parseInt(brandId) : brandId
      let debugCountry = 'US'
      
      // More flexible brand name matching
      if (brandName.includes('marisa') || numericBrandId === 13 ||
          brandName.includes('track') || numericBrandId === 7 ||
          brandName.includes('cris barros') || numericBrandId === 2) {
        debugCountry = 'BR'
      } else if (brandName.includes('arvind') || numericBrandId === 1) {
        debugCountry = 'IN'
      } else if (brandName.includes('walmart') || numericBrandId === 5 ||
                 brandName.includes('zara') || numericBrandId === 6) {
        debugCountry = 'US'
      }
      
      console.log('Brand Debug Info:', {
        brand_name: brandInfo?.brand_name,
        brand_id: brandInfo?.brand_id,
        numeric_brand_id: numericBrandId,
        brand_id_type: typeof brandInfo?.brand_id,
        detected_country: debugCountry,
        first_query: queries[0],
        first_source: brandSources[0]
      })
      
      const allTrends: any[] = []
      const processedUrls = new Set<string>()
      
      // Process queries with better speed
      for (const query of queries) {
        sendProgress(`Searching: "${query}"...`)
        
        try {
          // Get search results with content, prioritizing brand-specific sources
          const searchResult = await firecrawl.search(query, {
            limit: 5, // Increased back to 5 for more trends
            scrapeOptions: {
              formats: ["markdown"],
              timeout: 1500, // Fast timeout
              waitFor: 100, // Minimal wait
              includeTags: ["article", "main", "section", "div"],
              excludeTags: ["nav", "header", "footer", "aside", "script", "style"]
            }
          })
          
          if (!searchResult.data || searchResult.data.length === 0) {
            sendProgress(`No results for: "${query}"`)
            continue
          }
          
          sendProgress(`Found ${searchResult.data.length} results for: "${query}"`)
          
          // Process each result directly (no re-scraping needed)
          for (const result of searchResult.data) {
            if (!result.url || processedUrls.has(result.url)) continue
            
            // Skip if recently searched
            if (recentlySearchedUrls.has(result.url)) {
              sendProgress(`Skipping recently searched: ${new URL(result.url).hostname}`)
              continue
            }
            
            processedUrls.add(result.url)
            recentlySearchedUrls.add(result.url)
            
            if (!result.markdown || result.markdown.length < 100) {
              sendProgress(`Skipping ${new URL(result.url).hostname} - insufficient content`)
              continue
            }
            
            const domain = new URL(result.url).hostname
            sendProgress(`Extracting trends from ${domain}...`)
            
            const trends = await parseTrendsWithAI(
              result.markdown,
              result.url,
              brandInfo
            )
            
            if (trends.length > 0) {
              sendProgress(`Found ${trends.length} trends from ${domain}`)
              
              // Add source info to each trend
              trends.forEach((trend: any) => {
                allTrends.push({
                  ...trend,
                  source_url: result.url,
                  source_title: result.title || domain
                })
              })
            } else {
              sendProgress(`No trends extracted from ${domain}`)
            }
            
            // Continue collecting trends
          }
          
          // Don't break early - process all queries
        } catch (error) {
          console.error(`Search error for "${query}":`, error)
          sendProgress(`Error searching "${query}": ${error}`)
        }
      }
      
      sendProgress(`Extracted ${allTrends.length} raw trends`)
      
      if (allTrends.length < 30) {
        sendProgress(`WARNING: Only found ${allTrends.length} trends. Continuing with what we have...`)
      }
      
      if (allTrends.length === 0) {
        sendProgress('ERROR: No trends extracted. Please try again in a few moments.')
        sendProgress('ERROR', {
          success: false,
          error: 'No trends could be extracted. The sources might be temporarily unavailable. Please retry.'
        })
        return
      }
      
      // Deduplicate using fuzzy matching and collect all sources
      const uniqueTrends = new Map<string, any>()
      const trendSources = new Map<string, string[]>()
      const trendMentions = new Map<string, number>()
      
      for (const trend of allTrends) {
        if (uniqueTrends.size >= 50) break // Target 50 unique trends
        
        // Check for similar existing trend using fuzzy matching
        const similarTrendId = findSimilarTrend(trend.name, uniqueTrends)
        
        if (similarTrendId) {
          // Update existing trend with new source
          const existingTrend = uniqueTrends.get(similarTrendId)
          const sources = trendSources.get(similarTrendId) || []
          if (!sources.includes(trend.source_url)) {
            sources.push(trend.source_url)
            trendSources.set(similarTrendId, sources)
          }
          trendMentions.set(similarTrendId, (trendMentions.get(similarTrendId) || 1) + 1)
          
          // Update confidence if higher
          if (trend.confidence > existingTrend.confidence) {
            existingTrend.confidence = trend.confidence
          }
        } else {
          // Create a URL-safe identifier while preserving the original name
          const trendId = trend.name.toLowerCase()
            .replace(/^#/, '') // Remove leading hashtag for the ID
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
          
          // Store with properly formatted trend name
          trend.trend_name = trend.name // Preserve original formatted name
          uniqueTrends.set(trendId, trend)
          trendSources.set(trendId, [trend.source_url])
          trendMentions.set(trendId, 1)
        }
      }
      
      sendProgress(`Processing ${uniqueTrends.size} unique trends...`)
      
      // Insert/update trends with better error handling
      let insertedCount = 0
      let updatedCount = 0
      let errorCount = 0
      
      for (const [trendId, trend] of uniqueTrends) {
        try {
          const sources = trendSources.get(trendId) || []
          const mentionCount = trendMentions.get(trendId) || 1
          const metrics = calculateTrendMetrics(trend, mentionCount)
          
          // Balance trend types - 60% signals, 40% forecasts
          const randomFactor = Math.random()
          const shouldBeForecast = trend.is_forecast || randomFactor < 0.3
          
          const trendType = shouldBeForecast && metrics.momentum_score < 70
            ? 'forecast' : 'signal'
          
          // Store the properly formatted name in the description
          let trendDescription = trend.description || `${trend.name} is trending`
          // Prepend the formatted name if not already included
          if (!trendDescription.toLowerCase().includes(trend.name.toLowerCase())) {
            trendDescription = `${trend.trend_name || trend.name}: ${trendDescription}`
          }
          
          // Determine trend region based on brand country and trend locations
          let trendRegion = 'global'
          
          // Check brand type
          const isBrazilianBrand = brandInfo?.brand_name?.toLowerCase().includes('marisa') || 
                                   brandInfo?.brand_id === 13 ||
                                   brandInfo?.brand_name?.toLowerCase().includes('track') ||
                                   brandInfo?.brand_id === 7 ||
                                   brandInfo?.brand_name?.toLowerCase().includes('cris barros') ||
                                   brandInfo?.brand_id === 2 ||
                                   brandInfo?.country === 'BR'
          
          const isIndianBrand = brandInfo?.brand_name?.toLowerCase().includes('arvind') ||
                                brandInfo?.brand_id === 1 ||
                                brandInfo?.country === 'IN'
          
          const isUSBrand = brandInfo?.brand_name?.toLowerCase().includes('walmart') ||
                            brandInfo?.brand_id === 5 ||
                            brandInfo?.brand_name?.toLowerCase().includes('zara') ||
                            brandInfo?.brand_id === 6 ||
                            brandInfo?.country === 'US'
          
          // Implement 70-30 split: 70% regional, 30% global
          const shouldBeRegional = Math.random() < 0.7
          
          if (shouldBeRegional) {
            // Assign regional trend based on brand
            if (isBrazilianBrand || 
                trend.demographics?.locations?.some((loc: string) => 
                  loc.toLowerCase().includes('brazil') || loc.toLowerCase().includes('brasil')
                )) {
              trendRegion = 'brazil'
            } else if (isIndianBrand || 
                trend.demographics?.locations?.some((loc: string) => 
                  loc.toLowerCase().includes('india') || loc.toLowerCase().includes('delhi') ||
                  loc.toLowerCase().includes('mumbai') || loc.toLowerCase().includes('bangalore')
                )) {
              trendRegion = 'india'
            } else if (isUSBrand || 
                trend.demographics?.locations?.some((loc: string) => 
                  loc.toLowerCase().includes('usa') || loc.toLowerCase().includes('united states')
                )) {
              trendRegion = 'usa'
            } else if (['FR', 'IT', 'ES', 'DE', 'UK'].includes(brandInfo?.country || '') ||
                trend.demographics?.locations?.some((loc: string) => 
                  loc.toLowerCase().includes('europe') || loc.toLowerCase().includes('paris') || 
                  loc.toLowerCase().includes('milan') || loc.toLowerCase().includes('london')
                )) {
              trendRegion = 'europe'
            } else if (['JP', 'KR', 'CN'].includes(brandInfo?.country || '') ||
                trend.demographics?.locations?.some((loc: string) => 
                  loc.toLowerCase().includes('asia') || loc.toLowerCase().includes('japan') || 
                  loc.toLowerCase().includes('korea') || loc.toLowerCase().includes('china')
                )) {
              trendRegion = 'asia'
            } else {
              // Default to brand's region if no specific match
              if (isBrazilianBrand) {
                trendRegion = 'brazil'
              } else if (isIndianBrand) {
                trendRegion = 'india'
              } else {
                trendRegion = 'global' // Fallback to global if no region detected
              }
            }
          }
          // Otherwise keep as 'global' (30% of trends)
          
          const trendData = {
            trend_identifier: trendId,
            trend_category: trend.category || 'general',
            trend_description: trendDescription,
            trend_type: trendType,
            trend_region: trendRegion,
            source_urls: sources, // Add source URLs to the trend
            ...metrics,
            last_updated: new Date().toISOString(),
            created_at: new Date().toISOString()
          }
          
          // Log the trend being saved
          console.log(`Saving trend: ${trendId}`, { 
            type: trendType, 
            category: trend.category,
            trendData: JSON.stringify(trendData, null, 2)
          })
          
          // Check if exists
          const { data: existing, error: selectError } = await supabaseService
            .from('trends')
            .select('trend_id')
            .eq('trend_identifier', trendId)
            .maybeSingle()
          
          if (selectError) {
            console.error(`Error checking trend ${trendId}:`, selectError)
            errorCount++
            continue
          }
          
          if (existing) {
            // Update existing trend
            const { data: updated, error: updateError } = await supabaseService
              .from('trends')
              .update(trendData)
              .eq('trend_id', existing.trend_id)
              .select()
              .single()
            
            if (updateError) {
              console.error(`Error updating trend ${trendId}:`, updateError)
              errorCount++
            } else {
              updatedCount++
              sendProgress(`Updated: ${trend.name}`)
              
              // Save new sources for existing trend
              await saveTrendSources(existing.trend_id, sources, allTrends, trendId)
            }
          } else {
            // Insert new
            const { data: inserted, error: insertError } = await supabaseService
              .from('trends')
              .insert(trendData)
              .select()
              .single()
            
            if (insertError) {
              console.error(`Error inserting trend ${trendId}:`, {
                error: insertError,
                message: insertError.message,
                details: insertError.details,
                hint: insertError.hint,
                code: insertError.code
              })
              console.error('Trend data that failed:', JSON.stringify(trendData, null, 2))
              errorCount++
              sendProgress(`Error adding ${trend.name}: ${insertError.message}`)
            } else {
              insertedCount++
              sendProgress(`Added: ${trend.name}`)
              
              // Save sources for new trend
              if (inserted?.trend_id) {
                await saveTrendSources(inserted.trend_id, sources, allTrends, trendId)
              }
            }
          }
        } catch (error) {
          console.error(`Error processing trend ${trend.name}:`, error)
          errorCount++
        }
      }
      
      const duration = Date.now() - startTime
      const message = `Completed in ${(duration/1000).toFixed(1)}s! Added ${insertedCount} new trends, updated ${updatedCount}${errorCount > 0 ? `, ${errorCount} errors` : ''}`
      
      sendProgress(message)
      
      // Clean up URL history if needed
      cleanupUrlHistory()
      
      // Send final result
      sendProgress('COMPLETE', {
        success: true,
        inserted: insertedCount,
        updated: updatedCount,
        errors: errorCount,
        total: insertedCount + updatedCount,
        duration: duration
      })
      
    } catch (error) {
      console.error('Scraping error:', error)
      sendProgress('ERROR', {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to scrape trends'
      })
    } finally {
      close()
    }
  })()
  
  // Return the stream immediately
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

// GET endpoint for checking status
export async function GET() {
  try {
    const { count } = await supabaseService
      .from('trends')
      .select('*', { count: 'exact', head: true })
    
    return NextResponse.json({
      success: true,
      totalTrends: count || 0,
      message: 'Trend scraping API is ready'
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get status' },
      { status: 500 }
    )
  }
} 