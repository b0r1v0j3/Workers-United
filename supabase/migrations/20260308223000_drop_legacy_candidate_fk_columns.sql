-- ================================================================
-- MIGRATION: Drop legacy candidate_id FK columns (stage 3)
-- Date: 08.03.2026
--
-- Purpose:
-- Remove the last worker/candidate FK compatibility layer after:
-- 1. stage 1 physical worker table rename is live
-- 2. stage 2 worker_id additive transition is live
-- 3. runtime/app layer has switched to worker_id
--
-- Scope:
-- - drops sync triggers/checks introduced in stage 2
-- - drops legacy candidate_id columns from documents, matches, offers
-- - rebuilds RLS policies that still depended on candidate_id
-- - rebuilds handle_offer_rejection() to use worker_id
--
-- Out of scope:
-- - contract_data / pdf payload candidate_* fields
-- - compatibility views removal
-- - storage bucket rename
-- ================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_documents_sync_worker_candidate_ids ON public.documents;
DROP TRIGGER IF EXISTS trg_matches_sync_worker_candidate_ids ON public.matches;
DROP TRIGGER IF EXISTS trg_offers_sync_worker_candidate_ids ON public.offers;

ALTER TABLE public.documents
    DROP CONSTRAINT IF EXISTS documents_worker_candidate_sync_check;

ALTER TABLE public.matches
    DROP CONSTRAINT IF EXISTS matches_worker_candidate_sync_check;

ALTER TABLE public.offers
    DROP CONSTRAINT IF EXISTS offers_worker_candidate_sync_check;

ALTER TABLE public.documents
    DROP CONSTRAINT IF EXISTS documents_candidate_id_fkey;

ALTER TABLE public.matches
    DROP CONSTRAINT IF EXISTS matches_candidate_id_fkey;

ALTER TABLE public.offers
    DROP CONSTRAINT IF EXISTS offers_candidate_id_fkey;

DROP INDEX IF EXISTS public.idx_documents_candidate;
DROP INDEX IF EXISTS public.idx_matches_candidate;
DROP INDEX IF EXISTS public.idx_matches_candidate_id;
DROP INDEX IF EXISTS public.idx_offers_candidate;
DROP INDEX IF EXISTS public.idx_offers_candidate_id;

DROP POLICY IF EXISTS "View own matches" ON public.matches;
DROP POLICY IF EXISTS "View own offers" ON public.offers;
DROP POLICY IF EXISTS "Candidates view own documents" ON public.documents;
DROP POLICY IF EXISTS "Workers view own documents" ON public.documents;
DROP POLICY IF EXISTS "Candidates upload own documents" ON public.documents;
DROP POLICY IF EXISTS "Workers upload own documents" ON public.documents;
DROP POLICY IF EXISTS "View own contract data" ON public.contract_data;

DROP FUNCTION IF EXISTS public.handle_offer_rejection(UUID);

ALTER TABLE public.documents
    DROP COLUMN IF EXISTS candidate_id CASCADE;

ALTER TABLE public.matches
    DROP COLUMN IF EXISTS candidate_id CASCADE;

ALTER TABLE public.offers
    DROP COLUMN IF EXISTS candidate_id CASCADE;

DROP FUNCTION IF EXISTS public.sync_worker_candidate_ids();

CREATE POLICY "View own matches" ON public.matches
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.workers
            WHERE id = worker_id
              AND profile_id = (select auth.uid())
        ) OR
        EXISTS (
            SELECT 1
            FROM public.employers
            WHERE id = employer_id
              AND profile_id = (select auth.uid())
        ) OR
        public.is_admin()
    );

CREATE POLICY "View own offers" ON public.offers
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.workers
            WHERE id = worker_id
              AND profile_id = (select auth.uid())
        ) OR
        EXISTS (
            SELECT 1
            FROM public.job_requests jr
            JOIN public.employers e ON jr.employer_id = e.id
            WHERE jr.id = job_request_id
              AND e.profile_id = (select auth.uid())
        ) OR
        public.is_admin()
    );

CREATE POLICY "Workers view own documents" ON public.documents
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.workers
            WHERE id = worker_id
              AND profile_id = (select auth.uid())
        ) OR
        public.is_admin()
    );

CREATE POLICY "Workers upload own documents" ON public.documents
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.workers
            WHERE id = worker_id
              AND profile_id = (select auth.uid())
        )
    );

CREATE POLICY "View own contract data" ON public.contract_data
    FOR SELECT USING (
        EXISTS (
            SELECT 1
            FROM public.matches m
            JOIN public.workers w ON m.worker_id = w.id
            WHERE m.id = match_id
              AND w.profile_id = (select auth.uid())
        ) OR
        EXISTS (
            SELECT 1
            FROM public.matches m
            JOIN public.employers e ON m.employer_id = e.id
            WHERE m.id = match_id
              AND e.profile_id = (select auth.uid())
        ) OR
        public.is_admin()
    );

CREATE OR REPLACE FUNCTION public.handle_offer_rejection(p_offer_id UUID)
RETURNS VOID AS $$
DECLARE
    offer_rec RECORD;
    worker_rec RECORD;
    max_position INTEGER;
BEGIN
    SELECT * INTO offer_rec
    FROM public.offers
    WHERE id = p_offer_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT * INTO worker_rec
    FROM public.workers
    WHERE id = offer_rec.worker_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE public.workers
    SET rejection_count = COALESCE(rejection_count, 0) + 1,
        refund_eligible = FALSE
    WHERE id = offer_rec.worker_id;

    IF COALESCE(worker_rec.rejection_count, 0) + 1 >= 2 THEN
        UPDATE public.workers
        SET status = 'REJECTED_TWICE',
            queue_position = NULL,
            entry_fee_paid = FALSE
        WHERE id = offer_rec.worker_id;
    ELSE
        SELECT COALESCE(MAX(queue_position), 0) + 1
        INTO max_position
        FROM public.workers
        WHERE entry_fee_paid = TRUE;

        UPDATE public.workers
        SET status = 'IN_QUEUE',
            queue_position = max_position
        WHERE id = offer_rec.worker_id;
    END IF;

    UPDATE public.offers
    SET status = 'expired'
    WHERE id = p_offer_id;
END;
$$ LANGUAGE plpgsql;

COMMIT;
