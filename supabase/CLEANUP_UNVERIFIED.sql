-- =============================================
-- CLEANUP: Delete all unverified documents
-- Run this ONCE in Supabase SQL Editor
-- =============================================

-- Step 1: Preview what will be deleted (run this first!)
SELECT 
    id, 
    user_id, 
    document_type, 
    status, 
    storage_path,
    created_at
FROM candidate_documents
WHERE status != 'verified'
ORDER BY created_at DESC;

-- Step 2: Delete unverified documents from database
-- Uncomment and run after reviewing Step 1
/*
DELETE FROM candidate_documents
WHERE status != 'verified';
*/

-- Step 3: Verify only verified documents remain
-- SELECT * FROM candidate_documents ORDER BY user_id, document_type;
