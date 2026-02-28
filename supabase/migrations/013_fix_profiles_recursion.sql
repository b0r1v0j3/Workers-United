-- ============================================================
-- MIGRATION 013: Fix infinite recursion in profiles RLS policy
-- 
-- PROBLEM: The "Users can view own profile" policy on `profiles`
-- does EXISTS (SELECT 1 FROM profiles WHERE ...) to check admin.
-- This triggers the same SELECT policy → infinite recursion.
--
-- FIX: Remove the self-referencing admin check from the profiles
-- SELECT policy. Instead, use auth.jwt() to check user_type
-- from user metadata, or simply allow all authenticated users
-- to read their own profile row (which is the only safe pattern).
--
-- For admin access to ALL profiles, we use a separate policy
-- with the service_role or check user_type from auth.jwt().
-- ============================================================

-- ================================================================
-- 1. FIX PROFILES — remove self-referencing admin check
-- ================================================================
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Users can always view their OWN profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (
        (select auth.uid()) = id
    );

-- Admins can view ALL profiles (separate policy, no self-reference)
-- Uses a security definer function to avoid recursion
DROP FUNCTION IF EXISTS public.is_admin();
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND user_type = 'admin'
    );
$$;

DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles" ON profiles
    FOR SELECT USING (
        public.is_admin()
    );

-- ================================================================
-- 2. FIX ALL OTHER POLICIES that reference profiles from non-profiles tables
-- These are safe (no recursion) but let's also use the function for consistency
-- ================================================================

-- CANDIDATES
DROP POLICY IF EXISTS "Candidates view own data" ON candidates;
CREATE POLICY "Candidates view own data" ON candidates
    FOR SELECT USING (
        profile_id = (select auth.uid()) 
        OR public.is_admin()
        OR EXISTS (SELECT 1 FROM profiles WHERE id = (select auth.uid()) AND user_type = 'employer')
    );

DROP POLICY IF EXISTS "Candidates update own data" ON candidates;
CREATE POLICY "Candidates update own data" ON candidates
    FOR UPDATE USING (
        profile_id = (select auth.uid()) 
        OR public.is_admin()
    );

-- EMPLOYERS
DROP POLICY IF EXISTS "Employers view own data" ON employers;
CREATE POLICY "Employers view own data" ON employers
    FOR SELECT USING (
        profile_id = (select auth.uid()) 
        OR public.is_admin()
    );
