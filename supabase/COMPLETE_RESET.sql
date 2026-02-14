-- COMPLETE RESET - Drops everything and recreates from scratch
-- Run this in a NEW SQL Editor tab

-- Step 1: Drop all policies first
DROP POLICY IF EXISTS "allow_all_profiles" ON profiles;
DROP POLICY IF EXISTS "allow_all_candidates" ON candidates;
DROP POLICY IF EXISTS "allow_all_employers" ON employers;
DROP POLICY IF EXISTS "allow_all_matches" ON matches;
DROP POLICY IF EXISTS "allow_all_payments" ON payments;
DROP POLICY IF EXISTS "allow_all_job_requests" ON job_requests;
DROP POLICY IF EXISTS "allow_all_offers" ON offers;
DROP POLICY IF EXISTS "allow_all_documents" ON documents;
DROP POLICY IF EXISTS "allow_all_contract_data" ON contract_data;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "candidates_select" ON candidates;
DROP POLICY IF EXISTS "candidates_update" ON candidates;
DROP POLICY IF EXISTS "candidates_insert" ON candidates;
DROP POLICY IF EXISTS "employers_select" ON employers;
DROP POLICY IF EXISTS "employers_update" ON employers;
DROP POLICY IF EXISTS "employers_insert" ON employers;
DROP POLICY IF EXISTS "matches_select" ON matches;
DROP POLICY IF EXISTS "payments_select" ON payments;
DROP POLICY IF EXISTS "payments_insert" ON payments;
DROP POLICY IF EXISTS "job_requests_select" ON job_requests;
DROP POLICY IF EXISTS "job_requests_insert" ON job_requests;
DROP POLICY IF EXISTS "offers_select" ON offers;
DROP POLICY IF EXISTS "documents_select" ON documents;
DROP POLICY IF EXISTS "documents_insert" ON documents;
DROP POLICY IF EXISTS "contract_data_select" ON contract_data;

-- Step 2: Drop all triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_job_request_created ON job_requests;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_candidates_updated_at ON candidates;
DROP TRIGGER IF EXISTS update_employers_updated_at ON employers;
DROP TRIGGER IF EXISTS update_matches_updated_at ON matches;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS update_job_requests_updated_at ON job_requests;
DROP TRIGGER IF EXISTS update_offers_updated_at ON offers;
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
DROP TRIGGER IF EXISTS update_contract_data_updated_at ON contract_data;

-- Step 3: Drop all tables (in reverse order of dependencies)
DROP TABLE IF EXISTS contract_data CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS offers CASCADE;
DROP TABLE IF EXISTS job_requests CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS matches CASCADE;
DROP TABLE IF EXISTS employers CASCADE;
DROP TABLE IF EXISTS candidates CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Step 4: Drop all functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS get_next_queue_position() CASCADE;
DROP FUNCTION IF EXISTS add_candidate_to_queue(UUID) CASCADE;
DROP FUNCTION IF EXISTS auto_match_candidates(UUID) CASCADE;
DROP FUNCTION IF EXISTS trigger_auto_match_on_job_created() CASCADE;

-- Step 5: Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 6: Create all tables
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    user_type TEXT NOT NULL DEFAULT 'candidate',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE candidates (
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
    status TEXT DEFAULT 'NEW',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employers (
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
    status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    employer_id UUID REFERENCES employers(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    candidate_id UUID REFERENCES candidates(id) ON DELETE SET NULL,
    offer_id UUID,
    payment_type TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'USD',
    stripe_session_id TEXT,
    stripe_payment_intent_id TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE job_requests (
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
    status TEXT DEFAULT 'open',
    auto_match_triggered BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_request_id UUID REFERENCES job_requests(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    offered_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
    accepted_at TIMESTAMPTZ,
    confirmation_payment_id UUID REFERENCES payments(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_size_bytes INTEGER,
    mime_type TEXT,
    verification_status TEXT DEFAULT 'pending',
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

CREATE TABLE contract_data (
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
    employer_city TEXT,
    employer_director TEXT,
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
    -- Dates
    start_date DATE,
    end_date DATE,
    signing_date DATE,
    signing_city TEXT,
    -- Contact
    contact_email TEXT,
    contact_phone TEXT,
    -- Generated docs
    contract_template TEXT,
    contract_pdf_url TEXT,
    generated_at TIMESTAMPTZ,
    generated_documents JSONB DEFAULT '{}',
    candidate_signed_at TIMESTAMPTZ,
    employer_signed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 7: Enable RLS and create simple policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_profiles" ON profiles FOR ALL USING (true);
CREATE POLICY "allow_all_candidates" ON candidates FOR ALL USING (true);
CREATE POLICY "allow_all_employers" ON employers FOR ALL USING (true);
CREATE POLICY "allow_all_matches" ON matches FOR ALL USING (true);
CREATE POLICY "allow_all_payments" ON payments FOR ALL USING (true);
CREATE POLICY "allow_all_job_requests" ON job_requests FOR ALL USING (true);
CREATE POLICY "allow_all_offers" ON offers FOR ALL USING (true);
CREATE POLICY "allow_all_documents" ON documents FOR ALL USING (true);
CREATE POLICY "allow_all_contract_data" ON contract_data FOR ALL USING (true);

-- Step 8: Create signup function
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, user_type)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'user_type', 'candidate'));
    IF COALESCE(NEW.raw_user_meta_data->>'user_type', 'candidate') = 'candidate' THEN
        INSERT INTO public.candidates (profile_id) VALUES (NEW.id);
    ELSIF NEW.raw_user_meta_data->>'user_type' = 'employer' THEN
        INSERT INTO public.employers (profile_id, company_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'company_name', 'My Company'));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DONE! All tables, policies, and functions created.
