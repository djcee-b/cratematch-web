-- Daily Export Reset Trigger
-- This trigger automatically resets exports_today to 0 for all users at midnight each day

-- Create a function to reset daily exports (FREE USERS ONLY)
CREATE OR REPLACE FUNCTION reset_daily_exports()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reset exports_today to 0 and update last_export_date to today
  -- for FREE users only where last_export_date is not today
  UPDATE machines 
  SET 
    exports_today = 0,
    last_export_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE 
    role = 'free' 
    AND (last_export_date IS NULL OR last_export_date < CURRENT_DATE);
    
  -- Log the reset operation
  RAISE NOTICE 'Daily export reset completed for free users at %', NOW();
END;
$$;

-- Create a cron job to run this function daily at midnight (00:00)
-- Note: This requires the pg_cron extension to be enabled in Supabase
-- You may need to enable it in your Supabase dashboard under Extensions

-- Schedule the job to run every day at midnight
SELECT cron.schedule(
  'daily-export-reset',
  '0 0 * * *', -- Cron expression: every day at 00:00
  'SELECT reset_daily_exports();'
);

-- Alternative: If pg_cron is not available, you can create a manual trigger
-- that runs when the function is called manually

-- Create a manual trigger function that can be called via API (FREE USERS ONLY)
CREATE OR REPLACE FUNCTION manual_reset_daily_exports()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_rows INTEGER;
BEGIN
  -- Reset exports_today to 0 and update last_export_date to today
  -- for FREE users only
  UPDATE machines 
  SET 
    exports_today = 0,
    last_export_date = CURRENT_DATE,
    updated_at = NOW()
  WHERE 
    role = 'free' 
    AND (last_export_date IS NULL OR last_export_date < CURRENT_DATE);
    
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Daily export reset completed for free users',
    'affected_rows', affected_rows,
    'reset_time', NOW()
  );
END;
$$;

-- Grant execute permission to authenticated users (for manual reset)
GRANT EXECUTE ON FUNCTION manual_reset_daily_exports() TO authenticated;

-- Create a policy to allow users to call the manual reset function
-- (This is optional and can be removed if you don't want manual resets)
CREATE POLICY "Allow manual export reset" ON machines
  FOR UPDATE USING (true);

-- Note: The automatic daily reset via cron.schedule requires:
-- 1. pg_cron extension to be enabled in your Supabase project
-- 2. Proper permissions set up
-- 
-- To enable pg_cron in Supabase:
-- 1. Go to your Supabase dashboard
-- 2. Navigate to Extensions
-- 3. Enable the pg_cron extension
-- 4. Run this SQL script
--
-- If pg_cron is not available, the manual_reset_daily_exports() function
-- can be called via a scheduled API endpoint or external cron job 