-- Document Requirements Table for Automated Document Collection
-- Run this in Vercel Postgres SQL editor

CREATE TABLE IF NOT EXISTS document_requirements (
    id SERIAL PRIMARY KEY,
    candidate_id INTEGER REFERENCES candidates(id) ON DELETE CASCADE,
    
    -- Progress tracking
    last_step INTEGER DEFAULT 1,
    personal_info JSONB DEFAULT '{}',
    
    -- Document verification status
    passport_verified BOOLEAN DEFAULT FALSE,
    passport_data JSONB DEFAULT '{}',
    
    photo_verified BOOLEAN DEFAULT FALSE,
    photo_data JSONB DEFAULT '{}',
    
    diploma_verified BOOLEAN DEFAULT FALSE,
    diploma_data JSONB DEFAULT '{}',
    
    -- Optional documents
    police_clearance_uploaded BOOLEAN DEFAULT FALSE,
    medical_uploaded BOOLEAN DEFAULT FALSE,
    address_proof_uploaded BOOLEAN DEFAULT FALSE,
    
    -- Completion status
    all_completed BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one record per candidate
    UNIQUE(candidate_id)
);

-- Add verification_data column to documents table if not exists
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS verification_data JSONB DEFAULT '{}';

-- Add unique constraint for candidate_id + type
-- This allows upsert behavior
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'documents_candidate_type_unique'
    ) THEN
        ALTER TABLE documents ADD CONSTRAINT documents_candidate_type_unique UNIQUE (candidate_id, type);
    END IF;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_document_requirements_candidate ON document_requirements(candidate_id);
CREATE INDEX IF NOT EXISTS idx_documents_candidate ON documents(candidate_id);
