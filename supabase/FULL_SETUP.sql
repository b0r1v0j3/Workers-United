-- ================================================================
-- WORKERS UNITED - COMPLETE DATABASE SETUP
-- Run this ONCE in Supabase SQL Editor
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. PROFILES TABLE (links to auth.users)
-- ================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    user_type TEXT NOT NULL DEFAULT 'candidate' CHECK (user_type IN ('candidate', 'employer', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 2. CANDIDATES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    phone TEXT,
    country TEXT,
    preferred_job TEXT,
    experience_years INTEGER,
    cv_url TEXT,
    passport_url TEXT,
    -- Queue fields
    queue_position INTEGER,
    queue_joined_at TIMESTAMPTZ,
    entry_fee_paid BOOLEAN DEFAULT FALSE,
    entry_payment_id UUID,
    status TEXT DEFAULT 'NEW' CHECK (status IN (
        'NEW', 'DOCS_REQUESTED', 'DOCS_RECEIVED', 'UNDER_REVIEW', 
        'APPROVED', 'REJECTED', 'IN_QUEUE', 'OFFER_PENDING', 
        'VISA_PROCESS_STARTED', 'REFUND_FLAGGED'
    )),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 3. EMPLOYERS TABLE  
-- ================================================================
CREATE TABLE IF NOT EXISTS employers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    company_website TEXT,
    country TEXT,
    industry TEXT,
    employees_count INTEGER,
    -- Serbian business fields
    pib VARCHAR(8),
    accommodation_address TEXT,
    min_salary_rsd DECIMAL(10,2),
    company_address TEXT,
    contact_phone TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PIB format constraint
ALTER TABLE employers DROP CONSTRAINT IF EXISTS employers_pib_format;
ALTER TABLE employers ADD CONSTRAINT employers_pib_format 
    CHECK (pib IS NULL OR pib ~ '^\d{8}$');

-- ================================================================
-- 4. MATCHES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    employer_id UUID REFERENCES employers(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'HIRED')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 5. PAYMENTS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
    offer_id UUID,
    payment_type TEXT NOT NULL CHECK (payment_type IN ('entry_fee', 'confirmation_fee')),
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'flagged_for_refund')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 6. JOB REQUESTS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS job_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employer_id UUID REFERENCES employers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    destination_country TEXT DEFAULT 'Serbia',
    industry TEXT,
    positions_count INTEGER DEFAULT 1,
    positions_filled INTEGER DEFAULT 0,
    -- Serbian requirements
    accommodation_address TEXT,
    salary_rsd DECIMAL(10,2),
    work_schedule TEXT,
    contract_duration_months INTEGER DEFAULT 12,
    experience_required_years INTEGER DEFAULT 0,
    salary_min DECIMAL(10,2),
    salary_max DECIMAL(10,2),
    salary_currency TEXT DEFAULT 'EUR',
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'matching', 'filled', 'closed', 'cancelled')),
    auto_match_triggered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Salary constraint (minimum 60,000 RSD)
ALTER TABLE job_requests DROP CONSTRAINT IF EXISTS job_requests_min_salary;
ALTER TABLE job_requests ADD CONSTRAINT job_requests_min_salary 
    CHECK (salary_rsd IS NULL OR salary_rsd >= 60000);

