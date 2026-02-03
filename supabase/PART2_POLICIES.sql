-- ================================================================
-- PART 2: POLICIES & FUNCTIONS (Run this AFTER Part 1)
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_data ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- PROFILES POLICIES
-- ================================================================
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (
    auth.uid() = id OR 
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin')
);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ================================================================
-- CANDIDATES POLICIES
-- ================================================================
DROP POLICY IF EXISTS "candidates_select" ON candidates;
CREATE POLICY "candidates_select" ON candidates FOR SELECT USING (
    profile_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type IN ('admin', 'employer'))
);

DROP POLICY IF EXISTS "candidates_update" ON candidates;
CREATE POLICY "candidates_update" ON candidates FOR UPDATE USING (
    profile_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin')
);

DROP POLICY IF EXISTS "candidates_insert" ON candidates;
CREATE POLICY "candidates_insert" ON candidates FOR INSERT WITH CHECK (profile_id = auth.uid());

-- ================================================================
-- EMPLOYERS POLICIES
-- ================================================================
DROP POLICY IF EXISTS "employers_select" ON employers;
CREATE POLICY "employers_select" ON employers FOR SELECT USING (
    profile_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin')
);

DROP POLICY IF EXISTS "employers_update" ON employers;
CREATE POLICY "employers_update" ON employers FOR UPDATE USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "employers_insert" ON employers;
CREATE POLICY "employers_insert" ON employers FOR INSERT WITH CHECK (profile_id = auth.uid());

-- ================================================================
-- MATCHES POLICIES
-- ================================================================
DROP POLICY IF EXISTS "matches_select" ON matches;
CREATE POLICY "matches_select" ON matches FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id AND c.profile_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.employers e WHERE e.id = employer_id AND e.profile_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin')
);

-- ================================================================
-- PAYMENTS POLICIES
-- ================================================================
DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments FOR SELECT USING (
    profile_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin')
);

DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments FOR INSERT WITH CHECK (profile_id = auth.uid());

-- ================================================================
-- JOB REQUESTS POLICIES
-- ================================================================
DROP POLICY IF EXISTS "job_requests_select" ON job_requests;
CREATE POLICY "job_requests_select" ON job_requests FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.employers e WHERE e.id = employer_id AND e.profile_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type IN ('admin', 'candidate'))
);

DROP POLICY IF EXISTS "job_requests_insert" ON job_requests;
CREATE POLICY "job_requests_insert" ON job_requests FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.employers e WHERE e.id = employer_id AND e.profile_id = auth.uid())
);

-- ================================================================
-- OFFERS POLICIES
-- ================================================================
DROP POLICY IF EXISTS "offers_select" ON offers;
CREATE POLICY "offers_select" ON offers FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id AND c.profile_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin')
);

-- ================================================================
-- DOCUMENTS POLICIES
-- ================================================================
DROP POLICY IF EXISTS "documents_select" ON documents;
CREATE POLICY "documents_select" ON documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id AND c.profile_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin')
);

DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.candidates c WHERE c.id = candidate_id AND c.profile_id = auth.uid())
);

-- ================================================================
-- CONTRACT DATA POLICIES
-- ================================================================
DROP POLICY IF EXISTS "contract_data_select" ON contract_data;
CREATE POLICY "contract_data_select" ON contract_data FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin')
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

-- Update timestamp function
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

-- Auto-match trigger
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

-- Update triggers
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
-- DONE! All policies and functions created.
-- ================================================================
