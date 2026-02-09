-- ================================================================
-- EMPLOYER PROFILE + JOB REQUESTS - COMPLETE FIX
-- Run this ONCE in Supabase SQL Editor
-- ================================================================

-- 1. Add ALL missing employer columns
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

-- 2. Add work_city to job_requests (city where workers will work)
ALTER TABLE job_requests ADD COLUMN IF NOT EXISTS work_city TEXT;

-- 3. Fix existing employer users who are missing profiles rows
INSERT INTO profiles (id, email, full_name, user_type)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', ''), 'employer'
FROM auth.users u
WHERE u.raw_user_meta_data->>'user_type' = 'employer'
  AND NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- 4. Fix existing employer users who are missing employer rows
INSERT INTO employers (profile_id, company_name, status)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'company_name', 'My Company'), 'PENDING'
FROM auth.users u
WHERE u.raw_user_meta_data->>'user_type' = 'employer'
  AND NOT EXISTS (SELECT 1 FROM employers e WHERE e.profile_id = u.id)
ON CONFLICT DO NOTHING;

-- 5. Fix RLS policies for job_requests (ensure employers can insert/update/delete)
DROP POLICY IF EXISTS "allow_all_job_requests" ON job_requests;
DROP POLICY IF EXISTS "job_requests_select" ON job_requests;
DROP POLICY IF EXISTS "job_requests_insert" ON job_requests;
DROP POLICY IF EXISTS "job_requests_update" ON job_requests;
DROP POLICY IF EXISTS "job_requests_delete" ON job_requests;
DROP POLICY IF EXISTS "Employers view own job requests" ON job_requests;
DROP POLICY IF EXISTS "Employers create job requests" ON job_requests;
DROP POLICY IF EXISTS "Employers update own job requests" ON job_requests;

-- SELECT: employer sees own, admin/candidates see all
CREATE POLICY "job_requests_select" ON job_requests FOR SELECT USING (
    EXISTS (SELECT 1 FROM employers e WHERE e.id = employer_id AND e.profile_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type IN ('admin', 'candidate'))
);

-- INSERT: employer can create jobs for their own employer record
CREATE POLICY "job_requests_insert" ON job_requests FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM employers e WHERE e.id = employer_id AND e.profile_id = auth.uid())
);

-- UPDATE: employer can update own jobs
CREATE POLICY "job_requests_update" ON job_requests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM employers e WHERE e.id = employer_id AND e.profile_id = auth.uid())
);

-- DELETE: employer can delete own jobs
CREATE POLICY "job_requests_delete" ON job_requests FOR DELETE USING (
    EXISTS (SELECT 1 FROM employers e WHERE e.id = employer_id AND e.profile_id = auth.uid())
);

-- 6. Recreate the signup trigger to handle new columns properly
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

-- DONE! All columns added, policies fixed, trigger updated.
