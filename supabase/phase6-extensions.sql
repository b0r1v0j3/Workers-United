-- ================================================================
-- WORKERS UNITED - PHASE 6 SCHEMA EXTENSIONS
-- Adds: Rejection tracking, Refund eligibility, Digital Signatures
-- Run AFTER queue-schema.sql
-- ================================================================

-- ================================================================
-- 1. EXTEND CANDIDATES TABLE
-- ================================================================
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS refund_eligible BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS refund_deadline TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS signature_url TEXT,
ADD COLUMN IF NOT EXISTS signature_agreed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Update status check to include REJECTED_TWICE
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_status_check 
CHECK (status IN (
    'NEW',                    
    'PROFILE_COMPLETE',       
    'DOCS_PENDING',           -- Waiting for document upload
    'DOCS_VERIFYING',         -- AI verification in progress
    'VERIFIED',               -- All docs verified, can pay
    'IN_QUEUE',               -- Paid $9, waiting for match
    'OFFER_PENDING',          -- Has active offer, 24h countdown
    'OFFER_ACCEPTED',         -- Paid confirmation, processing
    'VISA_PROCESS_STARTED',   
    'VISA_APPROVED',          
    'PLACED',                 -- Successfully employed
    'REJECTED',               
    'REJECTED_TWICE',         -- Missed 2 offers, must repay
    'REFUND_PROCESSED'        -- 90 days passed, refunded
));

-- ================================================================
-- 2. EXTEND OFFERS TABLE
-- ================================================================
ALTER TABLE offers
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- ================================================================
-- 3. DIGITAL SIGNATURES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS signatures (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    signature_data TEXT NOT NULL, -- Base64 PNG
    document_type TEXT NOT NULL CHECK (document_type IN (
        'power_of_attorney',
        'work_permit_application', 
        'employment_contract',
        'general_consent'
    )),
    ip_address TEXT,
    user_agent TEXT,
    agreed_text TEXT, -- The text they agreed to
    agreed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signatures_user ON signatures(user_id);
CREATE INDEX IF NOT EXISTS idx_signatures_type ON signatures(document_type);

-- ================================================================
-- 4. EMAIL QUEUE TABLE (for n8n integration)
-- ================================================================
CREATE TABLE IF NOT EXISTS email_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    email_type TEXT NOT NULL CHECK (email_type IN (
        'welcome',
        'document_reminder',
        'verification_complete',
        'payment_confirmation',
        'job_offer',
        'offer_reminder',
        'offer_expired',
        'rejection_warning',
        'refund_processed'
    )),
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT,
    template_data JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_email_queue_user ON email_queue(user_id);

-- ================================================================
-- 5. WHATSAPP MESSAGES TABLE (for bot integration)
-- ================================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    phone_number TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'template', 'media')),
    content TEXT,
    template_name TEXT,
    template_data JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
    external_id TEXT, -- Twilio/360dialog message ID
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_user ON whatsapp_messages(user_id);

-- ================================================================
-- 6. EXTEND EMPLOYERS TABLE
-- ================================================================
ALTER TABLE employers
ADD COLUMN IF NOT EXISTS pib TEXT,
ADD COLUMN IF NOT EXISTS registration_number TEXT,
ADD COLUMN IF NOT EXISTS company_address TEXT,
ADD COLUMN IF NOT EXISTS accommodation_address TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS contact_person TEXT,
ADD COLUMN IF NOT EXISTS workers_needed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS job_description TEXT,
ADD COLUMN IF NOT EXISTS salary_range TEXT,
ADD COLUMN IF NOT EXISTS auto_approved BOOLEAN DEFAULT FALSE;

-- Update employer status check
ALTER TABLE employers DROP CONSTRAINT IF EXISTS employers_status_check;
ALTER TABLE employers ADD CONSTRAINT employers_status_check 
CHECK (status IN ('PENDING', 'ACTIVE', 'VERIFIED', 'REJECTED', 'SUSPENDED'));

-- ================================================================
-- 7. RLS FOR NEW TABLES
-- ================================================================
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- Signatures: Users see own, admin sees all
CREATE POLICY "Users view own signatures" ON signatures
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

