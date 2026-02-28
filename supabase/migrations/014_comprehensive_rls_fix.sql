-- ============================================================
-- MIGRATION 014: Comprehensive RLS policy fix
-- 
-- Replace ALL remaining `EXISTS (SELECT 1 FROM profiles ...)`
-- references with SECURITY DEFINER functions to eliminate
-- any possible recursion or performance issues.
-- ============================================================

-- ================================================================
-- 1. Create helper functions (SECURITY DEFINER = bypass RLS)
-- ================================================================
DROP FUNCTION IF EXISTS public.is_admin();
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND user_type = 'admin'
    );
$$;

DROP FUNCTION IF EXISTS public.is_employer();
CREATE OR REPLACE FUNCTION public.is_employer()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND user_type = 'employer'
    );
$$;

DROP FUNCTION IF EXISTS public.get_user_type();
CREATE OR REPLACE FUNCTION public.get_user_type()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT user_type FROM profiles 
    WHERE id = auth.uid()
    LIMIT 1;
$$;

-- ================================================================
-- 2. PROFILES — no self-reference
-- ================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (
        (select auth.uid()) = id
    );

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        public.is_admin()
    );

-- UPDATE and INSERT stay the same (no cross-reference)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- ================================================================
-- 3. CANDIDATES — use is_admin(), is_employer()
-- ================================================================
DROP POLICY IF EXISTS "Candidates view own data" ON candidates;
CREATE POLICY "Candidates view own data" ON candidates
    FOR SELECT USING (
        profile_id = (select auth.uid()) 
        OR public.is_admin()
        OR public.is_employer()
    );

DROP POLICY IF EXISTS "Candidates update own data" ON candidates;
CREATE POLICY "Candidates update own data" ON candidates
    FOR UPDATE USING (
        profile_id = (select auth.uid()) 
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Candidates insert own data" ON candidates;
CREATE POLICY "Candidates insert own data" ON candidates
    FOR INSERT WITH CHECK (profile_id = (select auth.uid()));

-- ================================================================
-- 4. EMPLOYERS — use is_admin()
-- ================================================================
DROP POLICY IF EXISTS "Employers view own data" ON employers;
CREATE POLICY "Employers view own data" ON employers
    FOR SELECT USING (
        profile_id = (select auth.uid()) 
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Employers update own data" ON employers;
CREATE POLICY "Employers update own data" ON employers
    FOR UPDATE USING (profile_id = (select auth.uid()));

DROP POLICY IF EXISTS "Employers insert own data" ON employers;
CREATE POLICY "Employers insert own data" ON employers
    FOR INSERT WITH CHECK (profile_id = (select auth.uid()));

-- ================================================================
-- 5. MATCHES — use is_admin()
-- ================================================================
DROP POLICY IF EXISTS "View own matches" ON matches;
CREATE POLICY "View own matches" ON matches
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = (select auth.uid())) OR
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = (select auth.uid())) OR
        public.is_admin()
    );

-- ================================================================
-- 6. PAYMENTS — use is_admin()
-- ================================================================
DROP POLICY IF EXISTS "View own payments" ON payments;
CREATE POLICY "View own payments" ON payments
    FOR SELECT USING (
        user_id = (select auth.uid()) 
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Create own payments" ON payments;
CREATE POLICY "Create own payments" ON payments
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

-- ================================================================
-- 7. JOB_REQUESTS — use is_admin(), get_user_type()
-- ================================================================
DROP POLICY IF EXISTS "Employers view own jobs" ON job_requests;
CREATE POLICY "Employers view own jobs" ON job_requests
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = (select auth.uid())) OR
        public.is_admin() OR
        public.get_user_type() = 'candidate'
    );

DROP POLICY IF EXISTS "Employers create jobs" ON job_requests;
CREATE POLICY "Employers create jobs" ON job_requests
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = (select auth.uid()))
    );

