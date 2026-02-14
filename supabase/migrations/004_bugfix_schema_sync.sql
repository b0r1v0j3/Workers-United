-- ================================================================
-- Migration 004: Bug Fix Schema Sync
-- Fixes all schema discrepancies found during deep audit (Rounds 1-4)
-- Run this AFTER all previous migrations (001-003 + 20260203* series)
-- ================================================================

-- ================================================================
-- 1. ADD OFFER_ACCEPTED TO candidates CHECK CONSTRAINT
-- Code uses OFFER_ACCEPTED in: offers/route.ts, stripe/webhook, whatsapp/webhook
-- Current CHECK doesn't include it → all offer acceptances crash
-- ================================================================
ALTER TABLE public.candidates DROP CONSTRAINT IF EXISTS candidates_status_check;
ALTER TABLE public.candidates ADD CONSTRAINT candidates_status_check
    CHECK (status IN (
        'NEW',
        'DOCS_REQUESTED', 'DOCS_RECEIVED', 'DOCS_PENDING', 'DOCS_VERIFYING',
        'UNDER_REVIEW', 'APPROVED', 'VERIFIED', 'REJECTED', 'REJECTED_TWICE',
        'IN_QUEUE', 'OFFER_PENDING', 'OFFER_ACCEPTED',
        'VISA_PROCESS_STARTED', 'REFUND_FLAGGED'
    ));

-- ================================================================
-- 2. ADD MISSING COLUMNS TO candidates
-- Used by: stripe/webhook, whatsapp/webhook, godmode, signatures
-- ================================================================
ALTER TABLE public.candidates
ADD COLUMN IF NOT EXISTS desired_countries TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS job_search_active BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS job_search_activated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refund_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refund_eligible BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS signature_agreed_at TIMESTAMPTZ;

-- ================================================================
-- 3. ADD MISSING COLUMNS TO payments
-- stripe/webhook uses user_id and amount (not profile_id/amount_cents)
-- alignment migration added user_id via RLS, ensure column exists
-- ================================================================
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS refund_status TEXT,
ADD COLUMN IF NOT EXISTS refund_notes TEXT,
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT,
ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'entry_fee';

-- ================================================================
-- 4. CREATE signatures TABLE (if not exists)
-- Used by: signatures/route.ts
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
-- 5. CREATE whatsapp_messages TABLE (if not exists)
-- Used by: whatsapp/webhook/route.ts
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
-- 6. FIX VIEWS: role → user_type
-- Views candidate_readiness and admin_candidate_full_overview
-- reference p.role which doesn't exist (should be p.user_type)
-- ================================================================

-- 6a. Fix candidate_readiness view
CREATE OR REPLACE VIEW public.candidate_readiness AS
SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    CASE 
        WHEN COUNT(cd.id) FILTER (WHERE cd.status = 'verified') = 3 THEN true
        ELSE false
    END as is_ready,
    COUNT(cd.id) FILTER (WHERE cd.status = 'verified') as verified_count
FROM public.profiles p
LEFT JOIN public.candidate_documents cd ON p.id = cd.user_id
WHERE p.user_type = 'worker'
GROUP BY p.id, p.email, p.full_name;

-- 6b. Fix admin_payment_countdown view
CREATE OR REPLACE VIEW public.admin_payment_countdown AS
SELECT 
    pay.user_id,
    p.email,
    pay.paid_at,
    pay.deadline_at,
    EXTRACT(DAY FROM (pay.deadline_at - NOW())) as days_left,
    pay.status as payment_status,
    pay.refund_status
FROM public.payments pay
JOIN public.profiles p ON pay.user_id = p.id;

-- 6c. Fix admin_candidate_full_overview view
CREATE OR REPLACE VIEW public.admin_candidate_full_overview AS
SELECT 
    p.id as user_id,
    p.email,
    p.full_name,
    p.user_type,
    cr.is_ready,
    cr.verified_count as verified_docs_count,
    pc.paid_at,
    pc.deadline_at,
    pc.days_left,
    pc.payment_status,
    pc.refund_status
FROM public.profiles p
LEFT JOIN public.candidate_readiness cr ON p.id = cr.user_id
LEFT JOIN public.admin_payment_countdown pc ON p.id = pc.user_id
WHERE p.user_type = 'worker';

-- ================================================================
-- 7. FIX RLS POLICIES: role → user_type
-- alignment.sql created policies that reference role = 'admin'
-- ================================================================
DROP POLICY IF EXISTS "Admins see everything docs" ON public.candidate_documents;
CREATE POLICY "Admins see everything docs" ON public.candidate_documents
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

DROP POLICY IF EXISTS "Admins see everything payments" ON public.payments;
CREATE POLICY "Admins see everything payments" ON public.payments
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- ================================================================
-- 8. ADD employers.mb COLUMN
-- Used by: docx-generator for employer matični broj
-- ================================================================
ALTER TABLE public.employers
ADD COLUMN IF NOT EXISTS mb VARCHAR(8);

-- ================================================================
-- DONE
-- ================================================================
