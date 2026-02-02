-- ================================================================
-- WORKERS UNITED - EMPLOYER PORTAL & AI DOCUMENT ENGINE SCHEMA
-- Run this AFTER queue-schema.sql
-- ================================================================

-- ================================================================
-- 1. UPDATE EMPLOYERS TABLE - Serbian Business Requirements
-- ================================================================
ALTER TABLE employers 
ADD COLUMN IF NOT EXISTS pib VARCHAR(8),                    -- Serbian Tax ID (8 digits)
ADD COLUMN IF NOT EXISTS accommodation_address TEXT,        -- Required for visa process
ADD COLUMN IF NOT EXISTS min_salary_rsd DECIMAL(10,2),      -- Minimum salary offering
ADD COLUMN IF NOT EXISTS company_address TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT;

-- Add constraint for PIB format (8 digits)
ALTER TABLE employers DROP CONSTRAINT IF EXISTS employers_pib_format;
ALTER TABLE employers ADD CONSTRAINT employers_pib_format 
    CHECK (pib IS NULL OR pib ~ '^\d{8}$');

-- ================================================================
-- 2. UPDATE JOB_REQUESTS TABLE - Additional Fields
-- ================================================================
ALTER TABLE job_requests 
ADD COLUMN IF NOT EXISTS accommodation_address TEXT,
ADD COLUMN IF NOT EXISTS salary_rsd DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS work_schedule TEXT,
ADD COLUMN IF NOT EXISTS contract_duration_months INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS language_requirements TEXT[],
ADD COLUMN IF NOT EXISTS experience_required_years INTEGER DEFAULT 0;

-- Salary constraint (minimum 60,000 RSD)
ALTER TABLE job_requests DROP CONSTRAINT IF EXISTS job_requests_min_salary;
ALTER TABLE job_requests ADD CONSTRAINT job_requests_min_salary 
    CHECK (salary_rsd IS NULL OR salary_rsd >= 60000);

-- ================================================================
-- 3. DOCUMENTS TABLE - AI Verification
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
    
    -- AI Verification Fields
    verification_status TEXT DEFAULT 'pending' CHECK (
        verification_status IN ('pending', 'processing', 'verified', 'manual_review', 'rejected')
    ),
    ai_extracted_data JSONB DEFAULT '{}',
    -- For passport: { full_name, passport_number, nationality, date_of_birth, expiry_date }
    ai_confidence_score DECIMAL(3,2),  -- 0.00 to 1.00
    ai_notes TEXT,
    ai_processed_at TIMESTAMPTZ,
    
    -- Comparison with signup data
    name_matches BOOLEAN,
    data_discrepancies JSONB DEFAULT '{}',
    
    -- Manual Review
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 4. CONTRACT DATA TABLE - For PDF Generation
-- ================================================================
CREATE TABLE IF NOT EXISTS contract_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    
    -- Candidate Data (AI-verified from passport)
    candidate_full_name TEXT,
    candidate_passport_number TEXT,
    candidate_nationality TEXT,
    candidate_date_of_birth DATE,
    candidate_passport_expiry DATE,
    candidate_address TEXT,
    
    -- Employer Data
    employer_company_name TEXT,
    employer_pib TEXT,
    employer_address TEXT,
    employer_representative_name TEXT,
    
    -- Job Data
    job_title TEXT,
    salary_rsd DECIMAL(10,2),
    accommodation_address TEXT,
    contract_duration_months INTEGER,
    work_schedule TEXT,
    start_date DATE,
    
    -- Contract Generation
    contract_template TEXT CHECK (contract_template IN ('01', '02', '03', '04', '05')),
    contract_pdf_url TEXT,
    generated_at TIMESTAMPTZ,
    
    -- Signatures
    candidate_signed_at TIMESTAMPTZ,
    employer_signed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 5. INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_documents_candidate ON documents(candidate_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(verification_status);
CREATE INDEX IF NOT EXISTS idx_contract_data_match ON contract_data(match_id);
CREATE INDEX IF NOT EXISTS idx_employers_pib ON employers(pib);

-- ================================================================
-- 6. ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_data ENABLE ROW LEVEL SECURITY;

-- Documents: candidates see own, admin sees all
CREATE POLICY "Candidates view own documents" ON documents
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

CREATE POLICY "Candidates upload own documents" ON documents
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid())
    );

-- Contract data: involved parties see own, admin sees all
CREATE POLICY "View own contract data" ON contract_data
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM matches m
            JOIN candidates c ON m.candidate_id = c.id
            WHERE m.id = match_id AND c.profile_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM matches m
            JOIN employers e ON m.employer_id = e.id
            WHERE m.id = match_id AND e.profile_id = auth.uid()
        ) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- ================================================================
-- 7. AUTO-MATCHING TRIGGER
-- When job_request is created, automatically match candidates
-- ================================================================
CREATE OR REPLACE FUNCTION trigger_auto_match_on_job_created()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger for new jobs with status 'open'
    IF NEW.status = 'open' THEN
        -- Execute auto-matching
        PERFORM auto_match_candidates(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any and create new
DROP TRIGGER IF EXISTS on_job_request_created ON job_requests;
CREATE TRIGGER on_job_request_created
    AFTER INSERT ON job_requests
    FOR EACH ROW
    EXECUTE FUNCTION trigger_auto_match_on_job_created();

-- ================================================================
-- 8. UPDATE TRIGGERS
-- ================================================================
CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contract_data_updated_at 
    BEFORE UPDATE ON contract_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- 9. HELPER FUNCTION: Check if all candidate documents are verified
-- ================================================================
CREATE OR REPLACE FUNCTION check_candidate_documents_verified(p_candidate_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    passport_verified BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM documents 
        WHERE candidate_id = p_candidate_id 
        AND document_type = 'passport'
        AND verification_status = 'verified'
    ) INTO passport_verified;
    
    RETURN passport_verified;
END;
$$ LANGUAGE plpgsql;
