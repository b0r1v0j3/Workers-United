-- PART 2 FIX: First ensure user_type column exists, then create policies
-- Run this in Supabase SQL Editor

-- Step 1: Add user_type column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'user_type') THEN
        ALTER TABLE public.profiles ADD COLUMN user_type TEXT NOT NULL DEFAULT 'candidate';
    END IF;
END $$;

-- Step 2: Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_data ENABLE ROW LEVEL SECURITY;

-- Step 3: Simple policies (no user_type checks to avoid errors)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "candidates_select" ON candidates;
CREATE POLICY "candidates_select" ON candidates FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "candidates_update" ON candidates;
CREATE POLICY "candidates_update" ON candidates FOR UPDATE USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "candidates_insert" ON candidates;
CREATE POLICY "candidates_insert" ON candidates FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "employers_select" ON employers;
CREATE POLICY "employers_select" ON employers FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "employers_update" ON employers;
CREATE POLICY "employers_update" ON employers FOR UPDATE USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "employers_insert" ON employers;
CREATE POLICY "employers_insert" ON employers FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "matches_select" ON matches;
CREATE POLICY "matches_select" ON matches FOR SELECT USING (
    EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = auth.uid())
);

DROP POLICY IF EXISTS "payments_select" ON payments;
CREATE POLICY "payments_select" ON payments FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "payments_insert" ON payments;
CREATE POLICY "payments_insert" ON payments FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "job_requests_select" ON job_requests;
CREATE POLICY "job_requests_select" ON job_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "job_requests_insert" ON job_requests;
CREATE POLICY "job_requests_insert" ON job_requests FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = auth.uid())
);

DROP POLICY IF EXISTS "offers_select" ON offers;
CREATE POLICY "offers_select" ON offers FOR SELECT USING (
    EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid())
);

DROP POLICY IF EXISTS "documents_select" ON documents;
CREATE POLICY "documents_select" ON documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid())
);

DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid())
);

DROP POLICY IF EXISTS "contract_data_select" ON contract_data;
CREATE POLICY "contract_data_select" ON contract_data FOR SELECT USING (true);

-- Step 4: Functions
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_next_queue_position() RETURNS INTEGER AS $$
BEGIN RETURN (SELECT COALESCE(MAX(queue_position), 0) + 1 FROM candidates WHERE entry_fee_paid = TRUE); END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION add_candidate_to_queue(p_candidate_id UUID) RETURNS INTEGER AS $$
DECLARE new_pos INTEGER;
BEGIN
    new_pos := get_next_queue_position();
    UPDATE candidates SET queue_position = new_pos, queue_joined_at = NOW(), entry_fee_paid = TRUE, status = 'IN_QUEUE' WHERE id = p_candidate_id;
    RETURN new_pos;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_match_candidates(p_job_request_id UUID) RETURNS INTEGER AS $$
DECLARE positions_needed INTEGER; matched_count INTEGER := 0; candidate_record RECORD;
BEGIN
    SELECT positions_count - positions_filled INTO positions_needed FROM job_requests WHERE id = p_job_request_id;
    UPDATE job_requests SET status = 'matching', auto_match_triggered = TRUE WHERE id = p_job_request_id;
    FOR candidate_record IN SELECT id FROM candidates WHERE status = 'IN_QUEUE' AND entry_fee_paid = TRUE ORDER BY queue_position ASC LIMIT positions_needed
    LOOP
        INSERT INTO offers (job_request_id, candidate_id, status, expires_at) VALUES (p_job_request_id, candidate_record.id, 'pending', NOW() + INTERVAL '24 hours');
        UPDATE candidates SET status = 'OFFER_PENDING' WHERE id = candidate_record.id;
        matched_count := matched_count + 1;
    END LOOP;
    RETURN matched_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_auto_match_on_job_created() RETURNS TRIGGER AS $$
BEGIN IF NEW.status = 'open' THEN PERFORM auto_match_candidates(NEW.id); END IF; RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_job_request_created ON job_requests;
CREATE TRIGGER on_job_request_created AFTER INSERT ON job_requests FOR EACH ROW EXECUTE FUNCTION trigger_auto_match_on_job_created();

-- DONE!
