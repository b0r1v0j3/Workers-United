-- ================================================================
-- MIGRATION: Physical worker table rename (stage 1)
-- Date: 08.03.2026
--
-- Purpose:
-- Move the main physical worker resources away from `candidate*` naming
-- without breaking the current app/runtime or legacy SQL that still expects
-- `candidates` / `candidate_documents`.
--
-- Strategy:
-- 1. Rename physical tables:
--      public.candidates           -> public.workers
--      public.candidate_documents  -> public.worker_documents
-- 2. Recreate compatibility views with the old names:
--      public.candidates
--      public.candidate_documents
-- 3. Keep worker-first access stable:
--      public.worker_onboarding -> simple view over public.workers
--      public.worker_readiness  -> compatibility alias over candidate_readiness
--
-- Scope:
-- - No candidate_id -> worker_id column rename yet
-- - No storage bucket rename yet
-- - No contract payload rename yet
--
-- Safety:
-- - Idempotent for normal reruns
-- - Raises if both old and new physical tables exist at once
-- - Handles the live hybrid document state where `candidate_documents` is
--   still physical and `worker_documents` is only a compatibility view
-- ================================================================

BEGIN;

DO $$
DECLARE
    has_candidates_table boolean;
    has_workers_table boolean;
    has_workers_view boolean;
    has_candidate_documents_table boolean;
    has_worker_documents_table boolean;
    has_worker_documents_view boolean;
    has_candidate_documents_view boolean;
    candidate_documents_count bigint;
    worker_documents_count bigint;
    candidate_minus_worker_count bigint;
    worker_minus_candidate_count bigint;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'candidates'
          AND table_type = 'BASE TABLE'
    ) INTO has_candidates_table;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'workers'
          AND table_type = 'BASE TABLE'
    ) INTO has_workers_table;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name = 'workers'
    ) INTO has_workers_view;

    IF has_candidates_table AND has_workers_table THEN
        RAISE EXCEPTION 'Both public.candidates and public.workers physical tables exist. Manual resolution required before migration can continue.';
    END IF;

    IF has_candidates_table THEN
        IF has_workers_view THEN
            DROP VIEW public.workers;
        END IF;

        ALTER TABLE public.candidates RENAME TO workers;
        COMMENT ON TABLE public.workers IS 'Physical worker onboarding records (renamed from public.candidates).';
    END IF;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'candidate_documents'
          AND table_type = 'BASE TABLE'
    ) INTO has_candidate_documents_table;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'worker_documents'
          AND table_type = 'BASE TABLE'
    ) INTO has_worker_documents_table;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name = 'worker_documents'
    ) INTO has_worker_documents_view;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.views
        WHERE table_schema = 'public'
          AND table_name = 'candidate_documents'
    ) INTO has_candidate_documents_view;

    IF has_candidate_documents_table THEN
        IF has_worker_documents_table THEN
            EXECUTE 'SELECT COUNT(*) FROM public.candidate_documents' INTO candidate_documents_count;
            EXECUTE 'SELECT COUNT(*) FROM public.worker_documents' INTO worker_documents_count;

            IF candidate_documents_count <> worker_documents_count THEN
                RAISE EXCEPTION 'public.candidate_documents (%) and public.worker_documents (%) differ in row count. Manual resolution required before migration can continue.',
                    candidate_documents_count,
                    worker_documents_count;
            END IF;

            EXECUTE $sql$
                SELECT COUNT(*) FROM (
                    (SELECT id, user_id, document_type, status, storage_path, verified_at, reject_reason, ocr_json, extracted_data, created_at, updated_at
                     FROM public.candidate_documents)
                    EXCEPT
                    (SELECT id, user_id, document_type, status, storage_path, verified_at, reject_reason, ocr_json, extracted_data, created_at, updated_at
                     FROM public.worker_documents)
                ) diff
            $sql$
            INTO candidate_minus_worker_count;

            EXECUTE $sql$
                SELECT COUNT(*) FROM (
                    (SELECT id, user_id, document_type, status, storage_path, verified_at, reject_reason, ocr_json, extracted_data, created_at, updated_at
                     FROM public.worker_documents)
                    EXCEPT
                    (SELECT id, user_id, document_type, status, storage_path, verified_at, reject_reason, ocr_json, extracted_data, created_at, updated_at
                     FROM public.candidate_documents)
                ) diff
            $sql$
            INTO worker_minus_candidate_count;

            IF candidate_minus_worker_count <> 0 OR worker_minus_candidate_count <> 0 THEN
                RAISE EXCEPTION 'public.candidate_documents and public.worker_documents are not identical copies. Manual resolution required before migration can continue.';
            END IF;

            IF has_candidate_documents_view THEN
                DROP VIEW public.candidate_documents;
            END IF;

            DROP TABLE public.candidate_documents;
        ELSE
            IF has_worker_documents_view THEN
                DROP VIEW public.worker_documents;
            END IF;

            ALTER TABLE public.candidate_documents RENAME TO worker_documents;
            COMMENT ON TABLE public.worker_documents IS 'Physical worker document records (renamed from public.candidate_documents).';
        END IF;
    END IF;
END
$$;

-- Canonical worker-first view used by the app.
CREATE OR REPLACE VIEW public.worker_onboarding
WITH (security_invoker = true)
AS
SELECT * FROM public.workers;

COMMENT ON VIEW public.worker_onboarding
IS 'Worker-first canonical view over public.workers.';

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.worker_onboarding
TO authenticated, service_role;

-- Backward-compatible legacy view for any remaining old SQL/function paths.
CREATE OR REPLACE VIEW public.candidates
WITH (security_invoker = true)
AS
SELECT * FROM public.workers;

COMMENT ON VIEW public.candidates
IS 'Legacy compatibility view over public.workers. Replace remaining uses with worker-first access.';

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.candidates
TO authenticated, service_role;

-- The app now talks to the physical worker_documents table directly.
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.worker_documents
TO authenticated, service_role;

-- Legacy document compatibility view for old SQL/functions.
CREATE OR REPLACE VIEW public.candidate_documents
WITH (security_invoker = true)
AS
SELECT * FROM public.worker_documents;

COMMENT ON VIEW public.candidate_documents
IS 'Legacy compatibility view over public.worker_documents. Replace remaining uses with worker-first access.';

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.candidate_documents
TO authenticated, service_role;

-- Keep readiness alias stable only when candidate_readiness exists in this env.
DO $$
BEGIN
    IF to_regclass('public.candidate_readiness') IS NOT NULL THEN
        EXECUTE $sql$
            CREATE OR REPLACE VIEW public.worker_readiness
            WITH (security_invoker = true)
            AS
            SELECT * FROM public.candidate_readiness
        $sql$;

        EXECUTE $sql$
            COMMENT ON VIEW public.worker_readiness
            IS 'Worker-first compatibility alias over public.candidate_readiness.'
        $sql$;

        EXECUTE $sql$
            GRANT SELECT
            ON public.worker_readiness
            TO authenticated, service_role
        $sql$;
    END IF;
END
$$;

COMMIT;
