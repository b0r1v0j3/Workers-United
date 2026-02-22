-- ================================================================
-- WORKERS UNITED — ALL MISSING MIGRATIONS (CONSOLIDATED)
-- Run this ONCE in Supabase SQL Editor
-- Safe to re-run — uses IF NOT EXISTS / IF EXISTS everywhere
-- Last updated: 18.02.2026
-- ================================================================

-- ================================================================
-- 1. EMAIL QUEUE TABLE (from 001_create_email_queue.sql)
-- ================================================================
CREATE TABLE IF NOT EXISTS email_queue (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    email_type text NOT NULL,
    recipient_email text NOT NULL,
    recipient_name text,
    subject text NOT NULL,
    template_data jsonb DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'pending',
    scheduled_for timestamptz NOT NULL DEFAULT now(),
    sent_at timestamptz,
    read_at timestamptz,
    error_message text,
    created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_status_scheduled ON email_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_queue_email_type ON email_queue(email_type);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own emails" ON email_queue;
CREATE POLICY "Users can read own emails" ON email_queue
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can mark own emails as read" ON email_queue;
CREATE POLICY "Users can mark own emails as read" ON email_queue
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ================================================================
-- 2. EXTEND CONTRACT_DATA TABLE (from 002 + 003 + 008)
-- ================================================================
ALTER TABLE contract_data 
  ADD COLUMN IF NOT EXISTS candidate_passport_issue_date DATE,
  ADD COLUMN IF NOT EXISTS candidate_passport_issuer TEXT,
  ADD COLUMN IF NOT EXISTS candidate_place_of_birth TEXT,
  ADD COLUMN IF NOT EXISTS candidate_gender TEXT,
  ADD COLUMN IF NOT EXISTS employer_mb TEXT,
  ADD COLUMN IF NOT EXISTS employer_director TEXT,
  ADD COLUMN IF NOT EXISTS job_description_sr TEXT,
  ADD COLUMN IF NOT EXISTS job_description_en TEXT,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS signing_date DATE,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generated_documents JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS employer_city TEXT,
  ADD COLUMN IF NOT EXISTS employer_founding_date TEXT,
  ADD COLUMN IF NOT EXISTS employer_apr_number TEXT,
  ADD COLUMN IF NOT EXISTS signing_city TEXT;

-- ================================================================
-- 3. STORAGE POLICIES FOR CONTRACTS (from 003)
-- ================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Admin upload contracts' 
        AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Admin upload contracts" ON storage.objects
            FOR INSERT TO authenticated
            WITH CHECK (
                bucket_id = 'candidate-docs' 
                AND (storage.foldername(name))[1] = 'contracts'
                AND EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND user_type = 'admin'
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Admin read contracts' 
        AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Admin read contracts" ON storage.objects
            FOR SELECT TO authenticated
            USING (
                bucket_id = 'candidate-docs' 
                AND (storage.foldername(name))[1] = 'contracts'
                AND EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND user_type = 'admin'
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE policyname = 'Admin update contracts' 
        AND tablename = 'objects'
    ) THEN
        CREATE POLICY "Admin update contracts" ON storage.objects
            FOR UPDATE TO authenticated
            USING (
                bucket_id = 'candidate-docs' 
                AND (storage.foldername(name))[1] = 'contracts'
                AND EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND user_type = 'admin'
                )
            );
    END IF;
END $$;

-- ================================================================
-- 4. CANDIDATES — MISSING COLUMNS (from 004_bugfix + 005)
-- ================================================================
ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS current_country TEXT,
ADD COLUMN IF NOT EXISTS birth_country TEXT,
ADD COLUMN IF NOT EXISTS birth_city TEXT,
ADD COLUMN IF NOT EXISTS citizenship TEXT,
ADD COLUMN IF NOT EXISTS original_citizenship TEXT,
ADD COLUMN IF NOT EXISTS maiden_name TEXT,
ADD COLUMN IF NOT EXISTS father_name TEXT,
ADD COLUMN IF NOT EXISTS mother_name TEXT,
ADD COLUMN IF NOT EXISTS marital_status TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS family_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS passport_number TEXT,
ADD COLUMN IF NOT EXISTS passport_issued_by TEXT,
ADD COLUMN IF NOT EXISTS passport_issue_date DATE,
ADD COLUMN IF NOT EXISTS passport_expiry_date DATE,
ADD COLUMN IF NOT EXISTS lives_abroad TEXT,
ADD COLUMN IF NOT EXISTS previous_visas TEXT,
ADD COLUMN IF NOT EXISTS desired_industries TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS desired_countries TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS job_search_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS job_search_activated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refund_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refund_eligible BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS signature_agreed_at TIMESTAMPTZ;

-- ================================================================
-- 5. CANDIDATES — STATUS CHECK CONSTRAINT (from 007_admin_approval)
-- ================================================================
ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_status_check;
ALTER TABLE public.candidates ADD CONSTRAINT candidates_status_check
CHECK (status IN (
    'NEW',
    'PROFILE_COMPLETE',
    'PENDING_APPROVAL',
    'VERIFIED',
    'APPROVED',
    'IN_QUEUE',
    'OFFER_PENDING',
    'OFFER_ACCEPTED',
    'VISA_PROCESS_STARTED',
    'VISA_APPROVED',
    'PLACED',
    'REJECTED',
    'REJECTED_TWICE',
    'REFUND_FLAGGED',
    'DOCS_REQUESTED', 'DOCS_RECEIVED', 'DOCS_PENDING', 'DOCS_VERIFYING',
    'UNDER_REVIEW'
));

-- ================================================================
-- 6. CANDIDATES — ADMIN APPROVAL COLUMNS (from 007_admin_approval)
-- ================================================================
ALTER TABLE public.candidates 
ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_candidates_pending_approval 
ON candidates(admin_approved) WHERE admin_approved = FALSE;

-- ================================================================
-- 7. EMPLOYERS — ALL MISSING COLUMNS (from 20260209 + 004 + 005)
-- ================================================================
ALTER TABLE employers ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS company_registration_number TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS company_address TEXT;
-- contact_phone may already exist from FULL_SETUP.sql
ALTER TABLE employers ADD COLUMN IF NOT EXISTS contact_phone TEXT;
-- country may already exist from FULL_SETUP.sql
ALTER TABLE employers ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS city TEXT;
-- industry may already exist from FULL_SETUP.sql
ALTER TABLE employers ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS founded_year TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS business_registry_number TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS founding_date TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS mb VARCHAR(8);

-- ================================================================
-- 8. EMPLOYERS — ADMIN APPROVAL + STATUS (from 007 + 006)
-- ================================================================
ALTER TABLE public.employers
ADD COLUMN IF NOT EXISTS admin_approved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS admin_approved_by UUID REFERENCES profiles(id);

CREATE INDEX IF NOT EXISTS idx_employers_pending_approval 
ON employers(admin_approved) WHERE admin_approved = FALSE;

ALTER TABLE public.employers DROP CONSTRAINT IF EXISTS employers_status_check;
ALTER TABLE public.employers ADD CONSTRAINT employers_status_check
    CHECK (status IN (
        'PENDING', 'ACTIVE', 'VERIFIED', 'REJECTED', 'SUSPENDED',
        'pending', 'active', 'verified', 'rejected', 'suspended'
    ));

-- ================================================================
-- 9. PAYMENTS — MISSING COLUMNS (from 004_bugfix)
-- ================================================================
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS refund_status TEXT,
ADD COLUMN IF NOT EXISTS refund_notes TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- ================================================================
-- 10. SIGNATURES TABLE (from 004_bugfix + 007_round10)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    signature_data TEXT NOT NULL,
    document_type TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    agreed_text TEXT,
    agreed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own signatures" ON public.signatures;
CREATE POLICY "Users can manage own signatures" ON public.signatures
    FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all signatures" ON public.signatures;
CREATE POLICY "Admins can view all signatures" ON public.signatures
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- ================================================================
-- 11. WHATSAPP MESSAGES TABLE (from 004_bugfix)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    phone_number TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT DEFAULT 'text',
    content TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view WhatsApp messages" ON public.whatsapp_messages;
CREATE POLICY "Admins can view WhatsApp messages" ON public.whatsapp_messages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- ================================================================
-- 12. JOB REQUESTS — MISSING COLUMNS (from 20260209 + 005)
-- ================================================================
ALTER TABLE public.job_requests
ADD COLUMN IF NOT EXISTS work_city TEXT,
ADD COLUMN IF NOT EXISTS description_en TEXT;

-- ================================================================
-- 13. JOB REQUESTS — RLS POLICIES (from 20260209)
-- ================================================================
DROP POLICY IF EXISTS "allow_all_job_requests" ON job_requests;
DROP POLICY IF EXISTS "job_requests_select" ON job_requests;
DROP POLICY IF EXISTS "job_requests_insert" ON job_requests;
DROP POLICY IF EXISTS "job_requests_update" ON job_requests;
DROP POLICY IF EXISTS "job_requests_delete" ON job_requests;
DROP POLICY IF EXISTS "Employers view own jobs" ON job_requests;
DROP POLICY IF EXISTS "Employers create jobs" ON job_requests;
DROP POLICY IF EXISTS "Employers update own jobs" ON job_requests;

CREATE POLICY "job_requests_select" ON job_requests FOR SELECT USING (
    EXISTS (SELECT 1 FROM employers e WHERE e.id = employer_id AND e.profile_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type IN ('admin', 'candidate'))
);

CREATE POLICY "job_requests_insert" ON job_requests FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM employers e WHERE e.id = employer_id AND e.profile_id = auth.uid())
);