-- ================================================================
-- 7. OFFERS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_request_id UUID REFERENCES job_requests(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    offered_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    accepted_at TIMESTAMPTZ,
    confirmation_payment_id UUID REFERENCES payments(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key from payments to offers
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_offer_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_offer_id_fkey 
    FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL;

-- ================================================================
-- 8. DOCUMENTS TABLE (AI Verification)
-- ================================================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL CHECK (
        document_type IN ('passport', 'cv', 'diploma', 'work_permit', 'other')
    ),
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_size_bytes INTEGER,
    mime_type TEXT,
    -- AI Verification
    verification_status TEXT DEFAULT 'pending' CHECK (
        verification_status IN ('pending', 'processing', 'verified', 'manual_review', 'rejected')
    ),
    ai_extracted_data JSONB DEFAULT '{}',
    ai_confidence_score DECIMAL(3,2),
    ai_notes TEXT,
    ai_processed_at TIMESTAMPTZ,
    name_matches BOOLEAN,
    data_discrepancies JSONB DEFAULT '{}',
    -- Manual review
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 9. CONTRACT DATA TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS contract_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    -- Candidate data
    candidate_full_name TEXT,
    candidate_passport_number TEXT,
    candidate_nationality TEXT,
    candidate_date_of_birth DATE,
    candidate_passport_expiry DATE,
    candidate_address TEXT,
    candidate_passport_issue_date DATE,
    candidate_passport_issuer TEXT,
    candidate_place_of_birth TEXT,
    candidate_gender TEXT,
    -- Employer data
    employer_company_name TEXT,
    employer_pib TEXT,
    employer_address TEXT,
    employer_representative_name TEXT,
    employer_mb TEXT,
    employer_director TEXT,
    employer_city TEXT,
    employer_founding_date TEXT,
    employer_apr_number TEXT,
    -- Job data
    job_title TEXT,
    job_description_sr TEXT,
    job_description_en TEXT,
    salary_rsd DECIMAL(10,2),
    accommodation_address TEXT,
    contract_duration_months INTEGER,
    work_schedule TEXT,
    start_date DATE,
    end_date DATE,
    signing_date DATE,
    contact_email TEXT,
    contact_phone TEXT,
    signing_city TEXT,
    -- Contract
    contract_template TEXT CHECK (contract_template IN ('01', '02', '03', '04', '05')),
    contract_pdf_url TEXT,
    generated_at TIMESTAMPTZ,
    generated_documents JSONB DEFAULT '{}',
    candidate_signed_at TIMESTAMPTZ,
    employer_signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_profile ON candidates(profile_id);
CREATE INDEX IF NOT EXISTS idx_candidates_queue ON candidates(queue_position);
CREATE INDEX IF NOT EXISTS idx_employers_status ON employers(status);
CREATE INDEX IF NOT EXISTS idx_employers_profile ON employers(profile_id);
CREATE INDEX IF NOT EXISTS idx_employers_pib ON employers(pib);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_job_requests_status ON job_requests(status);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_expires ON offers(expires_at);
CREATE INDEX IF NOT EXISTS idx_documents_candidate ON documents(candidate_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(verification_status);

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_data ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Candidates policies
DROP POLICY IF EXISTS "Candidates view own data" ON candidates;
CREATE POLICY "Candidates view own data" ON candidates
    FOR SELECT USING (
        profile_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'employer'))
    );

DROP POLICY IF EXISTS "Candidates update own data" ON candidates;
CREATE POLICY "Candidates update own data" ON candidates
    FOR UPDATE USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

DROP POLICY IF EXISTS "Candidates insert own data" ON candidates;
CREATE POLICY "Candidates insert own data" ON candidates
    FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Employers policies
DROP POLICY IF EXISTS "Employers view own data" ON employers;
CREATE POLICY "Employers view own data" ON employers
    FOR SELECT USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

DROP POLICY IF EXISTS "Employers update own data" ON employers;
CREATE POLICY "Employers update own data" ON employers
    FOR UPDATE USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Employers insert own data" ON employers;
CREATE POLICY "Employers insert own data" ON employers
    FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Matches policies
DROP POLICY IF EXISTS "View own matches" ON matches;
CREATE POLICY "View own matches" ON matches
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- Payments policies
DROP POLICY IF EXISTS "View own payments" ON payments;
CREATE POLICY "View own payments" ON payments
    FOR SELECT USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin'));

DROP POLICY IF EXISTS "Create own payments" ON payments;
CREATE POLICY "Create own payments" ON payments
    FOR INSERT WITH CHECK (profile_id = auth.uid());

-- Job requests policies
DROP POLICY IF EXISTS "Employers view own jobs" ON job_requests;
CREATE POLICY "Employers view own jobs" ON job_requests
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type IN ('admin', 'candidate'))
    );

DROP POLICY IF EXISTS "Employers create jobs" ON job_requests;
CREATE POLICY "Employers create jobs" ON job_requests
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = auth.uid())
    );

DROP POLICY IF EXISTS "Employers update own jobs" ON job_requests;
CREATE POLICY "Employers update own jobs" ON job_requests
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- Offers policies
DROP POLICY IF EXISTS "View own offers" ON offers;
CREATE POLICY "View own offers" ON offers
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM job_requests jr JOIN employers e ON jr.employer_id = e.id WHERE jr.id = job_request_id AND e.profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- Documents policies
DROP POLICY IF EXISTS "Candidates view own documents" ON documents;
CREATE POLICY "Candidates view own documents" ON documents
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

DROP POLICY IF EXISTS "Candidates upload own documents" ON documents;
CREATE POLICY "Candidates upload own documents" ON documents
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid())
    );

-- Contract data policies
DROP POLICY IF EXISTS "View own contract data" ON contract_data;
CREATE POLICY "View own contract data" ON contract_data
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM matches m JOIN candidates c ON m.candidate_id = c.id WHERE m.id = match_id AND c.profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM matches m JOIN employers e ON m.employer_id = e.id WHERE m.id = match_id AND e.profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- ================================================================
-- FUNCTIONS
-- ================================================================

