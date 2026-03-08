-- ================================================================
-- MIGRATION: Sync profile/role records after auth metadata updates
-- Date: 08.03.2026
--
-- Problem:
-- Google OAuth first creates the auth user before the app callback can attach
-- the chosen `user_type`. That means role metadata may arrive only after the
-- first `auth.users` insert.
--
-- Fix:
-- - centralize auth-user -> domain sync in one helper
-- - allow first insert to create only `profiles` when role metadata is missing
-- - sync `profiles.user_type` and provision `workers` / `employers` again when
--   auth metadata is later updated by the callback or role-picker flow
-- ================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_auth_user_profile_from_metadata(
    p_user_id uuid,
    p_email text,
    p_raw_user_meta_data jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    normalized_user_type text := NULLIF(COALESCE(p_raw_user_meta_data->>'user_type', ''), '');
    normalized_full_name text := COALESCE(
        NULLIF(p_raw_user_meta_data->>'full_name', ''),
        NULLIF(pg_catalog.split_part(COALESCE(p_email, ''), '@', 1), ''),
        ''
    );
BEGIN
    IF normalized_user_type = 'candidate' THEN
        normalized_user_type := 'worker';
    END IF;

    IF normalized_user_type IS NOT NULL
       AND normalized_user_type NOT IN ('worker', 'employer', 'agency', 'admin') THEN
        normalized_user_type := 'worker';
    END IF;

    INSERT INTO public.profiles (id, email, full_name, user_type)
    VALUES (p_user_id, p_email, normalized_full_name, normalized_user_type)
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        full_name = CASE
            WHEN COALESCE(public.profiles.full_name, '') = '' THEN EXCLUDED.full_name
            ELSE public.profiles.full_name
        END,
        user_type = COALESCE(EXCLUDED.user_type, public.profiles.user_type);

    IF normalized_user_type = 'worker' THEN
        INSERT INTO public.workers (profile_id, status)
        SELECT p_user_id, 'NEW'
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.workers
            WHERE profile_id = p_user_id
        );
    ELSIF normalized_user_type = 'employer' THEN
        INSERT INTO public.employers (profile_id, company_name, status)
        SELECT
            p_user_id,
            COALESCE(NULLIF(p_raw_user_meta_data->>'company_name', ''), 'My Company'),
            'PENDING'
        WHERE NOT EXISTS (
            SELECT 1
            FROM public.employers
            WHERE profile_id = p_user_id
        );
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.sync_auth_user_profile_from_metadata(NEW.id, NEW.email, NEW.raw_user_meta_data);
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_auth_user_metadata_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.sync_auth_user_profile_from_metadata(NEW.id, NEW.email, NEW.raw_user_meta_data);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_auth_user_updated_sync_profile ON auth.users;
CREATE TRIGGER on_auth_user_updated_sync_profile
    AFTER UPDATE OF raw_user_meta_data, email ON auth.users
    FOR EACH ROW
    WHEN (
        NEW.raw_user_meta_data IS DISTINCT FROM OLD.raw_user_meta_data
        OR NEW.email IS DISTINCT FROM OLD.email
    )
    EXECUTE FUNCTION public.handle_auth_user_metadata_update();

COMMENT ON FUNCTION public.sync_auth_user_profile_from_metadata(uuid, text, jsonb)
IS 'Keeps public.profiles plus canonical worker/employer rows in sync with auth.users metadata.';

COMMENT ON FUNCTION public.handle_auth_user_metadata_update()
IS 'Syncs profile/domain role rows when auth.users metadata changes after signup.';

COMMIT;
