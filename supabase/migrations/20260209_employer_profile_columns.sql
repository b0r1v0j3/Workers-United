-- ================================================================
-- EMPLOYER PROFILE - COMPLETE FIX
-- Run this ONCE in Supabase SQL Editor
-- This adds ALL missing columns and fixes existing users
-- ================================================================

-- 1. Add ALL columns the employer profile needs
ALTER TABLE employers ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS company_registration_number TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS company_address TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS founded_year TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';

-- 2. Fix existing employer users who are missing profiles rows
INSERT INTO profiles (id, email, full_name, user_type)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', ''), 'employer'
FROM auth.users u
WHERE u.raw_user_meta_data->>'user_type' = 'employer'
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- 3. Fix existing employer users who are missing employer rows
INSERT INTO employers (profile_id, company_name, status)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'company_name', 'My Company'), 'PENDING'
FROM auth.users u
WHERE u.raw_user_meta_data->>'user_type' = 'employer'
  AND NOT EXISTS (SELECT 1 FROM employers e WHERE e.profile_id = u.id)
ON CONFLICT DO NOTHING;

-- 4. Recreate the signup trigger to handle new columns properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, user_type)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'user_type', 'candidate')
    );

    IF COALESCE(NEW.raw_user_meta_data->>'user_type', 'candidate') = 'candidate' THEN
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

-- DONE! All columns added, existing users fixed, trigger updated.
