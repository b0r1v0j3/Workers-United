-- ================================================================
-- MIGRATION: Worker FK transition (stage 2)
-- Date: 08.03.2026
--
-- Purpose:
-- Introduce worker-first foreign keys on top of the stage-1 physical
-- table rename, while keeping legacy candidate_id columns alive for
-- backward compatibility during the app/runtime transition.
--
-- Scope:
-- - Adds worker_id to: documents, matches, offers
-- - Backfills worker_id from candidate_id
-- - Backfills candidate_id from worker_id when needed
-- - Adds worker_id foreign keys to public.workers(id)
-- - Adds worker_id indexes (+ offers unique worker/job pair index)
-- - Keeps candidate_id and worker_id synchronized through triggers
-- - Does NOT remove candidate_id yet
-- ================================================================

BEGIN;

DO $$
BEGIN
    IF to_regclass('public.workers') IS NULL THEN
        RAISE EXCEPTION 'public.workers must exist before worker FK transition can run.';
    END IF;

    IF to_regclass('public.documents') IS NULL THEN
        RAISE EXCEPTION 'public.documents must exist before worker FK transition can run.';
    END IF;

    IF to_regclass('public.matches') IS NULL THEN
        RAISE EXCEPTION 'public.matches must exist before worker FK transition can run.';
    END IF;

    IF to_regclass('public.offers') IS NULL THEN
        RAISE EXCEPTION 'public.offers must exist before worker FK transition can run.';
    END IF;
END
$$;

ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS worker_id UUID;

ALTER TABLE public.matches
    ADD COLUMN IF NOT EXISTS worker_id UUID;

ALTER TABLE public.offers
    ADD COLUMN IF NOT EXISTS worker_id UUID;

COMMENT ON COLUMN public.documents.worker_id
IS 'Stage-2 worker-first FK. Kept in sync with legacy candidate_id during transition.';

COMMENT ON COLUMN public.matches.worker_id
IS 'Stage-2 worker-first FK. Kept in sync with legacy candidate_id during transition.';

COMMENT ON COLUMN public.offers.worker_id
IS 'Stage-2 worker-first FK. Kept in sync with legacy candidate_id during transition.';

UPDATE public.documents
SET worker_id = candidate_id
WHERE worker_id IS NULL
  AND candidate_id IS NOT NULL;

UPDATE public.matches
SET worker_id = candidate_id
WHERE worker_id IS NULL
  AND candidate_id IS NOT NULL;

UPDATE public.offers
SET worker_id = candidate_id
WHERE worker_id IS NULL
  AND candidate_id IS NOT NULL;

UPDATE public.documents
SET candidate_id = worker_id
WHERE candidate_id IS NULL
  AND worker_id IS NOT NULL;

UPDATE public.matches
SET candidate_id = worker_id
WHERE candidate_id IS NULL
  AND worker_id IS NOT NULL;

UPDATE public.offers
SET candidate_id = worker_id
WHERE candidate_id IS NULL
  AND worker_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_worker_candidate_ids()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.worker_id IS NULL AND NEW.candidate_id IS NOT NULL THEN
        NEW.worker_id := NEW.candidate_id;
    ELSIF NEW.candidate_id IS NULL AND NEW.worker_id IS NOT NULL THEN
        NEW.candidate_id := NEW.worker_id;
    ELSIF NEW.worker_id IS NOT NULL
      AND NEW.candidate_id IS NOT NULL
      AND NEW.worker_id <> NEW.candidate_id THEN
        RAISE EXCEPTION
            'worker_id (%) and candidate_id (%) must match on %.%',
            NEW.worker_id,
            NEW.candidate_id,
            TG_TABLE_SCHEMA,
            TG_TABLE_NAME;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documents_sync_worker_candidate_ids ON public.documents;
CREATE TRIGGER trg_documents_sync_worker_candidate_ids
BEFORE INSERT OR UPDATE OF candidate_id, worker_id
ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.sync_worker_candidate_ids();

DROP TRIGGER IF EXISTS trg_matches_sync_worker_candidate_ids ON public.matches;
CREATE TRIGGER trg_matches_sync_worker_candidate_ids
BEFORE INSERT OR UPDATE OF candidate_id, worker_id
ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.sync_worker_candidate_ids();

DROP TRIGGER IF EXISTS trg_offers_sync_worker_candidate_ids ON public.offers;
CREATE TRIGGER trg_offers_sync_worker_candidate_ids
BEFORE INSERT OR UPDATE OF candidate_id, worker_id
ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.sync_worker_candidate_ids();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'documents_worker_candidate_sync_check'
          AND conrelid = 'public.documents'::regclass
    ) THEN
        ALTER TABLE public.documents
            ADD CONSTRAINT documents_worker_candidate_sync_check
            CHECK (
                worker_id IS NULL
                OR candidate_id IS NULL
                OR worker_id = candidate_id
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'matches_worker_candidate_sync_check'
          AND conrelid = 'public.matches'::regclass
    ) THEN
        ALTER TABLE public.matches
            ADD CONSTRAINT matches_worker_candidate_sync_check
            CHECK (
                worker_id IS NULL
                OR candidate_id IS NULL
                OR worker_id = candidate_id
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'offers_worker_candidate_sync_check'
          AND conrelid = 'public.offers'::regclass
    ) THEN
        ALTER TABLE public.offers
            ADD CONSTRAINT offers_worker_candidate_sync_check
            CHECK (
                worker_id IS NULL
                OR candidate_id IS NULL
                OR worker_id = candidate_id
            );
    END IF;
END
$$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'documents_worker_id_fkey'
          AND conrelid = 'public.documents'::regclass
    ) THEN
        ALTER TABLE public.documents
            ADD CONSTRAINT documents_worker_id_fkey
            FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'matches_worker_id_fkey'
          AND conrelid = 'public.matches'::regclass
    ) THEN
        ALTER TABLE public.matches
            ADD CONSTRAINT matches_worker_id_fkey
            FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'offers_worker_id_fkey'
          AND conrelid = 'public.offers'::regclass
    ) THEN
        ALTER TABLE public.offers
            ADD CONSTRAINT offers_worker_id_fkey
            FOREIGN KEY (worker_id) REFERENCES public.workers(id) ON DELETE CASCADE;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_documents_worker_id
    ON public.documents(worker_id);

CREATE INDEX IF NOT EXISTS idx_matches_worker_id
    ON public.matches(worker_id);

CREATE INDEX IF NOT EXISTS idx_offers_worker_id
    ON public.offers(worker_id);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.offers
        WHERE worker_id IS NOT NULL
        GROUP BY job_request_id, worker_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate (job_request_id, worker_id) pairs exist in public.offers. Resolve them before adding the worker unique index.';
    END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_offers_job_request_worker_unique
    ON public.offers(job_request_id, worker_id)
    WHERE worker_id IS NOT NULL;

COMMIT;