DROP POLICY IF EXISTS "Employers update own jobs" ON job_requests;
CREATE POLICY "Employers update own jobs" ON job_requests
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = (select auth.uid())) OR
        public.is_admin()
    );

-- ================================================================
-- 8. OFFERS — use is_admin()
-- ================================================================
DROP POLICY IF EXISTS "View own offers" ON offers;
CREATE POLICY "View own offers" ON offers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = (select auth.uid())) OR
        EXISTS (SELECT 1 FROM job_requests jr JOIN employers e ON jr.employer_id = e.id WHERE jr.id = job_request_id AND e.profile_id = (select auth.uid())) OR
        public.is_admin()
    );

-- ================================================================
-- 9. DOCUMENTS (legacy) — use is_admin()
-- ================================================================
DROP POLICY IF EXISTS "Candidates view own documents" ON documents;
CREATE POLICY "Candidates view own documents" ON documents
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = (select auth.uid())) OR
        public.is_admin()
    );

DROP POLICY IF EXISTS "Candidates upload own documents" ON documents;
CREATE POLICY "Candidates upload own documents" ON documents
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = (select auth.uid()))
    );

-- ================================================================
-- 10. CONTRACT_DATA — use is_admin()
-- ================================================================
DROP POLICY IF EXISTS "View own contract data" ON contract_data;
CREATE POLICY "View own contract data" ON contract_data
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM matches m JOIN candidates c ON m.candidate_id = c.id WHERE m.id = match_id AND c.profile_id = (select auth.uid())) OR
        EXISTS (SELECT 1 FROM matches m JOIN employers e ON m.employer_id = e.id WHERE m.id = match_id AND e.profile_id = (select auth.uid())) OR
        public.is_admin()
    );

-- ================================================================
-- 11. CANDIDATE_DOCUMENTS — use is_admin()
-- ================================================================
DROP POLICY IF EXISTS "Users view own documents" ON candidate_documents;
CREATE POLICY "Users view own documents" ON candidate_documents
    FOR SELECT USING (
        user_id = (select auth.uid()) 
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Users insert own documents" ON candidate_documents;
CREATE POLICY "Users insert own documents" ON candidate_documents
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users update own documents" ON candidate_documents;
CREATE POLICY "Users update own documents" ON candidate_documents
    FOR UPDATE USING (
        user_id = (select auth.uid()) 
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Users delete own documents" ON candidate_documents;
CREATE POLICY "Users delete own documents" ON candidate_documents
    FOR DELETE USING (
        user_id = (select auth.uid()) 
        OR public.is_admin()
    );

-- ================================================================
-- 12. EMAIL_QUEUE — use is_admin()
-- ================================================================
DROP POLICY IF EXISTS "Users view own emails" ON email_queue;
CREATE POLICY "Users view own emails" ON email_queue
    FOR SELECT USING (
        user_id = (select auth.uid()) 
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "Anyone can insert emails" ON email_queue;
CREATE POLICY "Anyone can insert emails" ON email_queue
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users update own emails" ON email_queue;
CREATE POLICY "Users update own emails" ON email_queue
    FOR UPDATE USING (user_id = (select auth.uid()))
    WITH CHECK (user_id = (select auth.uid()));

-- ================================================================
-- 13. SIGNATURES — use is_admin()
-- ================================================================
DROP POLICY IF EXISTS "Users manage own signature" ON signatures;
CREATE POLICY "Users manage own signature" ON signatures
    FOR ALL USING (
        user_id = (select auth.uid()) 
        OR public.is_admin()
    );

-- ================================================================
-- 14. WHATSAPP_MESSAGES — use is_admin()
-- ================================================================
DROP POLICY IF EXISTS "Admins can view WhatsApp messages" ON whatsapp_messages;
CREATE POLICY "Admins can view WhatsApp messages" ON whatsapp_messages
    FOR ALL USING (
        public.is_admin()
    );
