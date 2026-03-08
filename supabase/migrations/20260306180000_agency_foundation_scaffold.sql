-- Agency foundation scaffold
-- Additive only: keeps the existing physical `candidates` table as the worker source of truth.
-- This migration prepares ownership/attribution fields for agency-submitted workers.

CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    legal_name TEXT,
    display_name TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    country TEXT,
    city TEXT,
    website_url TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'blocked')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.agencies IS
    'Agency organizations that can submit worker profiles into the platform.';

COMMENT ON COLUMN public.agencies.profile_id IS
    'The owning auth/profile record for the agency dashboard account.';

ALTER TABLE public.candidates
    ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'self' CHECK (source_type IN ('self', 'agency')),
    ADD COLUMN IF NOT EXISTS agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS submitted_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS submitted_full_name TEXT,
    ADD COLUMN IF NOT EXISTS submitted_email TEXT,
    ADD COLUMN IF NOT EXISTS claimed_by_worker_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS agency_notes TEXT;

COMMENT ON COLUMN public.candidates.source_type IS
    'Tracks whether the worker profile was created directly by the worker or submitted through an agency.';

COMMENT ON COLUMN public.candidates.agency_id IS
    'Agency that owns/submitted this worker profile, if source_type = agency.';

COMMENT ON COLUMN public.candidates.submitted_by_profile_id IS
    'Specific profile that created the worker record on behalf of the worker.';

COMMENT ON COLUMN public.candidates.submitted_full_name IS
    'Agency-provided worker name for drafts that do not have a claimed auth/profile row yet.';

COMMENT ON COLUMN public.candidates.submitted_email IS
    'Agency-provided worker email for drafts that do not have a claimed auth/profile row yet.';

COMMENT ON COLUMN public.candidates.claimed_by_worker_at IS
    'Timestamp when the worker later took direct control of an agency-submitted profile.';

CREATE INDEX IF NOT EXISTS idx_agencies_profile_id
    ON public.agencies(profile_id);

CREATE INDEX IF NOT EXISTS idx_candidates_agency_id
    ON public.candidates(agency_id)
    WHERE agency_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_submitted_by_profile_id
    ON public.candidates(submitted_by_profile_id)
    WHERE submitted_by_profile_id IS NOT NULL;
