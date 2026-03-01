-- Performance indexes for frequently queried columns
-- Based on system audit — adds missing indexes for faster API responses

-- Offers
ALTER TABLE offers ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_candidate_id ON offers(candidate_id);
CREATE INDEX IF NOT EXISTS idx_offers_expires_at ON offers(expires_at);

-- Candidate documents
CREATE INDEX IF NOT EXISTS idx_candidate_docs_user_id ON candidate_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_candidate_docs_status ON candidate_documents(status);
CREATE INDEX IF NOT EXISTS idx_candidate_docs_type_status ON candidate_documents(document_type, status);

-- Email queue (columns: email_type, status, error_message, created_at)
CREATE INDEX IF NOT EXISTS idx_email_queue_user_id ON email_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_email_queue_type ON email_queue(email_type);
CREATE INDEX IF NOT EXISTS idx_email_queue_created ON email_queue(created_at DESC);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Candidates
CREATE INDEX IF NOT EXISTS idx_candidates_profile_id ON candidates(profile_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);

-- Matches
CREATE INDEX IF NOT EXISTS idx_matches_candidate_id ON matches(candidate_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

-- WhatsApp messages
CREATE INDEX IF NOT EXISTS idx_whatsapp_phone ON whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_created ON whatsapp_messages(created_at DESC);

-- Job requests
CREATE INDEX IF NOT EXISTS idx_job_requests_status ON job_requests(status);
