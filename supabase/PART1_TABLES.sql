-- ================================================================
-- PART 1: CREATE ALL TABLES (Run this FIRST)
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    user_type TEXT NOT NULL DEFAULT 'candidate' CHECK (user_type IN ('candidate', 'employer', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CANDIDATES TABLE
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    phone TEXT,
    country TEXT,
    preferred_job TEXT,
    experience_years INTEGER,
    cv_url TEXT,
    passport_url TEXT,
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

-- 3. EMPLOYERS TABLE  
CREATE TABLE IF NOT EXISTS employers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL DEFAULT 'My Company',
    company_website TEXT,
    country TEXT,
    industry TEXT,
    employees_count INTEGER,
    pib VARCHAR(8),
    accommodation_address TEXT,
    min_salary_rsd DECIMAL(10,2),
    company_address TEXT,
    contact_phone TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MATCHES TABLE
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    employer_id UUID REFERENCES employers(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'HIRED')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. PAYMENTS TABLE
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

-- 6. JOB REQUESTS TABLE
CREATE TABLE IF NOT EXISTS job_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employer_id UUID REFERENCES employers(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    destination_country TEXT DEFAULT 'Serbia',
    industry TEXT,
    positions_count INTEGER DEFAULT 1,
    positions_filled INTEGER DEFAULT 0,
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

-- 7. OFFERS TABLE
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

-- 8. DOCUMENTS TABLE
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
    verification_status TEXT DEFAULT 'pending' CHECK (
        verification_status IN ('pending', 'processing', 'verified', 'manual_review', 'rejected')
    ),
    ai_extracted_data JSONB DEFAULT '{}',
    ai_confidence_score DECIMAL(3,2),
    ai_notes TEXT,
    ai_processed_at TIMESTAMPTZ,
    name_matches BOOLEAN,
    data_discrepancies JSONB DEFAULT '{}',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. CONTRACT DATA TABLE
CREATE TABLE IF NOT EXISTS contract_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    candidate_full_name TEXT,
    candidate_passport_number TEXT,
    candidate_nationality TEXT,
    candidate_date_of_birth DATE,
    candidate_passport_expiry DATE,
    candidate_address TEXT,
    employer_company_name TEXT,
    employer_pib TEXT,
    employer_address TEXT,
    employer_representative_name TEXT,
    job_title TEXT,
    salary_rsd DECIMAL(10,2),
    accommodation_address TEXT,
    contract_duration_months INTEGER,
    work_schedule TEXT,
    start_date DATE,
    contract_template TEXT CHECK (contract_template IN ('01', '02', '03', '04', '05')),
    contract_pdf_url TEXT,
    generated_at TIMESTAMPTZ,
    candidate_signed_at TIMESTAMPTZ,
    employer_signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_profile ON candidates(profile_id);
CREATE INDEX IF NOT EXISTS idx_candidates_queue ON candidates(queue_position);
CREATE INDEX IF NOT EXISTS idx_employers_status ON employers(status);
CREATE INDEX IF NOT EXISTS idx_employers_profile ON employers(profile_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_job_requests_status ON job_requests(status);
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_documents_candidate ON documents(candidate_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(verification_status);

-- ================================================================
-- DONE! Tables created. Now run PART 2.
-- ================================================================
