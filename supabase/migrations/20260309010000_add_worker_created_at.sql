BEGIN;

ALTER TABLE public.workers
    ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE public.workers AS workers
SET created_at = profiles.created_at
FROM public.profiles AS profiles
WHERE workers.created_at IS NULL
  AND workers.profile_id = profiles.id;

UPDATE public.workers
SET created_at = COALESCE(
    job_search_activated_at,
    queue_joined_at,
    claimed_by_worker_at,
    updated_at,
    now()
)
WHERE created_at IS NULL;

ALTER TABLE public.workers
    ALTER COLUMN created_at SET DEFAULT now();

ALTER TABLE public.workers
    ALTER COLUMN created_at SET NOT NULL;

COMMENT ON COLUMN public.workers.created_at
IS 'Immutable timestamp when the worker record was first added to Workers United.';

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

CREATE OR REPLACE VIEW public.candidates
WITH (security_invoker = true)
AS
SELECT *
FROM public.workers;

COMMENT ON VIEW public.candidates
IS 'Legacy compatibility view over public.workers. Replace remaining uses with worker-first access.';

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.candidates
TO authenticated, service_role;

COMMIT;
