-- SIMPLE POLICIES ONLY - Run this in a NEW SQL Editor tab
-- Your tables already exist, this just enables security

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
