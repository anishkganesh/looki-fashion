// Utility functions for determining product demographics based on category and attributes

interface ProductDemographics {
  target_age_min: number
  target_age_max: number
  target_gender: 'male' | 'female' | 'unisex'
  target_locations: string[]
  target_income_level: 'low' | 'medium' | 'high'
  target_lifestyle: string[]
  target_interests: string[]
}

export function determineProductDemographics(
  productName: string,
  category: string,
  price: number,
  color?: string,
  size?: string
): ProductDemographics {
  // Normalize inputs
  const nameLower = productName.toLowerCase()
  const categoryLower = category.toLowerCase()
  
  // Base demographics
  let demographics: ProductDemographics = {
    target_age_min: 18,
    target_age_max: 65,
    target_gender: 'unisex',
    target_locations: ['Brazil', 'São Paulo', 'Rio de Janeiro'],
    target_income_level: 'medium',
    target_lifestyle: ['urban', 'fashion-conscious'],
    target_interests: ['fashion', 'style', 'shopping']
  }
  
  // Gender detection
  if (nameLower.includes('masculin') || nameLower.includes('homem') || 
      categoryLower.includes('masculin') || categoryLower.includes('homem')) {
    demographics.target_gender = 'male'
    demographics.target_interests.push('menswear')
  } else if (nameLower.includes('feminin') || nameLower.includes('mulher') || 
             categoryLower.includes('feminin') || categoryLower.includes('mulher')) {
    demographics.target_gender = 'female'
    demographics.target_interests.push('womenswear')
  }
  
  // Age range based on category/product type
  if (nameLower.includes('infantil') || nameLower.includes('criança') || 
      nameLower.includes('bebê') || categoryLower.includes('kids')) {
    demographics.target_age_min = 0
    demographics.target_age_max = 12
    demographics.target_interests.push('children', 'family')
  } else if (nameLower.includes('teen') || nameLower.includes('jovem')) {
    demographics.target_age_min = 13
    demographics.target_age_max = 19
    demographics.target_interests.push('youth', 'trends')
  } else if (nameLower.includes('plus') || nameLower.includes('curvy')) {
    demographics.target_age_min = 25
    demographics.target_age_max = 55
    demographics.target_interests.push('plus-size', 'body-positive')
  }
  
  // Category-specific adjustments
  if (categoryLower.includes('esport') || categoryLower.includes('fitness') || 
      categoryLower.includes('athletic')) {
    demographics.target_lifestyle.push('active', 'fitness')
    demographics.target_interests.push('sports', 'wellness', 'gym')
    demographics.target_age_max = 45
  } else if (categoryLower.includes('formal') || categoryLower.includes('social')) {
    demographics.target_lifestyle.push('professional', 'social')
    demographics.target_interests.push('business', 'events')
    demographics.target_age_min = 25
  } else if (categoryLower.includes('casual') || categoryLower.includes('basic')) {
    demographics.target_lifestyle.push('casual', 'everyday')
    demographics.target_interests.push('comfort', 'basics')
  } else if (categoryLower.includes('festa') || categoryLower.includes('party')) {
    demographics.target_lifestyle.push('social', 'nightlife')
    demographics.target_interests.push('parties', 'events', 'nightlife')
    demographics.target_age_min = 18
    demographics.target_age_max = 35
  }
  
  // Price-based income level
  if (price < 50) {
    demographics.target_income_level = 'low'
    demographics.target_interests.push('value', 'deals')
  } else if (price > 200) {
    demographics.target_income_level = 'high'
    demographics.target_interests.push('premium', 'quality')
    demographics.target_lifestyle.push('affluent')
  }
  
  // Seasonal adjustments
  if (nameLower.includes('verão') || nameLower.includes('praia') || 
      categoryLower.includes('swim')) {
    demographics.target_interests.push('beach', 'summer', 'vacation')
    demographics.target_lifestyle.push('outdoor')
  } else if (nameLower.includes('inverno') || nameLower.includes('frio')) {
    demographics.target_interests.push('winter', 'cozy')
  }
  
  // Style-specific
  if (nameLower.includes('vintage') || nameLower.includes('retrô')) {
    demographics.target_interests.push('vintage', 'retro')
    demographics.target_lifestyle.push('creative', 'artistic')
  } else if (nameLower.includes('sustentável') || nameLower.includes('eco')) {
    demographics.target_interests.push('sustainability', 'eco-friendly')
    demographics.target_lifestyle.push('conscious', 'sustainable')
  }
  
  // Remove duplicates from arrays
  demographics.target_lifestyle = [...new Set(demographics.target_lifestyle)]
  demographics.target_interests = [...new Set(demographics.target_interests)]
  
  return demographics
}

