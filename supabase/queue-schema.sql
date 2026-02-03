-- ================================================================
-- WORKERS UNITED - QUEUE SYSTEM SCHEMA EXTENSION
-- Run this AFTER the base schema (schema.sql)
-- ================================================================

-- ================================================================
-- 1. PAYMENTS TABLE
-- Tracks both $9 entry fee and $190 confirmation fee
-- ================================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    payment_type TEXT NOT NULL CHECK (payment_type IN ('entry_fee', 'confirmation_fee', 'refund')),
    stripe_payment_intent_id TEXT,
    stripe_checkout_session_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'flagged_for_refund')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ================================================================
-- 2. JOB REQUESTS TABLE
-- Employer job postings with multi-position support
-- ================================================================
CREATE TABLE IF NOT EXISTS job_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employer_id UUID REFERENCES employers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    destination_country TEXT NOT NULL,
    industry TEXT,
    positions_count INTEGER NOT NULL DEFAULT 1,
    positions_filled INTEGER DEFAULT 0,
    salary_min DECIMAL(10,2),
    salary_max DECIMAL(10,2),
    salary_currency TEXT DEFAULT 'EUR',
    requirements JSONB DEFAULT '{}',
    -- Requirements JSON structure:
    -- { "experience_years": 2, "languages": ["English"], "skills": ["driving"] }
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'matching', 'filled', 'closed', 'cancelled')),
    auto_match_triggered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 3. OFFERS TABLE
-- 24-hour expiry tracking for job offers
-- ================================================================
CREATE TABLE IF NOT EXISTS offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_request_id UUID REFERENCES job_requests(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    queue_position_at_offer INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked', 'declined')),
    offered_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    payment_id UUID REFERENCES payments(id),
    notification_sent BOOLEAN DEFAULT FALSE,
    notification_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate offers
    UNIQUE(job_request_id, candidate_id)
);

-- ================================================================
-- 4. UPDATE CANDIDATES TABLE
-- Add queue-related fields
-- ================================================================
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS queue_position INTEGER,
ADD COLUMN IF NOT EXISTS queue_joined_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS entry_fee_paid BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS entry_payment_id UUID REFERENCES payments(id),
ADD COLUMN IF NOT EXISTS preferred_countries TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS preferred_industries TEXT[] DEFAULT '{}';

-- Drop old constraint and add new status values
ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_status_check;
ALTER TABLE candidates ADD CONSTRAINT candidates_status_check 
CHECK (status IN (
    'NEW',                    -- Just signed up
    'PROFILE_COMPLETE',       -- Profile filled, not paid
    'IN_QUEUE',              -- Paid $9, waiting for match
    'OFFER_PENDING',         -- Has active offer, 24h countdown
    'OFFER_ACCEPTED',        -- Paid $190, waiting for visa process
    'VISA_PROCESS_STARTED',  -- Visa application in progress
    'VISA_APPROVED',         -- Visa granted
    'PLACED',                -- Successfully employed
    'REJECTED',              -- Application rejected
    'REFUND_FLAGGED'         -- 90 days without match, flagged for refund
));

-- ================================================================
-- 5. INDEXES FOR PERFORMANCE
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON payments(stripe_checkout_session_id);

CREATE INDEX IF NOT EXISTS idx_job_requests_status ON job_requests(status);
CREATE INDEX IF NOT EXISTS idx_job_requests_employer ON job_requests(employer_id);
CREATE INDEX IF NOT EXISTS idx_job_requests_country ON job_requests(destination_country);

CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_expires ON offers(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_offers_job_request ON offers(job_request_id);
CREATE INDEX IF NOT EXISTS idx_offers_candidate ON offers(candidate_id);

CREATE INDEX IF NOT EXISTS idx_candidates_queue ON candidates(queue_position) 
    WHERE entry_fee_paid = TRUE AND status = 'IN_QUEUE';
CREATE INDEX IF NOT EXISTS idx_candidates_queue_date ON candidates(queue_joined_at)
    WHERE entry_fee_paid = TRUE;

-- ================================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ================================================================

-- Enable RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;

-- PAYMENTS: Users see own, admin sees all
CREATE POLICY "Users view own payments" ON payments
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

CREATE POLICY "System inserts payments" ON payments
    FOR INSERT WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- JOB REQUESTS: Employers see own, candidates see open, admin sees all
CREATE POLICY "Employers view own job requests" ON job_requests
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = auth.uid()) OR
        status IN ('open', 'matching') OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

CREATE POLICY "Employers create job requests" ON job_requests
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

CREATE POLICY "Employers update own job requests" ON job_requests
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- OFFERS: Candidates see own, admin sees all
CREATE POLICY "Candidates view own offers" ON offers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

CREATE POLICY "System creates offers" ON offers
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

CREATE POLICY "System updates offers" ON offers
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- ================================================================
-- 7. HELPER FUNCTIONS
-- ================================================================

