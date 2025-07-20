// Standardized clothing article categories
export const CLOTHING_CATEGORIES = {
  // Tops
  'shirts': ['shirt', 'shirts', 'polo', 'polo-shirt', 'polo-shirts', 'button-down', 'dress-shirt', 'blouse', 'blouses', 'top', 'tops'],
  't-shirts': ['t-shirt', 't-shirts', 'tee', 'tees', 'tshirt', 'tshirts', 'graphic-tee'],
  'sweaters': ['sweater', 'sweaters', 'pullover', 'jumper', 'jumpers', 'cardigan', 'cardigans', 'knitwear'],
  'hoodies': ['hoodie', 'hoodies', 'sweatshirt', 'sweatshirts', 'fleece'],
  'jackets': ['jacket', 'jackets', 'blazer', 'blazers', 'bomber', 'denim-jacket', 'leather-jacket'],
  'coats': ['coat', 'coats', 'overcoat', 'trench', 'trench-coat', 'parka', 'peacoat'],
  'vests': ['vest', 'vests', 'waistcoat', 'gilet'],
  
  // Bottoms
  'pants': ['pants', 'trousers', 'chinos', 'slacks', 'cargo-pants', 'track-pants'],
  'jeans': ['jeans', 'denim', 'denim-pants', 'skinny-jeans', 'straight-jeans', 'bootcut'],
  'shorts': ['shorts', 'short', 'bermuda', 'bermudas', 'board-shorts'],
  'skirts': ['skirt', 'skirts', 'mini-skirt', 'midi-skirt', 'maxi-skirt', 'pencil-skirt', 'a-line-skirt'],
  'leggings': ['leggings', 'tights', 'yoga-pants', 'athletic-tights'],
  
  // Full body
  'dresses': ['dress', 'dresses', 'gown', 'gowns', 'sundress', 'cocktail-dress', 'maxi-dress', 'midi-dress', 'mini-dress'],
  'jumpsuits': ['jumpsuit', 'jumpsuits', 'romper', 'rompers', 'playsuit', 'overalls'],
  
  // Footwear
  'shoes': ['shoes', 'shoe', 'footwear', 'oxfords', 'loafers', 'flats', 'heels', 'pumps'],
  'boots': ['boots', 'boot', 'ankle-boots', 'knee-high-boots', 'combat-boots', 'chelsea-boots'],
  'sneakers': ['sneakers', 'sneaker', 'trainers', 'athletic-shoes', 'running-shoes', 'tennis-shoes'],
  'sandals': ['sandals', 'sandal', 'slides', 'flip-flops', 'wedges'],
  
  // Accessories
  'bags': ['bag', 'bags', 'handbag', 'handbags', 'purse', 'purses', 'backpack', 'tote', 'clutch', 'crossbody'],
  'belts': ['belt', 'belts'],
  'jewelry': ['jewelry', 'jewellery', 'necklace', 'necklaces', 'bracelet', 'bracelets', 'earrings', 'ring', 'rings', 'watch', 'watches'],
  'hats': ['hat', 'hats', 'cap', 'caps', 'beanie', 'beanies', 'fedora', 'beret'],
  'scarves': ['scarf', 'scarves', 'shawl', 'shawls', 'wrap', 'wraps'],
  'sunglasses': ['sunglasses', 'eyewear', 'glasses'],
  
  // Undergarments & Swimwear
  'underwear': ['underwear', 'lingerie', 'bra', 'bras', 'panties', 'briefs', 'boxers'],
  'swimwear': ['swimwear', 'swimsuit', 'bikini', 'bikinis', 'swim-trunks', 'board-shorts', 'one-piece']
} as const;

// Get standardized category from any clothing term
export function getStandardizedCategory(term: string): string | null {
  const normalized = term.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
  
  for (const [category, terms] of Object.entries(CLOTHING_CATEGORIES)) {
    if (terms.some(t => normalized.includes(t))) {
      return category;
    }
  }
  
  return null;
}

// Get all standardized categories from text
export function extractClothingCategories(text: string): string[] {
  const categories = new Set<string>();
  const words = text.toLowerCase().split(/[\s,.-]+/);
  
  for (const word of words) {
    const category = getStandardizedCategory(word);
    if (category) {
      categories.add(category);
    }
  }
  
  return Array.from(categories);
}

// Extract categories from product hierarchy
export function extractFromProductHierarchy(hierarchy: string): string[] {
  // Example: "Men > Tops > Polo Shirts" or "Men > Bottoms > Jeans"
  const categories = new Set<string>();
  const parts = hierarchy.split('>').map(p => p.trim());
  
  for (const part of parts) {
    const category = getStandardizedCategory(part);
    if (category) {
      categories.add(category);
    }
  }
  
  return Array.from(categories);
}

// Extract from trend description and name
export function extractFromTrendText(trendName: string, trendDescription?: string): string[] {
  const categories = new Set<string>();
  
  // Extract from trend name
  const nameCategories = extractClothingCategories(trendName);
  nameCategories.forEach(c => categories.add(c));
  
  // Extract from description if available
  if (trendDescription) {
    const descCategories = extractClothingCategories(trendDescription);
    descCategories.forEach(c => categories.add(c));
  }
  
  return Array.from(categories);
}

// Gender standardization
export const GENDER_MAPPING = {
  'male': 'men',
  'men': 'men',
  'man': 'men',
  'mens': 'men',
  'female': 'women',
  'women': 'women',
  'woman': 'women',
  'womens': 'women',
  'ladies': 'women',
  'kids': 'kids',
  'children': 'kids',
  'boys': 'kids',
  'girls': 'kids',
  'unisex': 'unisex',
  'all': 'unisex'
} as const;

export function standardizeGender(gender: string): string {
  const normalized = gender.toLowerCase().trim();
  return GENDER_MAPPING[normalized as keyof typeof GENDER_MAPPING] || 'unisex';
} 