-- Auto-create profile on signup
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
    
    -- Auto-create candidate or employer record
    IF COALESCE(NEW.raw_user_meta_data->>'user_type', 'candidate') = 'candidate' THEN
        INSERT INTO public.candidates (profile_id) VALUES (NEW.id);
    ELSIF NEW.raw_user_meta_data->>'user_type' = 'employer' THEN
        INSERT INTO public.employers (profile_id, company_name) 
        VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'));
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Get next queue position
CREATE OR REPLACE FUNCTION get_next_queue_position()
RETURNS INTEGER AS $$
DECLARE
    next_pos INTEGER;
BEGIN
    SELECT COALESCE(MAX(queue_position), 0) + 1 INTO next_pos FROM candidates WHERE entry_fee_paid = TRUE;
    RETURN next_pos;
END;
$$ LANGUAGE plpgsql;

-- Add candidate to queue
CREATE OR REPLACE FUNCTION add_candidate_to_queue(p_candidate_id UUID)
RETURNS INTEGER AS $$
DECLARE
    new_position INTEGER;
BEGIN
    new_position := get_next_queue_position();
    
    UPDATE candidates SET
        queue_position = new_position,
        queue_joined_at = NOW(),
        entry_fee_paid = TRUE,
        status = 'IN_QUEUE'
    WHERE id = p_candidate_id;
    
    RETURN new_position;
END;
$$ LANGUAGE plpgsql;

-- Auto-match candidates
CREATE OR REPLACE FUNCTION auto_match_candidates(p_job_request_id UUID)
RETURNS INTEGER AS $$
DECLARE
    positions_needed INTEGER;
    matched_count INTEGER := 0;
    candidate_record RECORD;
BEGIN
    SELECT positions_count - positions_filled INTO positions_needed
    FROM job_requests WHERE id = p_job_request_id;
    
    UPDATE job_requests SET status = 'matching', auto_match_triggered = TRUE
    WHERE id = p_job_request_id;
    
    FOR candidate_record IN
        SELECT id FROM candidates
        WHERE status = 'IN_QUEUE' AND entry_fee_paid = TRUE
        ORDER BY queue_position ASC
        LIMIT positions_needed
    LOOP
        INSERT INTO offers (job_request_id, candidate_id, status, expires_at)
        VALUES (p_job_request_id, candidate_record.id, 'pending', NOW() + INTERVAL '24 hours');
        
        UPDATE candidates SET status = 'OFFER_PENDING' WHERE id = candidate_record.id;
        matched_count := matched_count + 1;
    END LOOP;
    
    RETURN matched_count;
END;
$$ LANGUAGE plpgsql;

-- Shift offer to next candidate
CREATE OR REPLACE FUNCTION shift_offer_to_next(p_offer_id UUID)
RETURNS UUID AS $$
DECLARE
    job_id UUID;
    old_candidate_id UUID;
    next_candidate_id UUID;
    new_offer_id UUID;
BEGIN
    SELECT job_request_id, candidate_id INTO job_id, old_candidate_id
    FROM offers WHERE id = p_offer_id;
    
    UPDATE offers SET status = 'expired' WHERE id = p_offer_id;
    UPDATE candidates SET status = 'IN_QUEUE' WHERE id = old_candidate_id;
    
    SELECT id INTO next_candidate_id FROM candidates
    WHERE status = 'IN_QUEUE' AND entry_fee_paid = TRUE AND id != old_candidate_id
    ORDER BY queue_position ASC LIMIT 1;
    
    IF next_candidate_id IS NOT NULL THEN
        INSERT INTO offers (job_request_id, candidate_id, status, expires_at)
        VALUES (job_id, next_candidate_id, 'pending', NOW() + INTERVAL '24 hours')
        RETURNING id INTO new_offer_id;
        
        UPDATE candidates SET status = 'OFFER_PENDING' WHERE id = next_candidate_id;
    END IF;
    
    RETURN new_offer_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-match trigger on job creation
CREATE OR REPLACE FUNCTION trigger_auto_match_on_job_created()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'open' THEN
        PERFORM auto_match_candidates(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_job_request_created ON job_requests;
CREATE TRIGGER on_job_request_created
    AFTER INSERT ON job_requests
    FOR EACH ROW EXECUTE FUNCTION trigger_auto_match_on_job_created();

-- ================================================================
-- UPDATE TRIGGERS
-- ================================================================
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_candidates_updated_at ON candidates;
CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_employers_updated_at ON employers;
CREATE TRIGGER update_employers_updated_at BEFORE UPDATE ON employers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_matches_updated_at ON matches;
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_job_requests_updated_at ON job_requests;
CREATE TRIGGER update_job_requests_updated_at BEFORE UPDATE ON job_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_offers_updated_at ON offers;
CREATE TRIGGER update_offers_updated_at BEFORE UPDATE ON offers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contract_data_updated_at ON contract_data;
CREATE TRIGGER update_contract_data_updated_at BEFORE UPDATE ON contract_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- DONE! All tables created successfully.
-- ================================================================