-- Function to get next queue position
CREATE OR REPLACE FUNCTION get_next_queue_position()
RETURNS INTEGER AS $$
DECLARE
    next_pos INTEGER;
BEGIN
    SELECT COALESCE(MAX(queue_position), 0) + 1 
    INTO next_pos 
    FROM candidates 
    WHERE entry_fee_paid = TRUE;
    RETURN next_pos;
END;
$$ LANGUAGE plpgsql;

-- Function to add candidate to queue after payment
CREATE OR REPLACE FUNCTION add_candidate_to_queue(p_candidate_id UUID, p_payment_id UUID)
RETURNS INTEGER AS $$
DECLARE
    new_position INTEGER;
BEGIN
    new_position := get_next_queue_position();
    
    UPDATE candidates 
    SET 
        queue_position = new_position,
        queue_joined_at = NOW(),
        entry_fee_paid = TRUE,
        entry_payment_id = p_payment_id,
        status = 'IN_QUEUE'
    WHERE id = p_candidate_id;
    
    RETURN new_position;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-match candidates for a job request
CREATE OR REPLACE FUNCTION auto_match_candidates(p_job_request_id UUID)
RETURNS INTEGER AS $$
DECLARE
    job_req RECORD;
    candidate_rec RECORD;
    positions_to_fill INTEGER;
    matched_count INTEGER := 0;
    offer_expires TIMESTAMPTZ;
BEGIN
    -- Get job request details
    SELECT * INTO job_req FROM job_requests WHERE id = p_job_request_id;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    positions_to_fill := job_req.positions_count - job_req.positions_filled;
    offer_expires := NOW() + INTERVAL '24 hours';
    
    -- Find eligible candidates in FIFO order
    FOR candidate_rec IN 
        SELECT c.* 
        FROM candidates c
        WHERE c.status = 'IN_QUEUE'
          AND c.entry_fee_paid = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM offers o 
              WHERE o.candidate_id = c.id 
              AND o.job_request_id = p_job_request_id
          )
        ORDER BY c.queue_position ASC
        LIMIT positions_to_fill
    LOOP
        -- Create offer
        INSERT INTO offers (
            job_request_id,
            candidate_id,
            queue_position_at_offer,
            expires_at
        ) VALUES (
            p_job_request_id,
            candidate_rec.id,
            candidate_rec.queue_position,
            offer_expires
        );
        
        -- Update candidate status
        UPDATE candidates 
        SET status = 'OFFER_PENDING'
        WHERE id = candidate_rec.id;
        
        matched_count := matched_count + 1;
    END LOOP;
    
    -- Update job request status
    IF matched_count > 0 THEN
        UPDATE job_requests 
        SET status = 'matching', auto_match_triggered = TRUE
        WHERE id = p_job_request_id;
    END IF;
    
    RETURN matched_count;
END;
$$ LANGUAGE plpgsql;

-- Function to shift offer to next candidate
CREATE OR REPLACE FUNCTION shift_offer_to_next(p_expired_offer_id UUID)
RETURNS UUID AS $$
DECLARE
    expired_offer RECORD;
    next_candidate RECORD;
    new_offer_id UUID;
    offer_expires TIMESTAMPTZ;
BEGIN
    -- Get expired offer details
    SELECT * INTO expired_offer FROM offers WHERE id = p_expired_offer_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Return original candidate to queue
    UPDATE candidates 
    SET status = 'IN_QUEUE'
    WHERE id = expired_offer.candidate_id;
    
    offer_expires := NOW() + INTERVAL '24 hours';
    
    -- Find next eligible candidate
    SELECT c.* INTO next_candidate
    FROM candidates c
    WHERE c.status = 'IN_QUEUE'
      AND c.entry_fee_paid = TRUE
      AND c.queue_position > expired_offer.queue_position_at_offer
      AND NOT EXISTS (
          SELECT 1 FROM offers o 
          WHERE o.candidate_id = c.id 
          AND o.job_request_id = expired_offer.job_request_id
      )
    ORDER BY c.queue_position ASC
    LIMIT 1;
    
    IF FOUND THEN
        -- Create new offer
        INSERT INTO offers (
            job_request_id,
            candidate_id,
            queue_position_at_offer,
            expires_at
        ) VALUES (
            expired_offer.job_request_id,
            next_candidate.id,
            next_candidate.queue_position,
            offer_expires
        )
        RETURNING id INTO new_offer_id;
        
        -- Update candidate status
        UPDATE candidates 
        SET status = 'OFFER_PENDING'
        WHERE id = next_candidate.id;
        
        RETURN new_offer_id;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- 8. TRIGGERS
-- ================================================================

-- Auto-update updated_at
CREATE TRIGGER update_job_requests_updated_at 
    BEFORE UPDATE ON job_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
