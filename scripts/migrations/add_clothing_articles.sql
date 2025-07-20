-- Migration: Add clothing_articles to trends and products tables
-- Date: 2025-01-17
-- Description: Adds clothing article categorization for better matching between trends and products

-- Add clothing_articles column to trends table
ALTER TABLE trends 
ADD COLUMN IF NOT EXISTS clothing_articles TEXT[] DEFAULT '{}';

-- Add clothing_articles column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS clothing_articles TEXT[] DEFAULT '{}';

-- Update trend_region from 'us' to 'usa'
UPDATE trends 
SET trend_region = 'usa' 
WHERE trend_region = 'us';

-- Create index for better performance on filtering
CREATE INDEX IF NOT EXISTS idx_trends_clothing_articles ON trends USING GIN (clothing_articles);
CREATE INDEX IF NOT EXISTS idx_products_clothing_articles ON products USING GIN (clothing_articles);
CREATE INDEX IF NOT EXISTS idx_trends_region ON trends(trend_region);
CREATE INDEX IF NOT EXISTS idx_trends_target_gender ON trends(target_gender);

-- Function to extract clothing articles from trend data
CREATE OR REPLACE FUNCTION extract_trend_clothing_articles(
  trend_name TEXT,
  trend_desc TEXT
) RETURNS TEXT[] AS $$
DECLARE
  articles TEXT[] := '{}';
  word TEXT;
  -- Mapping of terms to standardized categories
  category_map JSONB := '{
    "shirt": "shirts", "shirts": "shirts", "polo": "shirts", "polo-shirt": "shirts", "blouse": "shirts", "blouses": "shirts", "top": "shirts", "tops": "shirts",
    "t-shirt": "t-shirts", "t-shirts": "t-shirts", "tee": "t-shirts", "tees": "t-shirts", "tshirt": "t-shirts",
    "sweater": "sweaters", "sweaters": "sweaters", "pullover": "sweaters", "jumper": "sweaters", "cardigan": "sweaters",
    "hoodie": "hoodies", "hoodies": "hoodies", "sweatshirt": "hoodies", "sweatshirts": "hoodies",
    "jacket": "jackets", "jackets": "jackets", "blazer": "jackets", "blazers": "jackets",
    "coat": "coats", "coats": "coats", "overcoat": "coats", "trench": "coats", "parka": "coats",
    "vest": "vests", "vests": "vests", "waistcoat": "vests",
    "pants": "pants", "trousers": "pants", "chinos": "pants", "slacks": "pants",
    "jeans": "jeans", "denim": "jeans",
    "shorts": "shorts", "short": "shorts", "bermuda": "shorts",
    "skirt": "skirts", "skirts": "skirts",
    "leggings": "leggings", "tights": "leggings",
    "dress": "dresses", "dresses": "dresses", "gown": "dresses", "gowns": "dresses",
    "jumpsuit": "jumpsuits", "jumpsuits": "jumpsuits", "romper": "jumpsuits",
    "shoes": "shoes", "shoe": "shoes", "footwear": "shoes", "loafers": "shoes", "flats": "shoes", "heels": "shoes",
    "boots": "boots", "boot": "boots",
    "sneakers": "sneakers", "sneaker": "sneakers", "trainers": "sneakers",
    "sandals": "sandals", "sandal": "sandals", "slides": "sandals",
    "bag": "bags", "bags": "bags", "handbag": "bags", "purse": "bags", "backpack": "bags",
    "belt": "belts", "belts": "belts",
    "jewelry": "jewelry", "jewellery": "jewelry", "necklace": "jewelry", "bracelet": "jewelry", "earrings": "jewelry",
    "hat": "hats", "hats": "hats", "cap": "hats", "beanie": "hats",
    "scarf": "scarves", "scarves": "scarves", "shawl": "scarves",
    "sunglasses": "sunglasses", "eyewear": "sunglasses"
  }'::JSONB;
BEGIN
  -- Process trend name and description
  FOREACH word IN ARRAY string_to_array(lower(COALESCE(trend_name, '') || ' ' || COALESCE(trend_desc, '')), ' ')
  LOOP
    -- Clean the word
    word := regexp_replace(word, '[^a-z0-9-]', '', 'g');
    
    -- Check if word matches any category
    IF category_map ? word THEN
      articles := array_append(articles, category_map->word);
    END IF;
  END LOOP;
  
  -- Remove duplicates
  RETURN ARRAY(SELECT DISTINCT unnest(articles));
END;
$$ LANGUAGE plpgsql;

