-- Supabase Automatic Subscription Expiration
-- This file contains database functions and triggers to automatically handle
-- trial and premium subscription expiration without relying on the Node.js server

-- Function to check and handle expired subscriptions
CREATE OR REPLACE FUNCTION handle_expired_subscriptions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    machine_record RECORD;
    now_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get current time
    now_time := NOW();
    
    -- Log the function execution
    RAISE NOTICE 'Checking for expired subscriptions at %', now_time;
    
    -- Loop through all machines and check for expired subscriptions
    FOR machine_record IN 
        SELECT * FROM machines 
        WHERE (role = 'trial' AND trial_end IS NOT NULL AND trial_end <= now_time)
           OR (role = 'premium' AND subscription_end IS NOT NULL AND subscription_end <= now_time)
    LOOP
        -- Handle trial expiration
        IF machine_record.role = 'trial' AND machine_record.trial_end <= now_time THEN
            RAISE NOTICE 'Auto-downgrading expired trial for user: %', machine_record.email;
            
            UPDATE machines 
            SET 
                role = 'free',
                trial_start = NULL,
                trial_end = NULL,
                updated_at = now_time
            WHERE id = machine_record.id;
            
        -- Handle premium subscription expiration
        ELSIF machine_record.role = 'premium' AND machine_record.subscription_end <= now_time THEN
            RAISE NOTICE 'Auto-downgrading expired premium subscription for user: %', machine_record.email;
            
            UPDATE machines 
            SET 
                role = 'free',
                subscription_type = NULL,
                subscription_start = NULL,
                subscription_end = NULL,
                updated_at = now_time
            WHERE id = machine_record.id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Subscription expiration check completed';
END;
$$;

-- Function to automatically check subscriptions on machine updates
CREATE OR REPLACE FUNCTION check_subscription_on_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    now_time TIMESTAMP WITH TIME ZONE;
BEGIN
    now_time := NOW();
    
    -- Check if trial has expired
    IF NEW.role = 'trial' AND NEW.trial_end IS NOT NULL AND NEW.trial_end <= now_time THEN
        RAISE NOTICE 'Trial expired for user: %, auto-downgrading to free', NEW.email;
        
        NEW.role := 'free';
        NEW.trial_start := NULL;
        NEW.trial_end := NULL;
        NEW.updated_at := now_time;
        
    -- Check if premium subscription has expired
    ELSIF NEW.role = 'premium' AND NEW.subscription_end IS NOT NULL AND NEW.subscription_end <= now_time THEN
        RAISE NOTICE 'Premium subscription expired for user: %, auto-downgrading to free', NEW.email;
        
        NEW.role := 'free';
        NEW.subscription_type := NULL;
        NEW.subscription_start := NULL;
        NEW.subscription_end := NULL;
        NEW.updated_at := now_time;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger to check subscription expiration on machine updates
DROP TRIGGER IF EXISTS check_subscription_expiration_trigger ON machines;
CREATE TRIGGER check_subscription_expiration_trigger
    BEFORE UPDATE ON machines
    FOR EACH ROW
    EXECUTE FUNCTION check_subscription_on_update();

-- Create trigger to check subscription expiration on machine inserts
DROP TRIGGER IF EXISTS check_subscription_on_insert_trigger ON machines;
CREATE TRIGGER check_subscription_on_insert_trigger
    BEFORE INSERT ON machines
    FOR EACH ROW
    EXECUTE FUNCTION check_subscription_on_update();

-- Create a cron job to run the expiration check periodically
-- Note: This requires the pg_cron extension to be enabled in Supabase
-- You can enable it in the Supabase dashboard under Database > Extensions

-- Schedule the function to run every hour
-- SELECT cron.schedule('check-subscription-expiration', '0 * * * *', 'SELECT handle_expired_subscriptions();');

-- Alternative: Create a function that can be called via HTTP
CREATE OR REPLACE FUNCTION http_handle_expired_subscriptions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM handle_expired_subscriptions();
    RETURN json_build_object(
        'success', true,
        'message', 'Subscription expiration check completed',
        'timestamp', NOW()
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'timestamp', NOW()
        );
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_expired_subscriptions() TO authenticated;
GRANT EXECUTE ON FUNCTION check_subscription_on_update() TO authenticated;
GRANT EXECUTE ON FUNCTION http_handle_expired_subscriptions() TO authenticated;

-- Create a view to easily see subscription status
CREATE OR REPLACE VIEW subscription_status AS
SELECT 
    id,
    email,
    role,
    trial_start,
    trial_end,
    subscription_type,
    subscription_start,
    subscription_end,
    CASE 
        WHEN role = 'trial' AND trial_end <= NOW() THEN 'expired'
        WHEN role = 'premium' AND subscription_end <= NOW() THEN 'expired'
        WHEN role = 'trial' AND trial_end > NOW() THEN 'active'
        WHEN role = 'premium' AND subscription_end > NOW() THEN 'active'
        WHEN role = 'free' THEN 'free'
        ELSE 'unknown'
    END as status,
    CASE 
        WHEN role = 'trial' AND trial_end <= NOW() THEN trial_end
        WHEN role = 'premium' AND subscription_end <= NOW() THEN subscription_end
        ELSE NULL
    END as expired_at,
    updated_at
FROM machines;

-- Grant access to the view
GRANT SELECT ON subscription_status TO authenticated; 