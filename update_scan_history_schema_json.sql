-- Update existing scan_history table to include JSON results storage
-- This is much more efficient than storing each track as a separate row

-- Add JSON column to store detailed scan results
ALTER TABLE scan_history 
ADD COLUMN IF NOT EXISTS scan_results JSONB;

-- Add index for JSON queries (optional, for performance)
CREATE INDEX IF NOT EXISTS idx_scan_history_results 
ON scan_history USING GIN (scan_results);

-- Drop the scan_tracks table since we're using JSON storage instead
DROP TABLE IF EXISTS scan_tracks CASCADE;

-- Verify the updated structure
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'scan_history' 
ORDER BY ordinal_position; 