-- Function to extract clothing articles from product hierarchy
CREATE OR REPLACE FUNCTION extract_product_clothing_articles(
  product_hierarchy TEXT
) RETURNS TEXT[] AS $$
DECLARE
  articles TEXT[] := '{}';
  part TEXT;
  category_map JSONB := '{
    "polo shirts": "shirts", "t-shirts": "t-shirts", "shirts": "shirts", "blouses": "shirts", "tops": "shirts",
    "sweaters": "sweaters", "hoodies": "hoodies", "sweatshirts": "hoodies",
    "jackets": "jackets", "blazers": "jackets", "coats": "coats",
    "jeans": "jeans", "pants": "pants", "trousers": "pants", "shorts": "shorts",
    "skirts": "skirts", "dresses": "dresses", "jumpsuits": "jumpsuits",
    "shoes": "shoes", "boots": "boots", "sneakers": "sneakers", "sandals": "sandals",
    "bags": "bags", "belts": "belts", "jewelry": "jewelry", "accessories": "accessories"
  }'::JSONB;
BEGIN
  -- Split hierarchy by > and process each part
  FOREACH part IN ARRAY string_to_array(lower(COALESCE(product_hierarchy, '')), '>')
  LOOP
    part := trim(part);
    
    -- Check exact matches first
    IF category_map ? part THEN
      articles := array_append(articles, category_map->part);
    ELSE
      -- Check if part contains any category
      IF part LIKE '%shirt%' THEN
        IF part LIKE '%t-shirt%' OR part LIKE '%tee%' THEN
          articles := array_append(articles, 't-shirts');
        ELSE
          articles := array_append(articles, 'shirts');
        END IF;
      ELSIF part LIKE '%jean%' OR part LIKE '%denim%' THEN
        articles := array_append(articles, 'jeans');
      ELSIF part LIKE '%pant%' OR part LIKE '%trouser%' THEN
        articles := array_append(articles, 'pants');
      ELSIF part LIKE '%short%' THEN
        articles := array_append(articles, 'shorts');
      ELSIF part LIKE '%dress%' THEN
        articles := array_append(articles, 'dresses');
      ELSIF part LIKE '%skirt%' THEN
        articles := array_append(articles, 'skirts');
      ELSIF part LIKE '%jacket%' OR part LIKE '%blazer%' THEN
        articles := array_append(articles, 'jackets');
      ELSIF part LIKE '%coat%' THEN
        articles := array_append(articles, 'coats');
      ELSIF part LIKE '%sweater%' OR part LIKE '%jumper%' OR part LIKE '%cardigan%' THEN
        articles := array_append(articles, 'sweaters');
      ELSIF part LIKE '%hoodie%' OR part LIKE '%sweatshirt%' THEN
        articles := array_append(articles, 'hoodies');
      ELSIF part LIKE '%boot%' THEN
        articles := array_append(articles, 'boots');
      ELSIF part LIKE '%shoe%' OR part LIKE '%footwear%' THEN
        articles := array_append(articles, 'shoes');
      ELSIF part LIKE '%sneaker%' OR part LIKE '%trainer%' THEN
        articles := array_append(articles, 'sneakers');
      ELSIF part LIKE '%sandal%' THEN
        articles := array_append(articles, 'sandals');
      ELSIF part LIKE '%bag%' OR part LIKE '%purse%' OR part LIKE '%backpack%' THEN
        articles := array_append(articles, 'bags');
      ELSIF part LIKE '%belt%' THEN
        articles := array_append(articles, 'belts');
      ELSIF part LIKE '%jewelry%' OR part LIKE '%jewellery%' OR part LIKE '%necklace%' OR part LIKE '%bracelet%' THEN
        articles := array_append(articles, 'jewelry');
      END IF;
    END IF;
  END LOOP;
  
  -- Remove duplicates
  RETURN ARRAY(SELECT DISTINCT unnest(articles));
END;
$$ LANGUAGE plpgsql;

-- Update existing trends with clothing articles
UPDATE trends 
SET clothing_articles = extract_trend_clothing_articles(trend_identifier, trend_description)
WHERE clothing_articles = '{}' OR clothing_articles IS NULL;

-- Update existing products with clothing articles
UPDATE products 
SET clothing_articles = extract_product_clothing_articles(category_hierarchy)
WHERE clothing_articles = '{}' OR clothing_articles IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN trends.clothing_articles IS 'Array of standardized clothing article categories this trend applies to';
COMMENT ON COLUMN products.clothing_articles IS 'Array of standardized clothing article categories for this product'; 