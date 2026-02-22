-- ============================================================
-- MIGRATION 010: Fix RLS Performance Warnings
-- Replaces auth.uid() with (select auth.uid()) in all policies
-- Consolidates duplicate policies on candidate_documents
-- ============================================================

-- ================================================================
-- 1. PROFILES
-- ================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (
        (select auth.uid()) = id 
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK ((select auth.uid()) = id);

-- ================================================================
-- 2. CANDIDATES
-- ================================================================
DROP POLICY IF EXISTS "Candidates view own data" ON candidates;
CREATE POLICY "Candidates view own data" ON candidates
    FOR SELECT USING (
        profile_id = (select auth.uid()) 
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type IN ('admin', 'employer'))
    );

DROP POLICY IF EXISTS "Candidates update own data" ON candidates;
CREATE POLICY "Candidates update own data" ON candidates
    FOR UPDATE USING (
        profile_id = (select auth.uid()) 
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

DROP POLICY IF EXISTS "Candidates insert own data" ON candidates;
CREATE POLICY "Candidates insert own data" ON candidates
    FOR INSERT WITH CHECK (profile_id = (select auth.uid()));

-- ================================================================
-- 3. EMPLOYERS
-- ================================================================
DROP POLICY IF EXISTS "Employers view own data" ON employers;
CREATE POLICY "Employers view own data" ON employers
    FOR SELECT USING (
        profile_id = (select auth.uid()) 
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

DROP POLICY IF EXISTS "Employers update own data" ON employers;
CREATE POLICY "Employers update own data" ON employers
    FOR UPDATE USING (profile_id = (select auth.uid()));

DROP POLICY IF EXISTS "Employers insert own data" ON employers;
CREATE POLICY "Employers insert own data" ON employers
    FOR INSERT WITH CHECK (profile_id = (select auth.uid()));

-- ================================================================
-- 4. MATCHES
-- ================================================================
DROP POLICY IF EXISTS "View own matches" ON matches;
CREATE POLICY "View own matches" ON matches
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = (select auth.uid())) OR
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = (select auth.uid())) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

-- ================================================================
-- 5. PAYMENTS
-- ================================================================
DROP POLICY IF EXISTS "View own payments" ON payments;
CREATE POLICY "View own payments" ON payments
    FOR SELECT USING (
        user_id = (select auth.uid()) 
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

DROP POLICY IF EXISTS "Create own payments" ON payments;
CREATE POLICY "Create own payments" ON payments
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

-- ================================================================
-- 6. JOB_REQUESTS
-- ================================================================
DROP POLICY IF EXISTS "Employers view own jobs" ON job_requests;
CREATE POLICY "Employers view own jobs" ON job_requests
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = (select auth.uid())) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type IN ('admin', 'candidate'))
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
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

-- ================================================================
-- 7. OFFERS
-- ================================================================
DROP POLICY IF EXISTS "View own offers" ON offers;
CREATE POLICY "View own offers" ON offers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = (select auth.uid())) OR
        EXISTS (SELECT 1 FROM job_requests jr JOIN employers e ON jr.employer_id = e.id WHERE jr.id = job_request_id AND e.profile_id = (select auth.uid())) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

-- ================================================================
-- 8. DOCUMENTS (legacy table)
-- ================================================================
DROP POLICY IF EXISTS "Candidates view own documents" ON documents;
CREATE POLICY "Candidates view own documents" ON documents
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = (select auth.uid())) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

DROP POLICY IF EXISTS "Candidates upload own documents" ON documents;
CREATE POLICY "Candidates upload own documents" ON documents
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = (select auth.uid()))
    );

-- ================================================================
-- 9. CONTRACT_DATA
-- ================================================================
DROP POLICY IF EXISTS "View own contract data" ON contract_data;
CREATE POLICY "View own contract data" ON contract_data
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM matches m JOIN candidates c ON m.candidate_id = c.id WHERE m.id = match_id AND c.profile_id = (select auth.uid())) OR
        EXISTS (SELECT 1 FROM matches m JOIN employers e ON m.employer_id = e.id WHERE m.id = match_id AND e.profile_id = (select auth.uid())) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

-- ================================================================
-- 10. CANDIDATE_DOCUMENTS — CONSOLIDATE & FIX
-- Drop ALL overlapping policies, recreate clean set
-- ================================================================
DROP POLICY IF EXISTS "Candidates can view own documents" ON candidate_documents;
DROP POLICY IF EXISTS "Candidates can insert own documents" ON candidate_documents;
DROP POLICY IF EXISTS "Candidates can update own documents" ON candidate_documents;
DROP POLICY IF EXISTS "Candidates can delete own documents" ON candidate_documents;
DROP POLICY IF EXISTS "Candidates can only see own docs" ON candidate_documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON candidate_documents;
DROP POLICY IF EXISTS "Admins can manage all documents" ON candidate_documents;
DROP POLICY IF EXISTS "Admins see everything docs" ON candidate_documents;

-- Consolidated: one SELECT, one INSERT, one UPDATE, one DELETE for candidates + one ALL for admins
CREATE POLICY "Users view own documents" ON candidate_documents
    FOR SELECT USING (
        user_id = (select auth.uid()) 
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

CREATE POLICY "Users insert own documents" ON candidate_documents
    FOR INSERT WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users update own documents" ON candidate_documents
    FOR UPDATE USING (
        user_id = (select auth.uid()) 
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

CREATE POLICY "Users delete own documents" ON candidate_documents
    FOR DELETE USING (
        user_id = (select auth.uid()) 
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

-- ================================================================
-- 11. EMAIL_QUEUE
-- ================================================================
DROP POLICY IF EXISTS "Users view own emails" ON email_queue;
CREATE POLICY "Users view own emails" ON email_queue
    FOR SELECT USING (
        user_id = (select auth.uid()) 
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

DROP POLICY IF EXISTS "Anyone can insert emails" ON email_queue;
CREATE POLICY "Anyone can insert emails" ON email_queue
    FOR INSERT WITH CHECK (true);

-- ================================================================
-- 12. SIGNATURES
-- ================================================================
DROP POLICY IF EXISTS "Users manage own signature" ON signatures;
CREATE POLICY "Users manage own signature" ON signatures
    FOR ALL USING (
        user_id = (select auth.uid()) 
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );
