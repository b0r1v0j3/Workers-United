-- ================================================================
-- MIGRATION: Worker terminology compatibility aliases (non-breaking)
-- Date: 05.03.2026
--
-- Purpose:
-- Keep existing physical tables (`candidates`, `candidate_documents`) intact,
-- while exposing worker-first aliases for gradual migration of SQL/read models.
--
-- Safety:
-- - No table rename
-- - No data move
-- - No constraint/RLS rewrite
-- ================================================================

BEGIN;

DO $$
BEGIN
    -- Alias for worker onboarding records (backed by public.candidates)
    IF to_regclass('public.candidates') IS NOT NULL THEN
        EXECUTE $sql$
            CREATE OR REPLACE VIEW public.worker_onboarding
            WITH (security_invoker = true)
            AS
            SELECT * FROM public.candidates
        $sql$;

        EXECUTE $sql$
            COMMENT ON VIEW public.worker_onboarding
            IS 'Compatibility alias for public.candidates (worker-first terminology).'
        $sql$;

        EXECUTE $sql$
            GRANT SELECT, INSERT, UPDATE, DELETE
            ON public.worker_onboarding
            TO authenticated, service_role
        $sql$;
    END IF;

    -- Alias for worker documents (backed by public.candidate_documents)
    IF to_regclass('public.candidate_documents') IS NOT NULL THEN
        EXECUTE $sql$
            CREATE OR REPLACE VIEW public.worker_documents
            WITH (security_invoker = true)
            AS
            SELECT * FROM public.candidate_documents
        $sql$;

        EXECUTE $sql$
            COMMENT ON VIEW public.worker_documents
            IS 'Compatibility alias for public.candidate_documents (worker-first terminology).'
        $sql$;

        EXECUTE $sql$
            GRANT SELECT, INSERT, UPDATE, DELETE
            ON public.worker_documents
            TO authenticated, service_role
        $sql$;
    END IF;

    -- Alias for readiness analytics (if candidate_readiness exists in this env)
    IF to_regclass('public.candidate_readiness') IS NOT NULL THEN
        EXECUTE $sql$
            CREATE OR REPLACE VIEW public.worker_readiness
            WITH (security_invoker = true)
            AS
            SELECT * FROM public.candidate_readiness
        $sql$;

        EXECUTE $sql$
            COMMENT ON VIEW public.worker_readiness
            IS 'Compatibility alias for public.candidate_readiness.'
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

