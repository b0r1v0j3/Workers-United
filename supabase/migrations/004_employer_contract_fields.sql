-- Add employer fields needed for contract document automation
-- These fields were previously filled manually by admin in contract_data
ALTER TABLE employers ADD COLUMN IF NOT EXISTS postal_code TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS business_registry_number TEXT;
ALTER TABLE employers ADD COLUMN IF NOT EXISTS founding_date TEXT;