CREATE POLICY "Users create own signatures" ON signatures
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- Email queue: Admin only
CREATE POLICY "Admin manages email queue" ON email_queue
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- WhatsApp: Admin only + service role
CREATE POLICY "Admin manages whatsapp" ON whatsapp_messages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- ================================================================
-- 8. FUNCTIONS FOR OFFER REJECTION
-- ================================================================

-- Function to handle offer expiry/rejection
CREATE OR REPLACE FUNCTION handle_offer_rejection(p_offer_id UUID)
RETURNS VOID AS $$
DECLARE
    offer_rec RECORD;
    candidate_rec RECORD;
    max_position INTEGER;
BEGIN
    -- Get offer details
    SELECT * INTO offer_rec FROM offers WHERE id = p_offer_id;
    IF NOT FOUND THEN RETURN; END IF;
    
    -- Get candidate
    SELECT * INTO candidate_rec FROM candidates WHERE id = offer_rec.candidate_id;
    IF NOT FOUND THEN RETURN; END IF;
    
    -- Increment rejection count
    UPDATE candidates 
    SET rejection_count = rejection_count + 1,
        refund_eligible = FALSE -- Lost refund eligibility
    WHERE id = offer_rec.candidate_id;
    
    -- Check if this is 2nd rejection
    IF candidate_rec.rejection_count + 1 >= 2 THEN
        -- Mark as rejected twice
        UPDATE candidates 
        SET status = 'REJECTED_TWICE',
            queue_position = NULL,
            entry_fee_paid = FALSE
        WHERE id = offer_rec.candidate_id;
    ELSE
        -- Move to bottom of queue
        SELECT COALESCE(MAX(queue_position), 0) + 1 INTO max_position
        FROM candidates WHERE entry_fee_paid = TRUE;
        
        UPDATE candidates 
        SET status = 'IN_QUEUE',
            queue_position = max_position
        WHERE id = offer_rec.candidate_id;
    END IF;
    
    -- Mark offer as expired
    UPDATE offers 
    SET status = 'expired'
    WHERE id = p_offer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to process 90-day refunds
CREATE OR REPLACE FUNCTION check_refund_eligibility()
RETURNS TABLE(user_id UUID, email TEXT, full_name TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT c.profile_id, p.email, p.full_name
    FROM candidates c
    JOIN profiles p ON p.id = c.profile_id
    WHERE c.status = 'IN_QUEUE'
      AND c.refund_eligible = TRUE
      AND c.refund_deadline IS NOT NULL
      AND c.refund_deadline <= NOW();
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 9. AUTO-APPROVAL TRIGGER FOR EMPLOYERS
-- ================================================================
CREATE OR REPLACE FUNCTION check_employer_auto_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if all required fields are filled
    IF NEW.pib IS NOT NULL 
       AND NEW.registration_number IS NOT NULL
       AND NEW.company_address IS NOT NULL
       AND NEW.accommodation_address IS NOT NULL
       AND NEW.contact_phone IS NOT NULL
    THEN
        NEW.status := 'ACTIVE';
        NEW.auto_approved := TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS employer_auto_approval ON employers;
CREATE TRIGGER employer_auto_approval
    BEFORE UPDATE ON employers
    FOR EACH ROW EXECUTE FUNCTION check_employer_auto_approval();

-- ================================================================
-- 10. SET REFUND DEADLINE ON PAYMENT
-- ================================================================
CREATE OR REPLACE FUNCTION set_refund_deadline()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.payment_type = 'entry_fee' AND NEW.status = 'completed' THEN
        UPDATE candidates 
        SET refund_deadline = NOW() + INTERVAL '90 days'
        WHERE profile_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS payment_set_refund_deadline ON payments;
CREATE TRIGGER payment_set_refund_deadline
    AFTER UPDATE ON payments
    FOR EACH ROW 
    WHEN (OLD.status != 'completed' AND NEW.status = 'completed')
    EXECUTE FUNCTION set_refund_deadline();