// Generate realistic inventory metrics based on product type and price
export function generateInventoryMetrics(
  productName: string,
  category: string,
  price: number
): {
  current_inventory_level: number
  inventory_velocity: number
  days_of_supply: number
  units_sold_last_30d: number
  revenue_last_30d: number
  conversion_rate: number
  return_rate: number
} {
  const nameLower = productName.toLowerCase()
  const categoryLower = category.toLowerCase()
  
  // Base metrics
  let metrics = {
    current_inventory_level: 50,
    inventory_velocity: 2.5,
    days_of_supply: 20,
    units_sold_last_30d: 25,
    revenue_last_30d: 2500,
    conversion_rate: 2.5,
    return_rate: 5.0
  }
  
  // Adjust based on product type
  if (categoryLower.includes('basic') || nameLower.includes('básico')) {
    // Basics sell more consistently
    metrics.current_inventory_level = 100
    metrics.inventory_velocity = 4.0
    metrics.days_of_supply = 25
    metrics.units_sold_last_30d = 120
    metrics.conversion_rate = 3.5
    metrics.return_rate = 3.0
  } else if (categoryLower.includes('festa') || categoryLower.includes('party')) {
    // Party wear has lower velocity
    metrics.current_inventory_level = 20
    metrics.inventory_velocity = 1.0
    metrics.days_of_supply = 30
    metrics.units_sold_last_30d = 10
    metrics.conversion_rate = 1.5
    metrics.return_rate = 8.0
  } else if (categoryLower.includes('trend') || nameLower.includes('trend')) {
    // Trendy items sell fast initially
    metrics.current_inventory_level = 40
    metrics.inventory_velocity = 3.5
    metrics.days_of_supply = 12
    metrics.units_sold_last_30d = 50
    metrics.conversion_rate = 4.0
    metrics.return_rate = 6.0
  }
  
  // Price adjustments
  if (price < 50) {
    // Lower price = higher volume
    metrics.units_sold_last_30d = Math.floor(metrics.units_sold_last_30d * 1.5)
    metrics.conversion_rate = Math.min(5.0, metrics.conversion_rate * 1.3)
  } else if (price > 200) {
    // Higher price = lower volume
    metrics.units_sold_last_30d = Math.floor(metrics.units_sold_last_30d * 0.5)
    metrics.conversion_rate = Math.max(1.0, metrics.conversion_rate * 0.7)
    metrics.return_rate = Math.min(10.0, metrics.return_rate * 1.5)
  }
  
  // Calculate revenue based on actual units and price
  metrics.revenue_last_30d = metrics.units_sold_last_30d * price
  
  // Add some randomness for realism (±20%)
  Object.keys(metrics).forEach(key => {
    if (key !== 'revenue_last_30d') {
      const variance = 0.2
      const min = metrics[key as keyof typeof metrics] * (1 - variance)
      const max = metrics[key as keyof typeof metrics] * (1 + variance)
      metrics[key as keyof typeof metrics] = Number((min + Math.random() * (max - min)).toFixed(2))
    }
  })
  
  return metrics
}

