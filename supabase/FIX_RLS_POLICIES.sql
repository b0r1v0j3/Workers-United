-- ================================================================
-- FIX RLS POLICIES FOR PROFILES AND CANDIDATES TABLES
-- Run this in Supabase SQL Editor
-- ================================================================

-- Enable RLS on profiles (should already be enabled, but just in case)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Allow users to SELECT their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

-- Allow users to UPDATE their own profile
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Allow users to INSERT their own profile (CRITICAL - this was missing!)
CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ================================================================
-- SAME FOR CANDIDATES TABLE
-- ================================================================

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own candidate" ON candidates;
DROP POLICY IF EXISTS "Users can update own candidate" ON candidates;
DROP POLICY IF EXISTS "Users can insert own candidate" ON candidates;

-- Allow users to SELECT their own candidate record
CREATE POLICY "Users can view own candidate" ON candidates
    FOR SELECT USING (auth.uid() = profile_id);

-- Allow users to UPDATE their own candidate record
CREATE POLICY "Users can update own candidate" ON candidates
    FOR UPDATE USING (auth.uid() = profile_id);

-- Allow users to INSERT their own candidate record (CRITICAL!)
CREATE POLICY "Users can insert own candidate" ON candidates
    FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- ================================================================
-- VERIFY POLICIES ARE CREATED
-- ================================================================
-- Run this to verify:
-- SELECT * FROM pg_policies WHERE tablename IN ('profiles', 'candidates');
