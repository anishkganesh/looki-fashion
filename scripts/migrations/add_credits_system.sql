-- Add credits column to usr table
ALTER TABLE usr 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 1000;

-- Create credit transactions table
CREATE TABLE IF NOT EXISTS credit_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES usr(id),
  amount INTEGER NOT NULL, -- positive for credits added, negative for credits used
  balance_after INTEGER NOT NULL,
  operation_type TEXT NOT NULL, -- 'trend_agent', 'recommendations', 'chat', 'image_generation', 'web_search', 'monthly_reset'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);

-- Add comment for documentation
COMMENT ON COLUMN usr.credits IS 'Current credit balance for the user';
COMMENT ON TABLE credit_transactions IS 'History of all credit transactions';

-- Function to reset credits monthly
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void AS $$
BEGIN
  -- Reset all users to 1000 credits
  UPDATE usr SET credits = 1000;
  
  -- Log the reset in transactions
  INSERT INTO credit_transactions (user_id, amount, balance_after, operation_type, description)
  SELECT id, 1000 - COALESCE(credits, 0), 1000, 'monthly_reset', 'Monthly credit reset'
  FROM usr;
END;
$$ LANGUAGE plpgsql; 