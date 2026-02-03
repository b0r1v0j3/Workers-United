-- ================================================================
-- WORKERS UNITED - DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. PROFILES TABLE (links to auth.users)
-- ================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    user_type TEXT NOT NULL CHECK (user_type IN ('candidate', 'employer', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 2. CANDIDATES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS candidates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    phone TEXT,
    country TEXT,
    preferred_job TEXT,
    experience_years INTEGER,
    cv_url TEXT,
    passport_url TEXT,
    status TEXT DEFAULT 'NEW' CHECK (status IN ('NEW', 'DOCS_REQUESTED', 'DOCS_RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 3. EMPLOYERS TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS employers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    company_name TEXT NOT NULL,
    company_website TEXT,
    country TEXT,
    industry TEXT,
    employees_count INTEGER,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 4. MATCHES TABLE
-- ================================================================
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id UUID REFERENCES candidates(id) ON DELETE CASCADE,
    employer_id UUID REFERENCES employers(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'HIRED')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- INDEXES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_profile ON candidates(profile_id);
CREATE INDEX IF NOT EXISTS idx_employers_status ON employers(status);
CREATE INDEX IF NOT EXISTS idx_employers_profile ON employers(profile_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_candidate ON matches(candidate_id);
CREATE INDEX IF NOT EXISTS idx_matches_employer ON matches(employer_id);

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE employers ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- Profiles Policies
-- ----------------------------------------------------------------
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (
        auth.uid() = id OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------
-- Candidates Policies
-- ----------------------------------------------------------------
CREATE POLICY "Candidates view own data" ON candidates
    FOR SELECT USING (
        profile_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin') OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'employer')
    );

CREATE POLICY "Candidates update own data" ON candidates
    FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "Candidates insert own data" ON candidates
    FOR INSERT WITH CHECK (profile_id = auth.uid());

-- ----------------------------------------------------------------
-- Employers Policies
-- ----------------------------------------------------------------
CREATE POLICY "Employers view own data" ON employers
    FOR SELECT USING (
        profile_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

CREATE POLICY "Employers update own data" ON employers
    FOR UPDATE USING (profile_id = auth.uid());

CREATE POLICY "Employers insert own data" ON employers
    FOR INSERT WITH CHECK (profile_id = auth.uid());

-- ----------------------------------------------------------------
-- Matches Policies
-- ----------------------------------------------------------------
CREATE POLICY "View own matches" ON matches
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

CREATE POLICY "Employers can create matches" ON matches
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

CREATE POLICY "Match participants can update" ON matches
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM candidates WHERE id = candidate_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM employers WHERE id = employer_id AND profile_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_type = 'admin')
    );

-- ================================================================
-- TRIGGER: Auto-create profile on user signup
-- ================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, user_type)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        COALESCE(NEW.raw_user_meta_data->>'user_type', 'candidate')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- TRIGGER: Auto-update updated_at timestamp
-- ================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_candidates_updated_at BEFORE UPDATE ON candidates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employers_updated_at BEFORE UPDATE ON employers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
