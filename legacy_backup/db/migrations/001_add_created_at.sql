-- Migration: Add created_at to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Drop old column if exists
ALTER TABLE documents DROP COLUMN IF EXISTS uploaded_at;
