-- Migration script to add scan_results column to existing scan_history table
-- This ensures backward compatibility with existing installations

-- Add JSON column to store detailed scan results (if not already exists)
ALTER TABLE scan_history 
ADD COLUMN IF NOT EXISTS scan_results JSONB;

-- Add index for JSON queries (if not already exists)
CREATE INDEX IF NOT EXISTS idx_scan_history_results 
ON scan_history USING GIN (scan_results);

-- Verify the column was added
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'scan_history' 
AND column_name = 'scan_results';

-- Show current scan_history table structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'scan_history' 
ORDER BY ordinal_position; 