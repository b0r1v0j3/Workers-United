-- ================================================================
-- FIX: handle_new_user() trigger doesn't create candidates rows for workers
-- 
-- Problem: Signup sends user_type='worker', but trigger checks for 'candidate'.
-- Result: No candidates row is created for workers on signup.
-- They only get one when they manually edit their profile.
--
-- This migration:
-- 1. Fixes the trigger to handle 'worker' user_type
-- 2. Backfills missing candidates rows for existing workers
-- ================================================================

-- 1. Fix the trigger to handle 'worker' user_type
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, user_type)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'user_type', 'worker')
    );

    -- Create candidates row for workers (user_type = 'worker' or 'candidate' or NULL)
    IF COALESCE(NEW.raw_user_meta_data->>'user_type', 'worker') IN ('worker', 'candidate') THEN
        INSERT INTO public.candidates (profile_id) VALUES (NEW.id);
    ELSIF NEW.raw_user_meta_data->>'user_type' = 'employer' THEN
        INSERT INTO public.employers (profile_id, company_name, status)
        VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'), 'PENDING');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Backfill: Create missing candidates rows for workers who don't have one
INSERT INTO candidates (profile_id)
SELECT p.id
FROM profiles p
WHERE p.user_type IN ('worker', 'candidate')
  AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.profile_id = p.id)
ON CONFLICT DO NOTHING;

-- Verify: This should return 0 after running
-- SELECT COUNT(*) FROM profiles p WHERE p.user_type IN ('worker', 'candidate') AND NOT EXISTS (SELECT 1 FROM candidates c WHERE c.profile_id = p.id);
