-- ============================================
-- Storage Setup for Document Uploads
-- ============================================
-- Run this in Supabase SQL Editor to set up storage
-- for the DocumentWizard component
-- ============================================

-- First, make sure the candidate-docs bucket exists
-- NOTE: Bucket creation is done via Supabase Dashboard or CLI
-- Go to: Storage > New bucket > Name: "candidate-docs" > Make it PUBLIC

-- ============================================
-- Storage Policies for candidate-docs bucket
-- ============================================

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'candidate-docs' AND
    (auth.uid()::text = (storage.foldername(name))[1] OR 
     EXISTS (
        SELECT 1 FROM candidates 
        WHERE id = (storage.foldername(name))[1]::uuid 
        AND profile_id = auth.uid()
     ))
);

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update their own documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'candidate-docs' AND
    (auth.uid()::text = (storage.foldername(name))[1] OR
     EXISTS (
        SELECT 1 FROM candidates 
        WHERE id = (storage.foldername(name))[1]::uuid 
        AND profile_id = auth.uid()
     ))
);

-- Allow authenticated users to delete their own files  
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'candidate-docs' AND
    (auth.uid()::text = (storage.foldername(name))[1] OR
     EXISTS (
        SELECT 1 FROM candidates 
        WHERE id = (storage.foldername(name))[1]::uuid 
        AND profile_id = auth.uid()
     ))
);

-- IMPORTANT: Allow public read access for AI verification
-- GPT-4o Vision needs to access the images via public URL
CREATE POLICY "Public read access for verification"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'candidate-docs');

-- ============================================
-- Alternative: If above policies fail, use these simpler ones
-- (Drop the above first if they exist)
-- ============================================

/*
-- Simple authenticated upload
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload to candidate-docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'candidate-docs');

-- Simple authenticated update
DROP POLICY IF EXISTS "Users can update their own documents" ON storage.objects;
CREATE POLICY "Authenticated users can update candidate-docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'candidate-docs');

-- Simple authenticated delete
DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete candidate-docs"  
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'candidate-docs');

-- Public read (required for GPT-4o Vision)
DROP POLICY IF EXISTS "Public read access for verification" ON storage.objects;
CREATE POLICY "Public can read candidate-docs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'candidate-docs');
*/
