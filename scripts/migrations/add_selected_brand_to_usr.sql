-- Add selected_brand column to usr table to persist brand selection
ALTER TABLE usr 
ADD COLUMN IF NOT EXISTS selected_brand TEXT;

-- Add comment for documentation
COMMENT ON COLUMN usr.selected_brand IS 'Currently selected brand name for persistent filtering across sessions'; 