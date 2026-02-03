-- Core Schema Migration for Workers United
-- Target: Supabase / PostgreSQL

-- 1. Profiles Table (Linked to Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    role TEXT DEFAULT 'candidate' CHECK (role IN ('candidate', 'employer', 'admin')),
    user_type TEXT DEFAULT 'candidate' CHECK (user_type IN ('candidate', 'employer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Candidate Documents Table
CREATE TABLE IF NOT EXISTS public.candidate_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    document_type TEXT NOT NULL CHECK (document_type IN ('passport', 'photo', 'diploma', 'cv', 'other')),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'manual_review')),
    ai_confidence_score FLOAT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(candidate_id, document_type)
);

-- 3. Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    stripe_payment_intent_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Views
-- Candidate Readiness View (Checks if all 3 mandatory docs are verified)
CREATE OR REPLACE VIEW public.candidate_readiness AS
SELECT 
    p.id as user_id,
    p.full_name,
    p.email,
    COUNT(cd.id) FILTER (WHERE cd.verification_status = 'verified' AND cd.document_type IN ('passport', 'photo', 'diploma')) as verified_docs_count,
    CASE 
        WHEN COUNT(cd.id) FILTER (WHERE cd.verification_status = 'verified' AND cd.document_type IN ('passport', 'photo', 'diploma')) >= 3 THEN true
        ELSE false
    END as is_ready
FROM public.profiles p
LEFT JOIN public.candidate_documents cd ON p.id = cd.candidate_id
WHERE p.role = 'candidate'
GROUP BY p.id, p.full_name, p.email;

-- Admin Payment Countdown View
CREATE OR REPLACE VIEW public.admin_payment_countdown AS
SELECT 
    p.id as user_id,
    p.full_name,
    pay.status as payment_status,
    pay.created_at as payment_date,
    cr.is_ready as documents_ready
FROM public.profiles p
JOIN public.payments pay ON p.id = pay.user_id
JOIN public.candidate_readiness cr ON p.id = cr.user_id
WHERE pay.status = 'completed';

-- 5. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can update all profiles" ON public.profiles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Candidate Documents Policies
CREATE POLICY "Candidates can view own documents" ON public.candidate_documents
    FOR SELECT USING (auth.uid() = candidate_id);

CREATE POLICY "Candidates can insert own documents" ON public.candidate_documents
    FOR INSERT WITH CHECK (auth.uid() = candidate_id);

CREATE POLICY "Candidates can delete own documents" ON public.candidate_documents
    FOR DELETE USING (auth.uid() = candidate_id);

CREATE POLICY "Admins can view all documents" ON public.candidate_documents
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admins can manage all documents" ON public.candidate_documents
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Payments Policies
CREATE POLICY "Users can view own payments" ON public.payments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments" ON public.payments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
