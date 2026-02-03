-- Alignment Migration for Workers United
-- Synchronizes schema with specific business rules (Doc status, Payment deadlines, Admin views)

-- 1. Profiles Update
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- 2. Candidate Documents Refinement
-- We ensure specific statuses and columns as requested
ALTER TABLE public.candidate_documents 
RENAME COLUMN candidate_id TO user_id;

-- Ensure doc_type is constrained to specifically the 3 required ones
ALTER TABLE public.candidate_documents DROP CONSTRAINT IF EXISTS candidate_documents_document_type_check;
ALTER TABLE public.candidate_documents ADD CONSTRAINT candidate_documents_document_type_check 
CHECK (document_type IN ('passport', 'biometric_photo', 'diploma'));

ALTER TABLE public.candidate_documents 
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reject_reason TEXT,
ADD COLUMN IF NOT EXISTS ocr_json JSONB;

-- 3. Payments Refinement
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS amount_usd DECIMAL(10,2) DEFAULT 9.00,
ADD COLUMN IF NOT EXISTS provider TEXT,
ADD COLUMN IF NOT EXISTS provider_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS provider_session_id TEXT,
ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMP WITH TIME ZONE;

-- Trigger to calculate deadline_at automatically on payment
CREATE OR REPLACE FUNCTION calculate_payment_deadline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.paid_at IS NOT NULL THEN
        NEW.deadline_at := NEW.paid_at + INTERVAL '90 days';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_payment_deadline ON public.payments;
CREATE TRIGGER set_payment_deadline
BEFORE INSERT OR UPDATE OF paid_at ON public.payments
FOR EACH ROW
EXECUTE FUNCTION calculate_payment_deadline();

-- 4. Views Reconstruction
-- Candidate Readiness: True if all 3 docs are verified
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
WHERE p.role = 'candidate'
GROUP BY p.id, p.email, p.full_name;

-- Admin Payment Countdown: days_left from deadline_at
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

-- 5. RLS Policies (Idempotent update)
-- Reset policies if needed
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Candidates can only see own docs" ON public.candidate_documents;
CREATE POLICY "Candidates can only see own docs" ON public.candidate_documents
FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Candidates can only see own payments" ON public.payments;
CREATE POLICY "Candidates can only see own payments" ON public.payments
FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins see everything docs" ON public.candidate_documents;
CREATE POLICY "Admins see everything docs" ON public.candidate_documents
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "Admins see everything payments" ON public.payments;
CREATE POLICY "Admins see everything payments" ON public.payments
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
