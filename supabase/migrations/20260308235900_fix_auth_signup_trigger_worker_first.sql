-- ================================================================
-- MIGRATION: Fix auth signup trigger after worker-first cleanup
-- Date: 08.03.2026
--
-- Problem:
-- `public.handle_new_user()` still inserted worker signups into the retired
-- `public.candidates` compatibility alias. After the final worker-first
-- cleanup removed that alias, Supabase Auth started failing with
-- `Database error saving new user` during email signup and Google OAuth signup.
--
-- Fix:
-- - normalize legacy `candidate` metadata to canonical `worker`
-- - provision `public.profiles` + canonical `public.workers`
-- - keep employer provisioning unchanged
-- - leave agency/admin provisioning to the app-layer callback helpers
-- ================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    signup_user_type text := COALESCE(NULLIF(NEW.raw_user_meta_data->>'user_type', ''), 'worker');
    signup_full_name text := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
        NULLIF(pg_catalog.split_part(COALESCE(NEW.email, ''), '@', 1), ''),
        ''
    );
BEGIN
    IF signup_user_type = 'candidate' THEN
        signup_user_type := 'worker';
    END IF;

    IF signup_user_type NOT IN ('worker', 'employer', 'agency', 'admin') THEN
        signup_user_type := 'worker';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, user_type)
    VALUES (
        NEW.id,
        NEW.email,
        signup_full_name,
        signup_user_type
    );

    IF signup_user_type = 'worker' THEN
        INSERT INTO public.workers (profile_id, status)
        VALUES (NEW.id, 'NEW');
    ELSIF signup_user_type = 'employer' THEN
        INSERT INTO public.employers (profile_id, company_name, status)
        VALUES (
            NEW.id,
            COALESCE(NULLIF(NEW.raw_user_meta_data->>'company_name', ''), 'My Company'),
            'PENDING'
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON FUNCTION public.handle_new_user()
IS 'Supabase auth signup trigger that provisions profiles plus canonical worker/employer rows.';

COMMIT;