// Generate style attributes based on product information
export function generateStyleAttributes(
  productName: string,
  category: string,
  color?: string,
  description?: string
): Record<string, any> {
  const nameLower = productName.toLowerCase()
  const categoryLower = category.toLowerCase()
  const descLower = (description || '').toLowerCase()
  
  const attributes: Record<string, any> = {}
  
  // Pattern/Print
  if (nameLower.includes('listrad') || nameLower.includes('stripe')) {
    attributes.pattern = 'striped'
  } else if (nameLower.includes('floral') || nameLower.includes('flores')) {
    attributes.pattern = 'floral'
  } else if (nameLower.includes('xadrez') || nameLower.includes('plaid')) {
    attributes.pattern = 'plaid'
  } else if (nameLower.includes('poá') || nameLower.includes('polka')) {
    attributes.pattern = 'polka dot'
  } else if (nameLower.includes('lisa') || nameLower.includes('solid')) {
    attributes.pattern = 'solid'
  } else if (nameLower.includes('estampa') || nameLower.includes('print')) {
    attributes.pattern = 'printed'
  }
  
  // Fit/Cut
  if (nameLower.includes('skinny') || nameLower.includes('justo')) {
    attributes.fit = 'skinny'
  } else if (nameLower.includes('slim')) {
    attributes.fit = 'slim'
  } else if (nameLower.includes('regular') || nameLower.includes('reto')) {
    attributes.fit = 'regular'
  } else if (nameLower.includes('oversized') || nameLower.includes('largo')) {
    attributes.fit = 'oversized'
  } else if (nameLower.includes('relaxed') || nameLower.includes('comfort')) {
    attributes.fit = 'relaxed'
  }
  
  // Neckline
  if (nameLower.includes('gola v') || nameLower.includes('v-neck')) {
    attributes.neckline = 'v-neck'
  } else if (nameLower.includes('gola alta') || nameLower.includes('turtleneck')) {
    attributes.neckline = 'turtleneck'
  } else if (nameLower.includes('decote') || nameLower.includes('scoop')) {
    attributes.neckline = 'scoop'
  } else if (nameLower.includes('canoa') || nameLower.includes('boat')) {
    attributes.neckline = 'boat'
  }
  
  // Sleeve length
  if (nameLower.includes('manga longa') || nameLower.includes('long sleeve')) {
    attributes.sleeve_length = 'long'
  } else if (nameLower.includes('manga curta') || nameLower.includes('short sleeve')) {
    attributes.sleeve_length = 'short'
  } else if (nameLower.includes('sem manga') || nameLower.includes('sleeveless')) {
    attributes.sleeve_length = 'sleeveless'
  } else if (nameLower.includes('3/4')) {
    attributes.sleeve_length = '3/4'
  }
  
  // Style type
  if (categoryLower.includes('casual') || nameLower.includes('casual')) {
    attributes.style_type = 'casual'
  } else if (categoryLower.includes('formal') || nameLower.includes('social')) {
    attributes.style_type = 'formal'
  } else if (categoryLower.includes('sport') || nameLower.includes('fitness')) {
    attributes.style_type = 'athletic'
  } else if (nameLower.includes('festa') || nameLower.includes('party')) {
    attributes.style_type = 'party'
  } else if (nameLower.includes('trabalho') || nameLower.includes('work')) {
    attributes.style_type = 'work'
  }
  
  // Closure type
  if (nameLower.includes('zíper') || nameLower.includes('zipper')) {
    attributes.closure = 'zipper'
  } else if (nameLower.includes('botão') || nameLower.includes('button')) {
    attributes.closure = 'button'
  } else if (nameLower.includes('elástico') || nameLower.includes('elastic')) {
    attributes.closure = 'elastic'
  }
  
  // Special features
  if (nameLower.includes('bolso') || nameLower.includes('pocket')) {
    attributes.has_pockets = true
  }
  if (nameLower.includes('cinto') || nameLower.includes('belt')) {
    attributes.has_belt = true
  }
  if (nameLower.includes('capuz') || nameLower.includes('hood')) {
    attributes.has_hood = true
  }
  
  // Add color information
  if (color && color !== 'Default' && color !== 'Padrão') {
    attributes.primary_color = color
    
    // Determine if it's a neutral color
    const neutralColors = ['preto', 'branco', 'cinza', 'bege', 'marrom', 'nude', 'black', 'white', 'gray', 'beige', 'brown']
    attributes.is_neutral_color = neutralColors.some(nc => color.toLowerCase().includes(nc))
  }
  
  return attributes
}

