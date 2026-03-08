-- ================================================================
-- MIGRATION: Finalize worker-first contract/view/storage cleanup
-- Date: 08.03.2026
--
-- Purpose:
-- Align the repository migration chain with the live worker-first state
-- reached after stage 3:
-- 1. contract_data stores only worker_* override columns
-- 2. public.candidates / public.candidate_documents compatibility views are gone
-- 3. worker_onboarding remains the canonical worker read/write view
-- 4. worker-docs is the canonical storage bucket for document uploads
--
-- Notes:
-- - Storage object COPY/DELETE is operational and must be handled outside SQL.
-- - This migration only makes the canonical worker-docs bucket/policies exist in DB metadata.
-- ================================================================

BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contract_data'
          AND column_name = 'candidate_passport_issue_date'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contract_data'
          AND column_name = 'worker_passport_issue_date'
    ) THEN
        ALTER TABLE public.contract_data
            RENAME COLUMN candidate_passport_issue_date TO worker_passport_issue_date;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contract_data'
          AND column_name = 'candidate_passport_issuer'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contract_data'
          AND column_name = 'worker_passport_issuer'
    ) THEN
        ALTER TABLE public.contract_data
            RENAME COLUMN candidate_passport_issuer TO worker_passport_issuer;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contract_data'
          AND column_name = 'candidate_place_of_birth'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contract_data'
          AND column_name = 'worker_place_of_birth'
    ) THEN
        ALTER TABLE public.contract_data
            RENAME COLUMN candidate_place_of_birth TO worker_place_of_birth;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contract_data'
          AND column_name = 'candidate_gender'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'contract_data'
          AND column_name = 'worker_gender'
    ) THEN
        ALTER TABLE public.contract_data
            RENAME COLUMN candidate_gender TO worker_gender;
    END IF;
END
$$;

COMMENT ON COLUMN public.contract_data.worker_passport_issue_date
IS 'Worker passport issue date override used when generating contract PDFs.';

COMMENT ON COLUMN public.contract_data.worker_passport_issuer
IS 'Worker passport issuer override used when generating contract PDFs.';

COMMENT ON COLUMN public.contract_data.worker_place_of_birth
IS 'Worker place of birth override used when generating contract PDFs.';

COMMENT ON COLUMN public.contract_data.worker_gender
IS 'Worker gender override used when generating contract PDFs.';

DROP VIEW IF EXISTS public.candidates;
DROP VIEW IF EXISTS public.candidate_documents;
DROP FUNCTION IF EXISTS public.get_at_risk_candidates();

CREATE OR REPLACE VIEW public.worker_onboarding
WITH (security_invoker = true)
AS
SELECT *
FROM public.workers;

COMMENT ON VIEW public.worker_onboarding
IS 'Canonical worker onboarding access view over public.workers.';

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.worker_onboarding
TO authenticated, service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('worker-docs', 'worker-docs', true)
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    public = EXCLUDED.public;

DROP POLICY IF EXISTS "Authenticated users can upload to worker-docs" ON storage.objects;
CREATE POLICY "Authenticated users can upload to worker-docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'worker-docs'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Authenticated users can update worker-docs" ON storage.objects;
CREATE POLICY "Authenticated users can update worker-docs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'worker-docs'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Authenticated users can delete worker-docs" ON storage.objects;
CREATE POLICY "Authenticated users can delete worker-docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'worker-docs'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Public can read worker-docs" ON storage.objects;
CREATE POLICY "Public can read worker-docs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'worker-docs');

COMMIT;
