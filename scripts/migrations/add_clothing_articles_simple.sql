-- Migration: Add clothing_articles to trends and products tables (Simplified Version)
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

-- Add comment for documentation
COMMENT ON COLUMN trends.clothing_articles IS 'Array of standardized clothing article categories this trend applies to';
COMMENT ON COLUMN products.clothing_articles IS 'Array of standardized clothing article categories for this product';

-- Simple update for trends based on common patterns in trend names
UPDATE trends SET clothing_articles = ARRAY['shirts'] 
WHERE clothing_articles = '{}' AND (
  lower(trend_identifier) LIKE '%shirt%' OR 
  lower(trend_identifier) LIKE '%polo%' OR
  lower(trend_identifier) LIKE '%blouse%' OR
  lower(trend_description) LIKE '%shirt%' OR
  lower(trend_description) LIKE '%polo%' OR
  lower(trend_description) LIKE '%blouse%'
);

UPDATE trends SET clothing_articles = ARRAY['t-shirts'] 
WHERE clothing_articles = '{}' AND (
  lower(trend_identifier) LIKE '%t-shirt%' OR 
  lower(trend_identifier) LIKE '%tee%' OR
  lower(trend_description) LIKE '%t-shirt%' OR
  lower(trend_description) LIKE '%tee%'
);

UPDATE trends SET clothing_articles = ARRAY['jeans'] 
WHERE clothing_articles = '{}' AND (
  lower(trend_identifier) LIKE '%jean%' OR 
  lower(trend_identifier) LIKE '%denim%' OR
  lower(trend_description) LIKE '%jean%' OR
  lower(trend_description) LIKE '%denim%'
);

UPDATE trends SET clothing_articles = ARRAY['pants'] 
WHERE clothing_articles = '{}' AND (
  lower(trend_identifier) LIKE '%pant%' OR 
  lower(trend_identifier) LIKE '%trouser%' OR
  lower(trend_description) LIKE '%pant%' OR
  lower(trend_description) LIKE '%trouser%'
);

UPDATE trends SET clothing_articles = ARRAY['dresses'] 
WHERE clothing_articles = '{}' AND (
  lower(trend_identifier) LIKE '%dress%' OR
  lower(trend_description) LIKE '%dress%'
);

UPDATE trends SET clothing_articles = ARRAY['shoes'] 
WHERE clothing_articles = '{}' AND (
  lower(trend_identifier) LIKE '%shoe%' OR 
  lower(trend_identifier) LIKE '%footwear%' OR
  lower(trend_description) LIKE '%shoe%' OR
  lower(trend_description) LIKE '%footwear%'
);

UPDATE trends SET clothing_articles = ARRAY['sneakers'] 
WHERE clothing_articles = '{}' AND (
  lower(trend_identifier) LIKE '%sneaker%' OR 
  lower(trend_identifier) LIKE '%trainer%' OR
  lower(trend_description) LIKE '%sneaker%' OR
  lower(trend_description) LIKE '%trainer%'
);

UPDATE trends SET clothing_articles = ARRAY['bags'] 
WHERE clothing_articles = '{}' AND (
  lower(trend_identifier) LIKE '%bag%' OR 
  lower(trend_identifier) LIKE '%purse%' OR
  lower(trend_description) LIKE '%bag%' OR
  lower(trend_description) LIKE '%purse%'
);

-- Simple update for products based on category hierarchy
UPDATE products SET clothing_articles = ARRAY['shirts'] 
WHERE clothing_articles = '{}' AND lower(category_hierarchy) LIKE '%shirt%' AND lower(category_hierarchy) NOT LIKE '%t-shirt%';

UPDATE products SET clothing_articles = ARRAY['t-shirts'] 
WHERE clothing_articles = '{}' AND (lower(category_hierarchy) LIKE '%t-shirt%' OR lower(category_hierarchy) LIKE '%tee%');

UPDATE products SET clothing_articles = ARRAY['jeans'] 
WHERE clothing_articles = '{}' AND (lower(category_hierarchy) LIKE '%jean%' OR lower(category_hierarchy) LIKE '%denim%');

UPDATE products SET clothing_articles = ARRAY['pants'] 
WHERE clothing_articles = '{}' AND (lower(category_hierarchy) LIKE '%pant%' OR lower(category_hierarchy) LIKE '%trouser%');

UPDATE products SET clothing_articles = ARRAY['shorts'] 
WHERE clothing_articles = '{}' AND lower(category_hierarchy) LIKE '%short%';

UPDATE products SET clothing_articles = ARRAY['dresses'] 
WHERE clothing_articles = '{}' AND lower(category_hierarchy) LIKE '%dress%';

UPDATE products SET clothing_articles = ARRAY['skirts'] 
WHERE clothing_articles = '{}' AND lower(category_hierarchy) LIKE '%skirt%';

UPDATE products SET clothing_articles = ARRAY['shoes'] 
WHERE clothing_articles = '{}' AND lower(category_hierarchy) LIKE '%shoe%';

UPDATE products SET clothing_articles = ARRAY['boots'] 
WHERE clothing_articles = '{}' AND lower(category_hierarchy) LIKE '%boot%';

UPDATE products SET clothing_articles = ARRAY['sneakers'] 
WHERE clothing_articles = '{}' AND (lower(category_hierarchy) LIKE '%sneaker%' OR lower(category_hierarchy) LIKE '%trainer%');

UPDATE products SET clothing_articles = ARRAY['bags'] 
WHERE clothing_articles = '{}' AND (lower(category_hierarchy) LIKE '%bag%' OR lower(category_hierarchy) LIKE '%purse%');

UPDATE products SET clothing_articles = ARRAY['jackets'] 
WHERE clothing_articles = '{}' AND (lower(category_hierarchy) LIKE '%jacket%' OR lower(category_hierarchy) LIKE '%blazer%');

UPDATE products SET clothing_articles = ARRAY['sweaters'] 
WHERE clothing_articles = '{}' AND (lower(category_hierarchy) LIKE '%sweater%' OR lower(category_hierarchy) LIKE '%jumper%' OR lower(category_hierarchy) LIKE '%cardigan%');

UPDATE products SET clothing_articles = ARRAY['hoodies'] 
WHERE clothing_articles = '{}' AND (lower(category_hierarchy) LIKE '%hoodie%' OR lower(category_hierarchy) LIKE '%sweatshirt%'); 