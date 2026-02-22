-- Migration: Extend contract_data table for full document generation
-- Adds columns needed for UGOVOR, IZJAVA, OVLAŠĆENJE, POZIVNO PISMO

ALTER TABLE contract_data 
  ADD COLUMN IF NOT EXISTS candidate_passport_issue_date DATE,
  ADD COLUMN IF NOT EXISTS candidate_passport_issuer TEXT,
  ADD COLUMN IF NOT EXISTS candidate_place_of_birth TEXT,
  ADD COLUMN IF NOT EXISTS candidate_gender TEXT,
  ADD COLUMN IF NOT EXISTS employer_mb TEXT,
  ADD COLUMN IF NOT EXISTS employer_director TEXT,
  ADD COLUMN IF NOT EXISTS job_description_sr TEXT,
  ADD COLUMN IF NOT EXISTS job_description_en TEXT,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS signing_date DATE,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS employer_city TEXT,
  ADD COLUMN IF NOT EXISTS signing_city TEXT,
  ADD COLUMN IF NOT EXISTS employer_founding_date TEXT,
  ADD COLUMN IF NOT EXISTS employer_apr_number TEXT,
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generated_documents JSONB DEFAULT '{}';