CREATE POLICY "job_requests_update" ON job_requests FOR UPDATE USING (
    EXISTS (SELECT 1 FROM employers e WHERE e.id = employer_id AND e.profile_id = auth.uid())
);

CREATE POLICY "job_requests_delete" ON job_requests FOR DELETE USING (
    EXISTS (SELECT 1 FROM employers e WHERE e.id = employer_id AND e.profile_id = auth.uid())
);

-- ================================================================
-- 14. EMAIL QUEUE — DROP RESTRICTIVE CHECK (from 006)
-- ================================================================
ALTER TABLE public.email_queue
DROP CONSTRAINT IF EXISTS email_queue_email_type_check;

-- ================================================================
-- 15. RPCs / FUNCTIONS (from 006 + 009)
-- ================================================================
CREATE OR REPLACE FUNCTION increment_positions_filled(job_request_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE job_requests
    SET positions_filled = positions_filled + 1,
        updated_at = NOW()
    WHERE id = job_request_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_offer_rejection(p_offer_id UUID)
RETURNS VOID AS $$
DECLARE
    offer_rec RECORD;
    candidate_rec RECORD;
    max_position INTEGER;
BEGIN
    SELECT * INTO offer_rec FROM offers WHERE id = p_offer_id;
    IF NOT FOUND THEN RETURN; END IF;
    
    SELECT * INTO candidate_rec FROM candidates WHERE id = offer_rec.candidate_id;
    IF NOT FOUND THEN RETURN; END IF;
    
    UPDATE candidates 
    SET rejection_count = rejection_count + 1,
        refund_eligible = FALSE
    WHERE id = offer_rec.candidate_id;
    
    IF candidate_rec.rejection_count + 1 >= 2 THEN
        UPDATE candidates 
        SET status = 'REJECTED_TWICE',
            queue_position = NULL,
            entry_fee_paid = FALSE
        WHERE id = offer_rec.candidate_id;
    ELSE
        SELECT COALESCE(MAX(queue_position), 0) + 1 INTO max_position
        FROM candidates WHERE entry_fee_paid = TRUE;
        
        UPDATE candidates 
        SET status = 'IN_QUEUE',
            queue_position = max_position
        WHERE id = offer_rec.candidate_id;
    END IF;
    
    UPDATE offers 
    SET status = 'expired'
    WHERE id = p_offer_id;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 16. RECREATE SIGNUP TRIGGER (from 20260209)
-- ================================================================
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

-- ================================================================
-- 17. ADMIN RLS POLICIES (from 004_bugfix)
-- ================================================================
DROP POLICY IF EXISTS "Admins see everything payments" ON public.payments;
CREATE POLICY "Admins see everything payments" ON public.payments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- ================================================================
-- DONE! All migrations applied.
-- Verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
-- ================================================================
