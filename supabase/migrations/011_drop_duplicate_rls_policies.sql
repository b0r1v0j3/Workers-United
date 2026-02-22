-- ============================================================
-- MIGRATION 011: Drop ALL duplicate and dangerous RLS policies
-- This removes old auth.uid() policies, allow_all policies,
-- and duplicate policies — leaving only the clean optimized ones.
-- ============================================================

-- ================================================================
-- 1. CANDIDATE_DOCUMENTS — remove old policy
-- ================================================================
DROP POLICY IF EXISTS "Users manage own docs" ON candidate_documents;

-- ================================================================
-- 2. CANDIDATES — remove 4 old/duplicate policies
-- ================================================================
DROP POLICY IF EXISTS "Users can insert own candidate" ON candidates;
DROP POLICY IF EXISTS "Users can update own candidate" ON candidates;
DROP POLICY IF EXISTS "Users can view own candidate" ON candidates;
DROP POLICY IF EXISTS "allow_all" ON candidates;

-- ================================================================
-- 3. CONTRACT_DATA — remove allow_all
-- ================================================================
DROP POLICY IF EXISTS "allow_all" ON contract_data;

-- ================================================================
-- 4. DOCUMENTS — remove allow_all
-- ================================================================
DROP POLICY IF EXISTS "allow_all" ON documents;

-- ================================================================
-- 5. EMAIL_QUEUE — remove 2 old duplicate policies, keep new ones
-- ================================================================
DROP POLICY IF EXISTS "Users can mark own emails as read" ON email_queue;
DROP POLICY IF EXISTS "Users can read own emails" ON email_queue;

-- ================================================================
-- 6. EMPLOYERS — remove allow_all
-- ================================================================
DROP POLICY IF EXISTS "allow_all" ON employers;

-- ================================================================
-- 7. JOB_REQUESTS — remove 4 old duplicates + allow_all
-- ================================================================
DROP POLICY IF EXISTS "job_requests_delete" ON job_requests;
DROP POLICY IF EXISTS "job_requests_insert" ON job_requests;
DROP POLICY IF EXISTS "job_requests_select" ON job_requests;
DROP POLICY IF EXISTS "job_requests_update" ON job_requests;
DROP POLICY IF EXISTS "allow_all" ON job_requests;

-- ================================================================
-- 8. MATCHES — remove allow_all
-- ================================================================
DROP POLICY IF EXISTS "allow_all" ON matches;

-- ================================================================
-- 9. OFFERS — remove allow_all
-- ================================================================
DROP POLICY IF EXISTS "allow_all" ON offers;

-- ================================================================
-- 10. PAYMENTS — fix old auth.uid() policy + remove allow_all + duplicate
-- ================================================================
DROP POLICY IF EXISTS "Admins see everything payments" ON payments;
DROP POLICY IF EXISTS "allow_all" ON payments;

-- ================================================================
-- 11. PROFILES — remove allow_all
-- ================================================================
DROP POLICY IF EXISTS "allow_all" ON profiles;

-- ================================================================
-- 12. SIGNATURES — remove 3 old duplicates, keep clean "Users manage own signature"
-- ================================================================
DROP POLICY IF EXISTS "Admins can view all signatures" ON signatures;
DROP POLICY IF EXISTS "Users can insert own signatures" ON signatures;
DROP POLICY IF EXISTS "Users can manage own signatures" ON signatures;
DROP POLICY IF EXISTS "Users can view own signatures" ON signatures;

-- ================================================================
-- 13. WHATSAPP_MESSAGES — fix auth.uid() → (select auth.uid())
-- ================================================================
DROP POLICY IF EXISTS "Admins can view WhatsApp messages" ON whatsapp_messages;
CREATE POLICY "Admins can view WhatsApp messages" ON whatsapp_messages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'admin')
    );

-- ================================================================
-- 14. EMAIL_QUEUE — fix missing UPDATE policy (for marking as read)
-- ================================================================
DROP POLICY IF EXISTS "Users update own emails" ON email_queue;
CREATE POLICY "Users update own emails" ON email_queue
    FOR UPDATE USING (user_id = (select auth.uid()))
    WITH CHECK (user_id = (select auth.uid()));