// Generate material attributes based on product information  
export function generateMaterialAttributes(
  productName: string,
  category: string,
  price: number,
  description?: string
): Record<string, any> {
  const nameLower = productName.toLowerCase()
  const categoryLower = category.toLowerCase()
  const descLower = (description || '').toLowerCase()
  
  const attributes: Record<string, any> = {}
  
  // Fabric composition
  if (nameLower.includes('algodão') || nameLower.includes('cotton')) {
    attributes.primary_material = 'cotton'
    attributes.material_composition = '100% Cotton'
  } else if (nameLower.includes('jeans') || nameLower.includes('denim')) {
    attributes.primary_material = 'denim'
    attributes.material_composition = '98% Cotton, 2% Elastane'
  } else if (nameLower.includes('poliéster') || nameLower.includes('polyester')) {
    attributes.primary_material = 'polyester'
    attributes.material_composition = '100% Polyester'
  } else if (nameLower.includes('viscose')) {
    attributes.primary_material = 'viscose'
    attributes.material_composition = '100% Viscose'
  } else if (nameLower.includes('linho') || nameLower.includes('linen')) {
    attributes.primary_material = 'linen'
    attributes.material_composition = '100% Linen'
  } else if (nameLower.includes('seda') || nameLower.includes('silk')) {
    attributes.primary_material = 'silk'
    attributes.material_composition = '100% Silk'
  } else if (nameLower.includes('lã') || nameLower.includes('wool')) {
    attributes.primary_material = 'wool'
    attributes.material_composition = '100% Wool'
  } else if (nameLower.includes('couro') || nameLower.includes('leather')) {
    attributes.primary_material = 'leather'
    attributes.material_composition = 'Genuine Leather'
  } else {
    // Default based on category and price
    if (categoryLower.includes('sport') || categoryLower.includes('fitness')) {
      attributes.primary_material = 'polyester blend'
      attributes.material_composition = '85% Polyester, 15% Elastane'
    } else if (price < 50) {
      attributes.primary_material = 'cotton blend'
      attributes.material_composition = '60% Cotton, 40% Polyester'
    } else if (price > 200) {
      attributes.primary_material = 'premium blend'
      attributes.material_composition = '70% Cotton, 25% Polyester, 5% Elastane'
    } else {
      attributes.primary_material = 'mixed fabric'
      attributes.material_composition = '65% Polyester, 35% Cotton'
    }
  }
  
  // Fabric properties
  if (nameLower.includes('stretch') || nameLower.includes('elástic')) {
    attributes.has_stretch = true
  }
  if (nameLower.includes('respirável') || nameLower.includes('breathable')) {
    attributes.is_breathable = true
  }
  if (nameLower.includes('impermeável') || nameLower.includes('waterproof')) {
    attributes.is_waterproof = true
  }
  
  // Care instructions
  attributes.care_instructions = []
  
  if (attributes.primary_material === 'cotton' || attributes.primary_material === 'cotton blend') {
    attributes.care_instructions = ['Machine wash cold', 'Tumble dry low', 'Iron medium heat']
  } else if (attributes.primary_material === 'silk' || attributes.primary_material === 'wool') {
    attributes.care_instructions = ['Dry clean only', 'Do not bleach', 'Iron low heat']
  } else if (attributes.primary_material === 'polyester' || attributes.primary_material === 'polyester blend') {
    attributes.care_instructions = ['Machine wash warm', 'Do not bleach', 'Tumble dry low']
  } else if (attributes.primary_material === 'leather') {
    attributes.care_instructions = ['Professional leather cleaning', 'Condition regularly', 'Store in cool dry place']
  } else {
    attributes.care_instructions = ['Machine wash cold', 'Hang dry', 'Iron as needed']
  }
  
  // Sustainability
  if (nameLower.includes('sustentável') || nameLower.includes('eco') || nameLower.includes('organic')) {
    attributes.is_sustainable = true
    attributes.sustainability_features = ['Eco-friendly materials', 'Sustainable production']
  }
  
  // Weight/Season
  if (nameLower.includes('leve') || nameLower.includes('light')) {
    attributes.fabric_weight = 'light'
    attributes.suitable_seasons = ['spring', 'summer']
  } else if (nameLower.includes('pesado') || nameLower.includes('heavy')) {
    attributes.fabric_weight = 'heavy'
    attributes.suitable_seasons = ['fall', 'winter']
  } else {
    attributes.fabric_weight = 'medium'
    attributes.suitable_seasons = ['all seasons']
  }
  
  return attributes
} 