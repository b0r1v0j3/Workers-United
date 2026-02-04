-- ============================================
-- FIX DOCUMENT UPLOAD - Workers United
-- ============================================
-- Run this SQL in Supabase SQL Editor to fix document uploads
-- This script ensures the correct schema and storage policies
-- ============================================

-- ============================================
-- STEP 1: Fix candidate_documents table schema
-- ============================================

-- Rename candidate_id to user_id if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'candidate_documents' AND column_name = 'candidate_id'
    ) THEN
        ALTER TABLE public.candidate_documents RENAME COLUMN candidate_id TO user_id;
    END IF;
END $$;

-- Add missing columns
ALTER TABLE public.candidate_documents 
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'uploaded',
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS reject_reason TEXT,
ADD COLUMN IF NOT EXISTS ocr_json JSONB;

-- Update document_type constraint to include biometric_photo
ALTER TABLE public.candidate_documents DROP CONSTRAINT IF EXISTS candidate_documents_document_type_check;
ALTER TABLE public.candidate_documents ADD CONSTRAINT candidate_documents_document_type_check 
CHECK (document_type IN ('passport', 'biometric_photo', 'photo', 'diploma', 'cv', 'other'));

-- Update status constraint
ALTER TABLE public.candidate_documents DROP CONSTRAINT IF EXISTS candidate_documents_status_check;
ALTER TABLE public.candidate_documents ADD CONSTRAINT candidate_documents_status_check
CHECK (status IN ('missing', 'uploaded', 'verifying', 'verified', 'rejected', 'manual_review', 'error'));

-- ============================================
-- STEP 2: Fix RLS policies for candidate_documents
-- ============================================

-- Drop old policies that might reference candidate_id
DROP POLICY IF EXISTS "Candidates can view own documents" ON public.candidate_documents;
DROP POLICY IF EXISTS "Candidates can insert own documents" ON public.candidate_documents;
DROP POLICY IF EXISTS "Candidates can update own documents" ON public.candidate_documents;
DROP POLICY IF EXISTS "Candidates can delete own documents" ON public.candidate_documents;
DROP POLICY IF EXISTS "Candidates can only see own docs" ON public.candidate_documents;
DROP POLICY IF EXISTS "Admins can view all documents" ON public.candidate_documents;
DROP POLICY IF EXISTS "Admins can manage all documents" ON public.candidate_documents;
DROP POLICY IF EXISTS "Admins see everything docs" ON public.candidate_documents;

-- Enable RLS
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;

-- Create new policies with user_id
CREATE POLICY "Candidates can view own documents" ON public.candidate_documents
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Candidates can insert own documents" ON public.candidate_documents
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Candidates can update own documents" ON public.candidate_documents
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Candidates can delete own documents" ON public.candidate_documents
FOR DELETE USING (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admins can manage all documents" ON public.candidate_documents
FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- STEP 3: Storage bucket policies
-- ============================================
-- NOTE: First create the bucket in Supabase Dashboard if it doesn't exist:
-- 1. Go to Storage
-- 2. Click "New bucket"
-- 3. Name: candidate-docs
-- 4. Check "Public bucket" (required for GPT-4o Vision to access images)
-- 5. Click "Create bucket"

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for verification" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to candidate-docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update candidate-docs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete candidate-docs" ON storage.objects;
DROP POLICY IF EXISTS "Public can read candidate-docs" ON storage.objects;

-- Simple policies that work reliably
CREATE POLICY "Allow authenticated uploads to candidate-docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'candidate-docs');

CREATE POLICY "Allow authenticated updates to candidate-docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'candidate-docs');

CREATE POLICY "Allow authenticated deletes from candidate-docs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'candidate-docs');

-- CRITICAL: Public read access is required for GPT-4o Vision to analyze images
CREATE POLICY "Allow public read from candidate-docs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'candidate-docs');

-- ============================================
-- STEP 4: Grant necessary permissions
-- ============================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA storage TO authenticated;

-- Grant table permissions
GRANT ALL ON public.candidate_documents TO authenticated;
GRANT SELECT ON public.candidate_documents TO anon;

-- ============================================
-- VERIFICATION: Check that everything is correct
-- ============================================

-- Check columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'candidate_documents'
ORDER BY ordinal_position;

-- Check constraints
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name LIKE '%candidate_documents%';

-- Success message
SELECT 'SETUP COMPLETE! Now create the storage bucket if not exists.' as message;
